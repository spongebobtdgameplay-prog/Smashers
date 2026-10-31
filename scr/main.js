import * as THREE from "../engine/three/three.module.js?v=20261030-smashers-boxing-008";
import { createWorld } from "./world.js?v=20261030-smashers-boxing-008";
import { createFighter } from "./player.js?v=20261030-smashers-boxing-008";
import {
    clampFighterPosition,
    resolveFighterPair,
    punchHitsHurtboxes
} from "./fight-physics.js?v=20261030-smashers-boxing-008";
import { ServerPatcher } from "./v1-server.js";
import { BUILD_LABEL } from "./version.js?v=20261030-smashers-boxing-008";

// ============================================
// SMASHERS — FOUR-ROUND BOXING MATCH
// ============================================

const $ = (id) => document.getElementById(id);

const canvas = $("smashers-canvas");
const viewport = $("game-viewport");
const gameVersion = $("game-version");
const loadingScreen = $("loading-screen");
const loadingProgress = $("loading-progress");
const loadingStatus = $("loading-status");
const pauseMenu = $("pause-menu");
const resumeButton = $("resume-button");
const resultMenu = $("result-menu");
const resultTitle = $("result-title");
const resultDetail = $("result-detail");
const rematchButton = $("rematch-button");
const refereeCount = $("referee-count");

const playerHealthBar = $("player-health");
const opponentHealthBar = $("opponent-health");
const playerHealthValue = $("player-health-value");
const opponentHealthValue = $("opponent-health-value");
const fightTimer = $("fight-timer");
const fightStatus = $("fight-status");
const roundIndicator = $("round-indicator");
const fightScore = $("fight-score");
const gameMessage = $("game-message");

if (!canvas || !viewport) {
    throw new Error("Smashers: Game canvas or viewport is missing.");
}

if (gameVersion) gameVersion.textContent = BUILD_LABEL;

const CONFIG = Object.freeze({
    rounds: 4,
    roundDuration: 45,
    breakDuration: 6,
    knockdownCount: 10,
    playerGetUpPresses: 3,
    getUpHealth: 38,
    playerSpeed: 4.4,
    opponentSpeed: 2.35,
    playerDamage: 12,
    opponentDamage: 8,
    playerAttackRange: 2.0,
    opponentAttackRange: 1.32,
    fighterRadius: 0.42,
    arenaBounds: {
        minX: -5.55,
        maxX: 5.55,
        minZ: -3.05,
        maxZ: 3.05
    }
});

const BOXER_MODEL_URLS = [
    new URL("../assets/models/casual-character.glb", import.meta.url).href,
    "https://raw.githubusercontent.com/euuuuuuan/fatal-funnel-public/main/packages/renderer/assets/models/quaternius-men/casual-character.glb"
];

const BOXER_MODEL_ROTATION = [0, 0, 0];

const game = {
    paused: false,
    finished: false,
    phase: "fight",
    currentRound: 1,
    timeRemaining: CONFIG.roundDuration,
    breakRemaining: 0,
    keys: new Set(),
    elapsed: 0,
    lastDisplayedSecond: -1,
    roundDamage: { player: 0, opponent: 0 },
    roundWins: { player: 0, opponent: 0 },
    knockdowns: { player: 0, opponent: 0 },
    knockdown: null,
    debugHitboxes: false
};

let hitboxDebugGroups = null;

let world;
let player;
let opponent;
let messageTimeout = null;
let startupPhase = "application startup";

const serverPatcher = new ServerPatcher({
    onStatus(status) {
        console.info(
            "[SMASHERS SERVER]",
            status.state,
            status.serverId || "",
            status.message || ""
        );
    }
});

// V1 is not deployed. Keep the registry local and offline.

function setLoading(progress, status) {
    if (loadingProgress) loadingProgress.style.width = `${progress}%`;
    if (loadingStatus) loadingStatus.textContent = status;
}

function createHitboxDebugGroup(color) {
    const group = new THREE.Group();
    group.visible = false;
    const material = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.72,
        depthTest: false,
        depthWrite: false
    });

    const hurtboxes = new THREE.Group();
    const hurtboxCapsules = [];
    group.add(hurtboxes);

    const punchMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.42,
        depthTest: false,
        depthWrite: false
    });

    const punchBody = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 1, 10),
        punchMaterial
    );
    const punchStart = new THREE.Mesh(
        new THREE.SphereGeometry(1, 10, 8),
        material
    );
    const punchEnd = new THREE.Mesh(
        new THREE.SphereGeometry(1, 10, 8),
        material
    );
    group.add(punchBody, punchStart, punchEnd);

    return { group, hurtboxes, hurtboxCapsules, material, punchBody, punchStart, punchEnd };
}

