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

  assert.match(snapshot.webglVersion, /WebGL/i, "renderer should hold a WebGL context");
  assert.equal(snapshot.player.attached, true, "player group should be attached to scene");
  assert.equal(snapshot.opponent.attached, true, "opponent group should be attached to scene");
  assert.equal(snapshot.player.modelLoaded, true, "player GLB should load");
  assert.equal(snapshot.opponent.modelLoaded, true, "opponent GLB should load");
  assert.ok(snapshot.player.modelMeshCount > 0, "player should contain visible model meshes");
  assert.ok(snapshot.opponent.modelMeshCount > 0, "opponent should contain visible model meshes");
  assert.ok(snapshot.player.bones.length >= 8, "player should expose a mapped humanoid rig");
  assert.ok(snapshot.opponent.bones.length >= 8, "opponent should expose a mapped humanoid rig");
  for (const boneName of ["Head", "Chest", "Hips", "UpperArm.R", "LowerArm.R", "Wrist.R"]) {
    assert.ok(snapshot.player.bones.includes(boneName), `player rig should map ${boneName}`);
    assert.ok(snapshot.opponent.bones.includes(boneName), `opponent rig should map ${boneName}`);
  }
  assert.ok(snapshot.player.hurtboxes.length >= 5, "player should have rig-based hurtboxes");
  assert.ok(snapshot.opponent.hurtboxes.length >= 5, "opponent should have rig-based hurtboxes");
  assert.ok(snapshot.player.hurtboxes.some(box => box.zone === "head"), "player head hurtbox should exist");
  assert.ok(snapshot.player.hurtboxes.some(box => box.zone === "torso"), "player torso hurtbox should exist");
  assert.equal(snapshot.crowd.attached, true, "crowd should be attached to scene");
  assert.ok(snapshot.crowd.instancedMeshes >= 4, "crowd should contain instanced character meshes");
  assert.equal(snapshot.referee.attached, true, "referee should be attached to scene");
  assert.ok(snapshot.camera.position[2] > 10, "camera should be placed outside the ring and facing the fighters");

  await mkdir(artifacts, { recursive: true });
  await page.screenshot({
    path: resolve(artifacts, "smashers-boxing-scene.png"),
    fullPage: true
  });

  const punch = await page.evaluate(() => window.__SMASHERS_QA__.testPunchContact("player"));
  assert.equal(punch.hit, true, `swept fist should hit target hurtbox: ${JSON.stringify(punch)}`);
  assert.ok(punch.damage > 0, "a registered hit should reduce health");

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
    playerMeshes: snapshot.player.modelMeshCount,
    opponentMeshes: snapshot.opponent.modelMeshCount,
    playerHurtboxes: snapshot.player.hurtboxes.length,
    audienceInstancedMeshes: snapshot.crowd.instancedMeshes,
    punchContact: punch,
    failedRequests
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
