import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifacts = resolve(root, "artifacts");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const relative = decodeURIComponent(requestUrl.pathname === "/"
      ? "/game.html"
      : requestUrl.pathname);
    const filePath = resolve(root, "." + relative);

    if (filePath !== root && !filePath.startsWith(root + sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const bytes = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    });
    response.end(bytes);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500);
    response.end(error.message);
  }
});

await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(4173, "127.0.0.1", resolveListen);
});

let browser;
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];

try {
  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader"
    ]
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1
  });

  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", request => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText || "unknown"
    });
  });

  const response = await page.goto("http://127.0.0.1:4173/game.html?qa=1", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  assert.equal(response?.status(), 200, "game.html should be served");

  await page.waitForFunction(() => {
    return document.getElementById("loading-screen")?.classList.contains("hidden") &&
      Boolean(window.__SMASHERS_QA__);
  }, { timeout: 45000 });

  await page.waitForFunction(() => {
    const qa = window.__SMASHERS_QA__;
    if (!qa) return false;
    const state = qa.snapshot();
    return state.player.modelLoaded && state.opponent.modelLoaded;
  }, { timeout: 60000 });

  const snapshot = await page.evaluate(() => window.__SMASHERS_QA__.snapshot());
  console.log("IMPORTED GLB SKELETON NAMES", JSON.stringify({
    player: snapshot.player.modelBoneNames,
    opponent: snapshot.opponent.modelBoneNames,
    mappedPlayer: snapshot.player.bones,
    mappedOpponent: snapshot.opponent.bones
  }));
  console.log("BOXER MODEL IMPORT DIAGNOSTICS", JSON.stringify({
    player: snapshot.player.model,
    opponent: snapshot.opponent.model
  }));

  assert.match(snapshot.webglVersion, /WebGL/i, "renderer should hold a WebGL context");
  assert.equal(snapshot.player.attached, true, "player group should be attached to scene");
  assert.equal(snapshot.opponent.attached, true, "opponent group should be attached to scene");
  assert.equal(snapshot.player.modelLoaded, true, "player GLB should load");
  assert.equal(snapshot.opponent.modelLoaded, true, "opponent GLB should load");
  assert.ok(snapshot.player.model.meshCount > 0, "player should contain model meshes");
  assert.ok(snapshot.opponent.model.meshCount > 0, "opponent should contain model meshes");
  assert.ok(snapshot.player.model.visibleMeshCount > 0, "player model meshes should be visible");
  assert.ok(snapshot.opponent.model.visibleMeshCount > 0, "opponent model meshes should be visible");
  assert.ok(snapshot.player.model.bounds?.size[1] > 1.5, "player model should have human-scale height");
  assert.ok(snapshot.opponent.model.bounds?.size[1] > 1.5, "opponent model should have human-scale height");
  for (const [label, model] of [["player", snapshot.player.model], ["opponent", snapshot.opponent.model]]) {
    assert.ok(Math.abs(model.localRotation?.[0] || 0) < 0.01, `${label} should preserve the source model's native Y-up orientation`);
    assert.ok(model.rawSourceSize?.[1] > model.rawSourceSize?.[0] * 2, `${label} raw GLB should be Y-up`);
    assert.ok(model.sourceSize?.[1] > model.sourceSize?.[0] * 2, `${label} fitted source should remain Y-up`);
    assert.ok(model.appliedFitScale > 0.5 && model.appliedFitScale < 1.5, `${label} should use a sane model fit scale`);
    assert.ok(model.scaledSourceSize?.[0] < 1.2, `${label} fitted body should not be too wide`);
    assert.ok(model.scaledSourceSize?.[1] > 1.7 && model.scaledSourceSize?.[1] < 1.9, `${label} fitted body should be human height`);
    assert.ok(model.scaledSourceSize?.[2] < 1.2, `${label} fitted body should not be too deep`);
    assert.ok(Math.abs(model.expectedBounds?.min?.[1] ?? -1) < 1e-5, `${label} fitted feet should align with the ring floor`);
  }
  assert.ok(snapshot.player.modelBoneNames.length > 0, "player GLB should contain a real skeleton");
  assert.ok(snapshot.opponent.modelBoneNames.length > 0, "opponent GLB should contain a real skeleton");
  assert.ok(snapshot.player.hurtboxes.length >= 10, "player should have rig-based capsule hurtboxes");
  assert.ok(snapshot.opponent.hurtboxes.length >= 10, "opponent should have rig-based capsule hurtboxes");
  assert.ok(snapshot.player.hurtboxes.some(box => box.zone === "head"), "player head hurtbox should exist");
  assert.ok(snapshot.player.hurtboxes.some(box => box.zone === "torso"), "player torso hurtbox should exist");
  assert.ok(snapshot.player.hurtboxes.some(box => box.zone === "arm"), "player arm hurtboxes should exist");
  assert.ok(snapshot.player.hurtboxes.some(box => box.zone === "leg"), "player leg hurtboxes should exist");
  assert.ok(snapshot.player.hurtboxes.every(box => box.start?.length === 3 && box.end?.length === 3), "player hurtboxes should expose both capsule endpoints");
  assert.ok(snapshot.opponent.hurtboxes.every(box => box.start?.length === 3 && box.end?.length === 3), "opponent hurtboxes should expose both capsule endpoints");
  for (const [label, gear] of [["player", snapshot.boxingGear.player], ["opponent", snapshot.boxingGear.opponent]]) {
    assert.equal(gear.singlets, 1, `${label} should have a team-coloured boxing singlet`);
    assert.equal(gear.trunks, 1, `${label} should have boxing trunks`);
    assert.equal(gear.gloves, 2, `${label} should have two boxing gloves`);
    assert.equal(gear.waistbands, 1, `${label} should have a boxing waistband`);
    assert.equal(gear.rigLegSegments, 4, `${label} should have four bone-following lower-leg capsules`);
    assert.equal(gear.rigLegMeshesVisible, 12, `${label} replacement leg capsule meshes should all be visible`);
    assert.equal(gear.legacyPantsVisible, false, `${label} should not render the source casual trousers`);
  }
  assert.ok(snapshot.framing.ringWidthFraction > 0.68, "ring should fill more of the gameplay view");
  assert.ok(snapshot.framing.ringWidthFraction < 0.94, "camera should leave room around the ring");
  assert.ok(snapshot.framing.playerHeightPixels > 82, "player should be large enough to read as a fighter");
  assert.ok(snapshot.framing.opponentHeightPixels > 82, "opponent should be large enough to read as a fighter");
  assert.equal(snapshot.crowd.attached, true, "crowd should be attached to scene");
  assert.ok(snapshot.crowd.instancedMeshes >= 4, "crowd should contain instanced character meshes");
  assert.equal(snapshot.referee.attached, true, "referee should be attached to scene");
  assert.ok(snapshot.camera.position[2] > 10, "camera should be placed outside the ring and facing the fighters");

  await page.waitForTimeout(400);
  await mkdir(artifacts, { recursive: true });
  await page.screenshot({
    path: resolve(artifacts, "smashers-boxing-scene.png"),
    fullPage: true
  });

  const punch = await page.evaluate(() => window.__SMASHERS_QA__.testPunchContact("player"));
  assert.equal(punch.hit, true, `swept fist should hit target hurtbox: ${JSON.stringify(punch)}`);
  assert.ok(punch.damage > 0, "a registered hit should reduce health");

  const naturalPunches = await page.evaluate(
    () => window.__SMASHERS_QA__.testNaturalPunchSweep("player")
  );
  console.log("NATURAL PUNCH DISTANCE SWEEP", JSON.stringify(naturalPunches));
  console.log("RIG POSE DIAGNOSTICS", JSON.stringify({
    player: snapshot.player.rigPose,
    opponent: snapshot.opponent.rigPose,
    playerActions: snapshot.player.animationActions,
    opponentActions: snapshot.opponent.animationActions
  }));
  assert.ok(
    naturalPunches.some(result => result.hit),
    "a punch should naturally connect at a valid in-ring separation"
  );

  await page.evaluate(() => window.__SMASHERS_QA__.setHitboxDebug(true));
  assert.equal(
    await page.evaluate(() => window.__SMASHERS_QA__.snapshot().hitboxDebugVisible),
    true,
    "F3 debug geometry should be visible when enabled"
  );
  await page.evaluate(() => window.__SMASHERS_QA__.setHitboxDebug(false));

  assert.deepEqual(pageErrors, [], "page should not throw uncaught JavaScript errors");
  const criticalConsoleErrors = consoleErrors.filter(message =>
    /failed to load resource|error creating webgl|uncaught|failed to load gltf|failed to load.*glb/i.test(message)
  );
  assert.deepEqual(criticalConsoleErrors, [], "there should be no critical browser console errors");

  console.log(JSON.stringify({
    result: "PASS",
    build: snapshot.build,
    webglVersion: snapshot.webglVersion,
    playerMeshes: snapshot.player.model.meshCount,
    playerVisibleMeshes: snapshot.player.model.visibleMeshCount,
    playerBounds: snapshot.player.model.bounds,
    playerMappedBones: snapshot.player.bones,
    opponentMeshes: snapshot.opponent.model.meshCount,
    opponentVisibleMeshes: snapshot.opponent.model.visibleMeshCount,
    opponentBounds: snapshot.opponent.model.bounds,
    opponentMappedBones: snapshot.opponent.bones,
    playerHurtboxes: snapshot.player.hurtboxes.length,
    playerBoxingGear: snapshot.boxingGear.player,
    opponentBoxingGear: snapshot.boxingGear.opponent,
    framing: snapshot.framing,
    audienceInstancedMeshes: snapshot.crowd.instancedMeshes,
    punchContact: punch,
    naturalPunches,
    failedRequests
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