function updateOneHitboxDebug(fighter, debug) {
    const hurtboxes = fighter.getHurtboxes();

    while (debug.hurtboxCapsules.length < hurtboxes.length) {
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1, 1, 12),
            debug.material
        );
        const startCap = new THREE.Mesh(
            new THREE.SphereGeometry(1, 12, 10),
            debug.material
        );
        const endCap = new THREE.Mesh(
            new THREE.SphereGeometry(1, 12, 10),
            debug.material
        );
        debug.hurtboxes.add(body, startCap, endCap);
        debug.hurtboxCapsules.push({ body, startCap, endCap });
    }

    for (let index = 0; index < debug.hurtboxCapsules.length; index += 1) {
        const meshes = debug.hurtboxCapsules[index];
        const hurtbox = hurtboxes[index];

        if (!hurtbox) {
            meshes.body.visible = false;
            meshes.startCap.visible = false;
            meshes.endCap.visible = false;
            continue;
        }

        const start = hurtbox.start || hurtbox.center;
        const end = hurtbox.end || hurtbox.center;
        if (!start || !end) continue;

        const direction = end.clone().sub(start);
        const length = direction.length();
        const midpoint = start.clone().add(end).multiplyScalar(0.5);
        const radius = hurtbox.radius;

        meshes.body.visible = length > 1e-5;
        meshes.body.position.copy(midpoint);
        meshes.body.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            length > 1e-5 ? direction.clone().normalize() : new THREE.Vector3(0, 1, 0)
        );
        meshes.body.scale.set(radius, Math.max(length, 1e-5), radius);

        meshes.startCap.visible = true;
        meshes.startCap.position.copy(start);
        meshes.startCap.scale.setScalar(radius);

        meshes.endCap.visible = true;
        meshes.endCap.position.copy(end);
        meshes.endCap.scale.setScalar(radius);
    }

    const punch = fighter.isAttacking ? fighter.getPunchHitbox() : null;
    if (!punch) {
        debug.punchBody.visible = false;
        debug.punchStart.visible = false;
        debug.punchEnd.visible = false;
        return;
    }

    const direction = punch.end.clone().sub(punch.start);
    const length = direction.length();
    const midpoint = punch.start.clone().add(punch.end).multiplyScalar(0.5);

    debug.punchBody.visible = true;
    debug.punchBody.position.copy(midpoint);
    debug.punchBody.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize()
    );
    debug.punchBody.scale.set(punch.radius, length, punch.radius);

    debug.punchStart.visible = true;
    debug.punchStart.position.copy(punch.start);
    debug.punchStart.scale.setScalar(punch.radius);

    debug.punchEnd.visible = true;
    debug.punchEnd.position.copy(punch.end);
    debug.punchEnd.scale.setScalar(punch.radius);
}

function updateHitboxDebug() {
    if (!game.debugHitboxes || !hitboxDebugGroups || !player || !opponent) return;
    updateOneHitboxDebug(player, hitboxDebugGroups.player);
    updateOneHitboxDebug(opponent, hitboxDebugGroups.opponent);
}

function setHitboxDebug(enabled) {
    game.debugHitboxes = Boolean(enabled);
    if (hitboxDebugGroups) {
        hitboxDebugGroups.player.group.visible = game.debugHitboxes;
        hitboxDebugGroups.opponent.group.visible = game.debugHitboxes;
    }
    showMessage(game.debugHitboxes ? "HITBOX DEBUG ON" : "HITBOX DEBUG OFF", 900);
}

async function initializeWorld() {
    startupPhase = "initializing Three.js renderer";
    setLoading(20, "INITIALIZING THREE.JS...");

    world = createWorld(THREE, canvas, viewport);

    startupPhase = "building the ring and fighters";
    setLoading(48, "BUILDING THE BOXING ARENA...");

    let loader = null;

    // Load the matching r162 GLTFLoader only when available. If the CDN
    // is unreachable, the built-in fighters still keep the match playable.
    const loaderModule = await Promise.race([
        import("https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/loaders/GLTFLoader.js")
            .catch((error) => {
                console.warn("[SMASHERS] GLTFLoader CDN unavailable; using built-in fighters.", error);
                return null;
            }),
        new Promise((resolve) => window.setTimeout(() => resolve(null), 5000))
    ]);

    if (loaderModule?.GLTFLoader) {
        loader = new loaderModule.GLTFLoader();
    }

    player = createFighter(THREE, {
        name: "PLAYER",
        color: 0x29313d,
        gloveColor: 0xe52d42,
        shortsColor: 0xe52d42,
        position: [-2.3, 0.18, 0],
        loader,
        modelUrls: BOXER_MODEL_URLS,
        modelRotation: BOXER_MODEL_ROTATION
    });

    opponent = createFighter(THREE, {
        name: "RIVAL",
        color: 0x292b36,
        gloveColor: 0x315dff,
        shortsColor: 0x315dff,
        position: [2.3, 0.18, 0],
        loader,
        modelUrls: BOXER_MODEL_URLS,
        modelRotation: BOXER_MODEL_ROTATION
    });

    // The missing scene attachment was why the ring rendered without boxers.
    world.scene.add(player.root);
    world.scene.add(opponent.root);

    hitboxDebugGroups = {
        player: createHitboxDebugGroup(0xff475d),
        opponent: createHitboxDebugGroup(0x4e83ff)
    };
    world.scene.add(
        hitboxDebugGroups.player.group,
        hitboxDebugGroups.opponent.group
    );

    player.setFacing(1);
    opponent.setFacing(-1);

    const playerName = $("player-name");
    const opponentName = $("opponent-name");
    if (playerName) playerName.textContent = player.name;
    if (opponentName) opponentName.textContent = "RIVAL";

    setLoading(66, "LOADING BOXER MODELS...");

    const modelLoad = Promise.all([player.ready, opponent.ready]);
    const modelStatus = await Promise.race([
        modelLoad.then(([playerLoaded, opponentLoaded]) => ({
            complete: true,
            playerLoaded,
            opponentLoaded
        })),
        new Promise((resolve) => window.setTimeout(
            () => resolve({ complete: false }),
            7000
        ))
    ]);

    if (modelStatus.complete) {
        console.info("[SMASHERS] Boxer model status:", {
            player: modelStatus.playerLoaded ? "Quaternius GLB" : "procedural fallback",
            opponent: modelStatus.opponentLoaded ? "Quaternius GLB" : "procedural fallback"
        });
    } else {
        console.info("[SMASHERS] Starting with visible fallback fighters while the online models continue loading.");
        modelLoad.then(([playerLoaded, opponentLoaded]) => {
            console.info("[SMASHERS] Online boxer model load completed:", {
                player: playerLoaded,
                opponent: opponentLoaded
            });
        });
    }

    startupPhase = "preparing fighters and HUD";
    setLoading(88, "PREPARING THE REFEREE AND CROWD...");

    updateHealthUI();
    updateTimerUI(true);
    updateScoreUI();

    game.elapsed = 0;
    game.phase = "fight";
    game.currentRound = 1;
    fightStatus.textContent = "ROUND 1";
    setLoading(100, "READY");

    if (loadingScreen) loadingScreen.classList.add("hidden");
}

function updateHealthUI() {
    if (!player || !opponent) return;

    const playerHealth = Math.ceil(player.health);
    const opponentHealth = Math.ceil(opponent.health);

    if (playerHealthBar) playerHealthBar.style.width = `${playerHealth}%`;
    if (opponentHealthBar) opponentHealthBar.style.width = `${opponentHealth}%`;
    if (playerHealthValue) playerHealthValue.textContent = playerHealth;
    if (opponentHealthValue) opponentHealthValue.textContent = opponentHealth;
}

function updateScoreUI() {
    if (roundIndicator) {
        roundIndicator.textContent =
            `ROUND ${Math.min(game.currentRound, CONFIG.rounds)} / ${CONFIG.rounds}`;
    }

    if (fightScore) {
        fightScore.textContent =
            `ROUNDS ${game.roundWins.player} — ${game.roundWins.opponent}`;
    }
}

function updateTimerUI(force = false) {
    const displayedSecond = Math.max(0, Math.ceil(game.timeRemaining));
    if (!force && displayedSecond === game.lastDisplayedSecond) return;

    game.lastDisplayedSecond = displayedSecond;
    const minutes = Math.floor(displayedSecond / 60);
    const seconds = displayedSecond % 60;

    if (fightTimer) {
        fightTimer.textContent =
            `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
}

function showMessage(message, duration = 1500) {
    if (!gameMessage) return;

    gameMessage.textContent = message;
    gameMessage.classList.add("visible");

    if (messageTimeout !== null) window.clearTimeout(messageTimeout);

    messageTimeout = window.setTimeout(() => {
        gameMessage.classList.remove("visible");
        messageTimeout = null;
    }, duration);
}

function hideRefereeCount() {
    if (refereeCount) refereeCount.hidden = true;
    if (world) world.resetReferee();
}

function finishMatch(title, detail) {
    if (game.finished) return;

    game.finished = true;
    game.phase = "finished";
    game.keys.clear();
    hideRefereeCount();

    if (pauseMenu) pauseMenu.hidden = true;
    if (resultTitle) resultTitle.textContent = title;
    if (resultDetail) resultDetail.textContent = detail;
    if (resultMenu) resultMenu.hidden = false;

    fightStatus.textContent = "FINAL";
    showMessage(title, 2600);
}

function decisionResult() {
    if (game.roundWins.player > game.roundWins.opponent) {
        finishMatch(
            "YOU WIN — DECISION",
            `Official decision after four rounds: ${game.roundWins.player} rounds to ${game.roundWins.opponent}.`
        );
    } else if (game.roundWins.player < game.roundWins.opponent) {
        finishMatch(
            "RIVAL WINS — DECISION",
            `Official decision after four rounds: ${game.roundWins.opponent} rounds to ${game.roundWins.player}.`
        );
    } else {
        finishMatch(
            "DRAW",
            `Four rounds complete. The judges scored it ${game.roundWins.player} rounds each.`
        );
    }
}

function startKnockdown(target) {
    if (game.finished || game.phase === "knockdown" || target.isKnockedDown) return;

    const isPlayer = target === player;
    game.phase = "knockdown";
    game.keys.clear();
    game.knockdowns[isPlayer ? "player" : "opponent"] += 1;
    game.knockdown = {
        target,
        elapsed: 0,
        count: 0,
        countAccumulator: 0,
        getUpPresses: 0,
        isPlayer
    };

    target.knockDown();
    world.startRefereeCount(target.position);

    if (refereeCount) {
        refereeCount.hidden = false;
        refereeCount.textContent = isPlayer
            ? "REFEREE COUNT: 0 — PRESS SPACE 3 TIMES TO GET UP"
            : "REFEREE COUNT: 0";
    }

    fightStatus.textContent = "KNOCKDOWN";
    showMessage(isPlayer ? "DOWN!" : "RIVAL DOWN!", 1100);
    updateHealthUI();
}

function recoverFromKnockdown() {
    const knockdown = game.knockdown;
    if (!knockdown) return;

    const target = knockdown.target;
    target.recover(CONFIG.getUpHealth);

    game.knockdown = null;
    game.phase = "fight";
    game.keys.clear();
    hideRefereeCount();
    updateHealthUI();

    fightStatus.textContent = `ROUND ${game.currentRound}`;
    showMessage(target === player ? "BACK ON YOUR FEET!" : "RIVAL GETS UP!", 1400);
}

function updateKnockdown(delta) {
    const knockdown = game.knockdown;
    if (!knockdown) return;

    knockdown.elapsed += delta;
    knockdown.countAccumulator += delta;

    while (knockdown.countAccumulator >= 1 && knockdown.count < CONFIG.knockdownCount) {
        knockdown.countAccumulator -= 1;
        knockdown.count += 1;
        world.updateRefereeCount(knockdown.count);

        if (refereeCount) {
            refereeCount.textContent = knockdown.isPlayer
                ? `REFEREE COUNT: ${knockdown.count} — SPACE ${knockdown.getUpPresses}/${CONFIG.playerGetUpPresses}`
                : `REFEREE COUNT: ${knockdown.count}`;
        }

        if (
            !knockdown.isPlayer &&
            knockdown.count >= 6 &&
            game.knockdowns.opponent < 3
        ) {
            recoverFromKnockdown();
            return;
        }
    }

    if (
        knockdown.isPlayer &&
        knockdown.getUpPresses >= CONFIG.playerGetUpPresses &&
        knockdown.count < CONFIG.knockdownCount
    ) {
        recoverFromKnockdown();
        return;
    }

    if (knockdown.count >= CONFIG.knockdownCount) {
        finishMatch(
            knockdown.isPlayer ? "RIVAL WINS — TKO" : "YOU WIN — TKO",
            `The referee completed the ten-count. Knockdowns this match: you ${game.knockdowns.player}, rival ${game.knockdowns.opponent}.`
        );
    }
}

function applyDamage(target, amount) {
    if (game.finished || game.phase !== "fight" || !target || target.isKnockedDown) return;

    const actualDamage = target.takeDamage(amount);
    if (actualDamage <= 0) return;

    if (target === opponent) {
        game.roundDamage.player += actualDamage;
    } else {
        game.roundDamage.opponent += actualDamage;
    }

    updateHealthUI();

    if (target.health <= 0) {
        startKnockdown(target);
    }
}

function resolvePunch(attacker, target, baseDamage) {
    if (
        game.finished ||
        game.phase !== "fight" ||
        !attacker?.isAttacking ||
        target?.isKnockedDown
    ) {
        return false;
    }

    const hit = punchHitsHurtboxes(
        attacker.getPunchHitbox(),
        target.getHurtboxes()
    );

    if (!hit || !attacker.registerAttackHit()) return false;

    const multiplier = hit.zone === "head"
        ? 1.3
        : hit.zone === "body"
            ? 1.05
            : 0.85;

    const direction = attacker.getForwardVector();
    target.position.x += direction.x * 0.16;
    target.position.z += direction.z * 0.16;
    clampFighterToRing(target);

    applyDamage(target, baseDamage * multiplier);
    showMessage(
        hit.zone === "head" ? "CLEAN HEAD SHOT!" : "SOLID BODY SHOT!",
        520
    );
    return true;
}

function clampFighterToRing(fighter) {
    clampFighterPosition(
        fighter.position,
        CONFIG.fighterRadius,
        CONFIG.arenaBounds
    );
}

function resolveFighterCollision(first, second) {
    resolveFighterPair(
        first.position,
        second.position,
        CONFIG.fighterRadius,
        CONFIG.fighterRadius,
        CONFIG.arenaBounds,
        6
    );
}

function updatePlayer(delta) {
    const movementX =
        Number(game.keys.has("KeyD")) -
        Number(game.keys.has("KeyA"));

    const movementZ =
        Number(game.keys.has("KeyS")) -
        Number(game.keys.has("KeyW"));

    player.setBlocking(game.keys.has("KeyK"));

    const speed = CONFIG.playerSpeed * (player.isDodging ? 2.4 : 1);
    player.move(movementX, movementZ, delta, speed);
    clampFighterToRing(player);

    player.setFacing(opponent.position.x - player.position.x);
}

function updateOpponent(delta) {
    const differenceX = player.position.x - opponent.position.x;
    const differenceZ = player.position.z - opponent.position.z;
    const distance = Math.hypot(differenceX, differenceZ);

    opponent.setFacing(differenceX);

    if (distance > CONFIG.opponentAttackRange) {
        opponent.move(
            differenceX,
            differenceZ,
            delta,
            CONFIG.opponentSpeed
        );
    } else {
        opponent.move(0, 0, delta, CONFIG.opponentSpeed);
        opponent.attack();
    }

    clampFighterToRing(opponent);
}

function playerAttack() {
    if (game.paused || game.finished || game.phase !== "fight") return;
    player.attack();
}

function playerDodgeOrGetUp() {
    if (game.paused || game.finished) return;

    if (game.phase === "knockdown") {
        if (game.knockdown?.isPlayer) {
            game.knockdown.getUpPresses += 1;

            if (refereeCount) {
                refereeCount.textContent =
                    `REFEREE COUNT: ${game.knockdown.count} — SPACE ${game.knockdown.getUpPresses}/${CONFIG.playerGetUpPresses}`;
            }
        }
        return;
    }

    if (game.phase === "fight") player.dodge();
}

function awardRound() {
    if (game.roundDamage.player > game.roundDamage.opponent) {
        game.roundWins.player += 1;
        showMessage("ROUND TO YOU!", 1500);
    } else if (game.roundDamage.player < game.roundDamage.opponent) {
        game.roundWins.opponent += 1;
        showMessage("ROUND TO THE RIVAL!", 1500);
    } else {
        showMessage("EVEN ROUND!", 1500);
    }

    updateScoreUI();
}

function beginNextRound() {
    game.currentRound += 1;

    if (game.currentRound > CONFIG.rounds) {
        decisionResult();
        return;
    }

    player.standUp();
    opponent.standUp();

    player.position.set(-2.3, 0.18, 0);
    opponent.position.set(2.3, 0.18, 0);
    player.setFacing(1);
    opponent.setFacing(-1);

    game.roundDamage.player = 0;
    game.roundDamage.opponent = 0;
    game.timeRemaining = CONFIG.roundDuration;
    game.breakRemaining = 0;
    game.phase = "fight";
    game.lastDisplayedSecond = -1;

    updateScoreUI();
    updateTimerUI(true);
    fightStatus.textContent = `ROUND ${game.currentRound}`;
    showMessage(`ROUND ${game.currentRound} — FIGHT!`, 1800);
}

function endRound() {
    if (game.phase !== "fight" || game.finished) return;

    game.keys.clear();
    player.setBlocking(false);

    awardRound();

    if (game.currentRound >= CONFIG.rounds) {
        decisionResult();
        return;
    }

    game.phase = "break";
    game.breakRemaining = CONFIG.breakDuration;
    game.timeRemaining = CONFIG.breakDuration;
    game.lastDisplayedSecond = -1;
    fightStatus.textContent = "ROUND BREAK";
    updateTimerUI(true);
}

function updateMatch(delta) {
    if (game.paused || game.finished) return;

    player.update(delta);
    opponent.update(delta);

    if (game.phase === "knockdown") {
        updateKnockdown(delta);
        return;
    }

    if (game.phase === "break") {
        game.breakRemaining = Math.max(0, game.breakRemaining - delta);
        game.timeRemaining = game.breakRemaining;
        updateTimerUI();

        if (game.breakRemaining <= 0) beginNextRound();
        return;
    }

    updatePlayer(delta);
    updateOpponent(delta);
    resolveFighterCollision(player, opponent);

    resolvePunch(player, opponent, CONFIG.playerDamage);
    resolvePunch(opponent, player, CONFIG.opponentDamage);

    game.timeRemaining = Math.max(0, game.timeRemaining - delta);
    updateTimerUI();

    if (game.timeRemaining <= 0) endRound();
}

function setPaused(paused) {
    if (game.finished || game.phase !== "fight") return;

    game.paused = paused;
    game.keys.clear();

    if (pauseMenu) pauseMenu.hidden = !paused;
    fightStatus.textContent = paused ? "PAUSED" : `ROUND ${game.currentRound}`;
}

function togglePause() {
    setPaused(!game.paused);
}

if (resumeButton) {
    resumeButton.addEventListener("click", () => setPaused(false));
}

if (rematchButton) {
    rematchButton.addEventListener("click", () => window.location.reload());
}

const CONTROL_KEYS = new Set([
    "KeyW", "KeyA", "KeyS", "KeyD",
    "KeyJ", "KeyK", "Space", "Escape", "F3"
]);

window.addEventListener("keydown", (event) => {
    if (CONTROL_KEYS.has(event.code)) event.preventDefault();

    if (event.code === "F3" && !event.repeat) {
        setHitboxDebug(!game.debugHitboxes);
        return;
    }

    if (
        event.code === "Escape" &&
        !event.repeat &&
        !game.finished &&
        game.phase === "fight"
    ) {
        togglePause();
        return;
    }

    if (event.repeat || game.paused || game.finished) return;

    if (event.code === "Space") {
        playerDodgeOrGetUp();
        return;
    }

    if (game.phase !== "fight") return;

    game.keys.add(event.code);

    if (event.code === "KeyJ") playerAttack();
});

window.addEventListener("keyup", (event) => {
    game.keys.delete(event.code);
});

window.addEventListener("blur", () => {
    game.keys.clear();
    if (!game.paused && !game.finished && game.phase === "fight") {
        setPaused(true);
    }
});

document.addEventListener("visibilitychange", () => {
    if (
        document.hidden &&
        !game.paused &&
        !game.finished &&
        game.phase === "fight"
    ) {
        setPaused(true);
    }
});

function animate() {
    try {
        const delta = Math.min(world ? world.clock.getDelta() : 0, 0.05);
        game.elapsed += delta;

        if (world) {
            if (!game.paused && !game.finished) updateMatch(delta);

            world.update(
                delta,
                game.elapsed,
                player?.position,
                opponent?.position
            );

            updateHitboxDebug();
            world.renderer.render(world.scene, world.camera);
        }
    } catch (error) {
        showEngineFailure(error, "rendering the first or a later frame");
        return false;
    }

    requestAnimationFrame(animate);
    return true;
}

window.addEventListener("resize", () => {
    if (world) world.resize();
});

function showEngineFailure(error, phase = startupPhase) {
    const detail = error instanceof Error ? error.message : String(error);

    console.error(`SMASHERS INITIALIZATION FAILED during ${phase}:`, error);

    if (loadingScreen) loadingScreen.classList.remove("hidden");
    if (loadingStatus) {
        loadingStatus.textContent =
            `ENGINE INITIALIZATION FAILED (${phase}): ${detail}`;
    }
    if (fightStatus) fightStatus.textContent = "ERROR";
    if (loadingProgress) loadingProgress.style.width = "0%";
}

function installQaBridge() {
    if (new URLSearchParams(window.location.search).get("qa") !== "1") return;

    function inspectModel(fighter) {
        let meshCount = 0;
        let visibleMeshCount = 0;
        fighter.root.traverse((object) => {
            if (!object.isMesh) return;
            meshCount += 1;
            if (object.visible) visibleMeshCount += 1;
        });

        if (!fighter.state.model) {
            return { meshCount, visibleMeshCount, bounds: null, localPosition: null, localScale: null };
        }

        const model = fighter.state.model;
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const meshDetails = [];

        model.traverse((object) => {
            if (!object.isMesh) return;

            const meshBounds = new THREE.Box3().setFromObject(object);
            const meshSize = meshBounds.getSize(new THREE.Vector3());
            const materials = Array.isArray(object.material) ? object.material : [object.material];

            meshDetails.push({
                name: object.name,
                type: object.type,
                visible: object.visible,
                worldSize: meshSize.toArray(),
                materialColors: materials
                    .filter((material) => material?.color)
                    .map((material) => material.color.getHexString())
            });
        });

        return {
            meshCount,
            visibleMeshCount,
            rawSourceSize: fighter.state.modelRawSourceSize,
            sourceSize: fighter.state.modelSourceSize,
            appliedFitScale: fighter.state.modelScale,
            scaledSourceSize: fighter.state.modelScaledSize,
            expectedBounds: fighter.state.modelExpectedBounds,
            localPosition: model.position.toArray(),
            localRotation: model.rotation.toArray(),
            localScale: model.scale.toArray(),
            accessoryTransforms: fighter.state.accessoryTransforms,
            bounds: {
                min: bounds.min.toArray(),
                max: bounds.max.toArray(),
                size: size.toArray(),
                center: center.toArray()
            },
            meshDetails
        };
    }

    function inspectRigPose(fighter) {
        fighter.root.updateMatrixWorld(true);
        const names = [
            "ShoulderL", "UpperArmL", "LowerArmL", "WristL",
            "ShoulderR", "UpperArmR", "LowerArmR", "WristR",
            "Hips", "Chest", "Head"
        ];

        return Object.fromEntries(names.map((name) => {
            const bone = fighter.state.modelBones.get(name);
            if (!bone) return [name, null];

            return [name, {
                localPosition: bone.position.toArray(),
                localRotation: bone.rotation.toArray(),
                localScale: bone.scale.toArray(),
                worldPosition: bone.getWorldPosition(new THREE.Vector3()).toArray(),
                worldScale: bone.getWorldScale(new THREE.Vector3()).toArray()
            }];
        }));
    }

    function countInstancedMeshes(group) {
        let count = 0;
        group.traverse((object) => {
            if (object.isInstancedMesh) count += 1;
        });
        return count;
    }

    function snapshot() {
        const gl = world.renderer.getContext();
        const webglVersion = gl.getParameter(gl.VERSION);
        const width = Math.max(1, viewport.clientWidth || window.innerWidth);
        const height = Math.max(1, viewport.clientHeight || window.innerHeight);
        world.camera.updateMatrixWorld(true);

        const project = (point) => {
            const projected = point.clone().project(world.camera);
            return {
                x: (projected.x * 0.5 + 0.5) * width,
                y: (-projected.y * 0.5 + 0.5) * height
            };
        };

        const ringScreenPoints = [
            [-6, 0.18, -3.5], [6, 0.18, -3.5],
            [-6, 0.18, 3.5], [6, 0.18, 3.5]
        ].map(([x, y, z]) => project(new THREE.Vector3(x, y, z)));
        const ringScreenWidth = Math.max(...ringScreenPoints.map(point => point.x)) -
            Math.min(...ringScreenPoints.map(point => point.x));

        const projectedModelHeight = (fighter) => {
            const modelRoot = fighter.state.model || fighter.root;
            const bounds = new THREE.Box3().setFromObject(modelRoot);
            const corners = [];
            for (const x of [bounds.min.x, bounds.max.x]) {
                for (const y of [bounds.min.y, bounds.max.y]) {
                    for (const z of [bounds.min.z, bounds.max.z]) {
                        corners.push(project(new THREE.Vector3(x, y, z)));
                    }
                }
            }
            return Math.max(...corners.map(point => point.y)) -
                Math.min(...corners.map(point => point.y));
        };

        const boxingGear = (fighter) => {
            const counts = { singlets: 0, trunks: 0, gloves: 0, waistbands: 0 };
            fighter.root.traverse((object) => {
                if (!object.isMesh) return;
                if (object.name === "SmashersBoxingSinglet") counts.singlets += 1;
                if (object.name === "SmashersBoxingTrunks") counts.trunks += 1;
                if (object.name.startsWith("SmashersBoxingGlove.")) counts.gloves += 1;
                if (object.name === "SmashersTrunksWaistband") counts.waistbands += 1;
            });
            return counts;
        };

        return {
            build: BUILD_LABEL,
            threeRevision: THREE.REVISION,
            webglVersion,
            sceneChildren: world.scene.children.length,
            framing: {
                ringWidthFraction: ringScreenWidth / width,
                playerHeightPixels: projectedModelHeight(player),
                opponentHeightPixels: projectedModelHeight(opponent)
            },
            boxingGear: {
                player: boxingGear(player),
                opponent: boxingGear(opponent)
            },
            camera: {
                position: world.camera.position.toArray(),
                aspect: world.camera.aspect,
                fov: world.camera.fov
            },
            player: {
                attached: player.root.parent === world.scene,
                modelLoaded: Boolean(player.state.model),
                model: inspectModel(player),
                animationActions: [...player.state.actions.keys()],
                activeAnimation: player.state.activeActionName,
                wristExtensionWorld: player.state.wristExtensionWorld ?? 0,
                wristParentWorldScale: player.state.wristParentWorldScale ?? null,
                wristExtensionLocal: player.state.wristExtensionLocal ?? 0,
                rigPose: inspectRigPose(player),
                bones: [...player.state.modelBones.keys()],
                modelBoneNames: (() => {
                    const names = [];
                    player.state.model?.traverse((object) => {
                        if (object.isBone) names.push(object.name);
                    });
                    return names;
                })(),
                hurtboxes: player.getHurtboxes().map((box) => ({
                    zone: box.zone,
                    radius: box.radius,
                    start: box.start.toArray(),
                    end: box.end.toArray(),
                    center: box.center.toArray()
                })),
                position: player.position.toArray(),
                health: player.health
            },
            opponent: {
                attached: opponent.root.parent === world.scene,
                modelLoaded: Boolean(opponent.state.model),
                model: inspectModel(opponent),
                animationActions: [...opponent.state.actions.keys()],
                activeAnimation: opponent.state.activeActionName,
                wristExtensionWorld: opponent.state.wristExtensionWorld ?? 0,
                wristParentWorldScale: opponent.state.wristParentWorldScale ?? null,
                wristExtensionLocal: opponent.state.wristExtensionLocal ?? 0,
                rigPose: inspectRigPose(opponent),
                bones: [...opponent.state.modelBones.keys()],
                modelBoneNames: (() => {
                    const names = [];
                    opponent.state.model?.traverse((object) => {
                        if (object.isBone) names.push(object.name);
                    });
                    return names;
                })(),
                hurtboxes: opponent.getHurtboxes().map((box) => ({
                    zone: box.zone,
                    radius: box.radius,
                    start: box.start.toArray(),
                    end: box.end.toArray(),
                    center: box.center.toArray()
                })),
                position: opponent.position.toArray(),
                health: opponent.health
            },
            crowd: {
                attached: world.crowd.parent === world.scene,
                instancedMeshes: countInstancedMeshes(world.crowd),
                audienceObjects: world.crowd.children.length
            },
            referee: {
                attached: world.referee.parent === world.scene,
                name: world.referee.name
            },
            hitboxDebugVisible: Boolean(hitboxDebugGroups?.player.group.visible),
            match: {
                phase: game.phase,
                round: game.currentRound,
                finished: game.finished
            }
        };
    }

    function testPunchContact(attackerName = "player") {
        const attacker = attackerName === "opponent" ? opponent : player;
        const target = attacker === player ? opponent : player;
        const attackerPosition = attacker.position.clone();
        const targetPosition = target.position.clone();
        const originalPhase = game.phase;
        const originalPaused = game.paused;
        const originalFinished = game.finished;

        try {
            game.phase = "fight";
            game.paused = false;
            game.finished = false;

            attacker.reset();
            target.reset();

            attacker.position.set(-1.1, 0.18, 0);
            target.position.set(1.1, 0.18, 0);
            attacker.setFacing(target.position.x - attacker.position.x);
            target.setFacing(attacker.position.x - target.position.x);

            if (!attacker.attack()) {
                return { hit: false, reason: "attacker refused to start an attack" };
            }

            attacker.update(0.016);

            const punch = attacker.getPunchHitbox();
            const hurtboxes = target.getHurtboxes();
            if (!hurtboxes.length) {
                return { hit: false, reason: "target has no available hurtboxes" };
            }

            const selected = hurtboxes
                .slice()
                .sort((a, b) => {
                    const distanceA = a.center.distanceToSquared(punch.end);
                    const distanceB = b.center.distanceToSquared(punch.end);
                    return distanceA - distanceB;
                })[0];

            // Place the selected physical hurtbox at the actual glove endpoint.
            // This is an isolated QA fixture, not part of normal gameplay.
            target.position.add(punch.end.clone().sub(selected.center));

            const healthBefore = target.health;
            const landed = resolvePunch(attacker, target, CONFIG.playerDamage);
            const healthAfter = target.health;

            return {
                hit: landed && healthAfter < healthBefore,
                landed,
                zone: selected.zone,
                damage: healthBefore - healthAfter,
                punch: {
                    start: punch.start.toArray(),
                    end: punch.end.toArray(),
                    radius: punch.radius
                },
                targetPosition: target.position.toArray()
            };
        } finally {
            attacker.reset();
            target.reset();
            attacker.position.copy(attackerPosition);
            target.position.copy(targetPosition);
            game.phase = originalPhase;
            game.paused = originalPaused;
            game.finished = originalFinished;
            updateHealthUI();
        }
    }

    function testNaturalPunchSweep(attackerName = "player") {
        const attacker = attackerName === "opponent" ? opponent : player;
        const target = attacker === player ? opponent : player;
        const originalAttackerPosition = attacker.position.clone();
        const originalTargetPosition = target.position.clone();
        const originalPhase = game.phase;
        const originalPaused = game.paused;
        const originalFinished = game.finished;
        const originalRoundDamage = { ...game.roundDamage };
        const originalKnockdowns = { ...game.knockdowns };
        const distances = [0.88, 0.95, 1.05, 1.15, 1.25, 1.35, 1.5];
        const results = [];

        try {
            game.phase = "fight";
            game.paused = false;
            game.finished = false;

            for (const distance of distances) {
                attacker.reset();
                target.reset();
                attacker.position.set(-distance / 2, 0.18, 0);
                target.position.set(distance / 2, 0.18, 0);
                attacker.setFacing(target.position.x - attacker.position.x);
                target.setFacing(attacker.position.x - target.position.x);

                const started = attacker.attack();
                let hit = false;
                let zone = null;
                let damage = 0;
                let fist = null;
                let maxForwardReach = -Infinity;
                let minimumContactGap = Infinity;
                let maxWorldExtension = 0;
                let peakFist = null;

                if (started) {
                    for (let frame = 0; frame < 16; frame += 1) {
                        attacker.update(1 / 60);
                        target.update(1 / 60);

                        fist = attacker.getPunchHitbox();
                        const forward = attacker.getForwardVector();
                        const reach = fist.end.clone()
                            .sub(attacker.position)
                            .dot(forward);
                        maxWorldExtension = Math.max(
                            maxWorldExtension,
                            attacker.state.wristExtensionWorld ?? 0
                        );

                        if (reach > maxForwardReach) {
                            maxForwardReach = reach;
                            peakFist = {
                                start: fist.start.toArray(),
                                end: fist.end.toArray(),
                                radius: fist.radius
                            };
                        }

                        const hurtboxes = target.getHurtboxes();
                        for (const box of hurtboxes) {
                            const hurtStart = box.start || box.center;
                            const hurtEnd = box.end || box.center;
                            const closestDistance = Math.sqrt(
                                segmentSegmentDistanceSquared(
                                    fist.start,
                                    fist.end,
                                    hurtStart,
                                    hurtEnd
                                )
                            );
                            const gap = closestDistance - fist.radius - box.radius;
                            minimumContactGap = Math.min(minimumContactGap, gap);
                        }

                        const hurtbox = punchHitsHurtboxes(fist, hurtboxes);
                        if (!hurtbox) continue;

                        zone = hurtbox.zone;
                        const before = target.health;
                        hit = resolvePunch(
                            attacker,
                            target,
                            attacker === player
                                ? CONFIG.playerDamage
                                : CONFIG.opponentDamage
                        );
                        damage = before - target.health;
                        if (hit) break;
                    }
                }

                const forward = attacker.getForwardVector();
                const gloveOffset = fist
                    ? fist.end.clone().sub(attacker.position)
                    : new THREE.Vector3();

                results.push({
                    distance,
                    started,
                    hit,
                    zone,
                    damage,
                    maxGloveForwardReach: maxForwardReach,
                    minimumContactGap,
                    maxWorldExtension,
                    animationActions: [...attacker.state.actions.keys()],
                    finalGloveForwardReach: gloveOffset.dot(forward),
                    peakFist,
                    glove: fist
                        ? {
                            start: fist.start.toArray(),
                            end: fist.end.toArray(),
                            radius: fist.radius
                        }
                        : null
                });
            }

            return results;
        } finally {
            attacker.reset();
            target.reset();
            attacker.position.copy(originalAttackerPosition);
            target.position.copy(originalTargetPosition);
            game.phase = originalPhase;
            game.paused = originalPaused;
            game.finished = originalFinished;
            game.roundDamage = originalRoundDamage;
            game.knockdowns = originalKnockdowns;
            updateHealthUI();
        }
    }

    window.__SMASHERS_QA__ = {
        snapshot,
        setHitboxDebug,
        testPunchContact,
        testNaturalPunchSweep
    };
}

async function startGame() {
    try {
        await initializeWorld();
        startupPhase = "starting the renderer";

        installQaBridge();

        if (!animate()) return;

        console.info(
            `SMASHERS ${BUILD_LABEL} READY — THREE.JS REVISION ${THREE.REVISION}`
        );
    } catch (error) {
        showEngineFailure(error);
    }
}

startGame();
