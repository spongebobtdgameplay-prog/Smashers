
import * as THREE from "../engine/three/three.module.js?v=20261030-webgl1-fallback-2";
import { createWorld } from "./world.js?v=20261030-webgl1-fallback-2";
import { createFighter } from "./player.js";
import { ServerPatcher } from "./v1-server.js";

// ============================================
// SMASHERS — MAIN APPLICATION
// ============================================

const $ = (id) => document.getElementById(id);

const canvas = $("smashers-canvas");
const viewport = $("game-viewport");
const loadingScreen = $("loading-screen");
const loadingProgress = $("loading-progress");
const loadingStatus = $("loading-status");

const pauseMenu = $("pause-menu");
const resumeButton = $("resume-button");

const playerHealthBar = $("player-health");
const opponentHealthBar = $("opponent-health");
const playerHealthValue = $("player-health-value");
const opponentHealthValue = $("opponent-health-value");

const fightTimer = $("fight-timer");
const fightStatus = $("fight-status");
const gameMessage = $("game-message");

if (!canvas || !viewport) {
    throw new Error("Smashers: Game canvas or viewport is missing.");
}

const CONFIG = Object.freeze({
    matchDuration: 180,
    playerSpeed: 4.4,
    opponentSpeed: 2.35,
    playerDamage: 12,
    opponentDamage: 8,
    playerAttackRange: 2.05,
    opponentAttackRange: 1.9,
    arenaBounds: {
        minX: -5.0,
        maxX: 5.0,
        minZ: -2.65,
        maxZ: 2.65
    }
});

const game = {
    paused: false,
    finished: false,
    timeRemaining: CONFIG.matchDuration,
    keys: new Set(),
    elapsed: 0,
    lastDisplayedSecond: -1
};

let world;
let player;
let opponent;
let messageTimeout = null;
let startupPhase = "application startup";

// ============================================
// SERVER PATCHER
// ============================================

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

// V1 is not deployed yet. Keep the registry initialized locally,
// but do not make a network request during the offline prototype.

// ============================================
// WORLD AND FIGHTERS
// ============================================

function initializeWorld() {
    startupPhase = "initializing Three.js renderer";
    loadingStatus.textContent = "INITIALIZING THREE.JS...";
    loadingProgress.style.width = "20%";

    world = createWorld(THREE, canvas, viewport);

    startupPhase = "building the arena and fighters";
    loadingStatus.textContent = "BUILDING THE ARENA...";
    loadingProgress.style.width = "50%";

    player = createFighter(THREE, {
        name: "PLAYER",
        color: 0x29313d,
        gloveColor: 0xe52d42,
        position: [-2.3, 0.18, 0]
    });

    opponent = createFighter(THREE, {
        name: "RIVAL",
        color: 0x292b36,
        gloveColor: 0x315dff,
        position: [2.3, 0.18, 0]
    });

    player.setFacing(1);
    opponent.setFacing(-1);

    const playerName = $("player-name");
    const opponentName = $("opponent-name");

    if (playerName) playerName.textContent = player.name;
    if (opponentName) opponentName.textContent = opponent.name;

    startupPhase = "preparing fighters and HUD";
    loadingStatus.textContent = "PREPARING FIGHTERS...";
    loadingProgress.style.width = "80%";

    updateHealthUI();
    updateTimerUI();

    loadingStatus.textContent = "READY";
    loadingProgress.style.width = "100%";

    if (loadingScreen) {
        loadingScreen.classList.add("hidden");
    }

    game.elapsed = 0;
    fightStatus.textContent = "FIGHT";
}

// ============================================
// HUD
// ============================================

function updateHealthUI() {
    if (!player || !opponent) return;

    const playerHealth = Math.ceil(player.health);
    const opponentHealth = Math.ceil(opponent.health);

    playerHealthBar.style.width = `${playerHealth}%`;
    opponentHealthBar.style.width = `${opponentHealth}%`;

    playerHealthValue.textContent = playerHealth;
    opponentHealthValue.textContent = opponentHealth;
}

function updateTimerUI(force = false) {
    const displayedSecond = Math.max(
        0,
        Math.ceil(game.timeRemaining)
    );

    if (!force && displayedSecond === game.lastDisplayedSecond) {
        return;
    }

    game.lastDisplayedSecond = displayedSecond;

    const minutes = Math.floor(displayedSecond / 60);
    const seconds = displayedSecond % 60;

    fightTimer.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function showMessage(message) {
    if (!gameMessage) return;

    gameMessage.textContent = message;
    gameMessage.classList.add("visible");

    if (messageTimeout !== null) {
        window.clearTimeout(messageTimeout);
    }

    messageTimeout = window.setTimeout(() => {
        gameMessage.classList.remove("visible");
        messageTimeout = null;
    }, 1500);
}

// ============================================
// DAMAGE AND MATCH RESULTS
// ============================================

function applyDamage(target, amount) {
    if (game.finished || !target) return;

    const actualDamage = target.takeDamage(amount);

    updateHealthUI();

    if (actualDamage <= 0) {
        return;
    }

    if (target.health <= 0) {
        finishMatch(
            target === opponent ? "YOU WIN!" : "YOU LOSE!"
        );
    }
}

function finishMatch(result) {
    if (game.finished) return;

    game.finished = true;
    game.keys.clear();

    fightStatus.textContent = result;
    showMessage(result);
}

// ============================================
// PLAYER INPUT AND MOVEMENT
// ============================================

function updatePlayer(delta) {
    const movementX =
        Number(game.keys.has("KeyD")) -
        Number(game.keys.has("KeyA"));

    const movementZ =
        Number(game.keys.has("KeyS")) -
        Number(game.keys.has("KeyW"));

    player.update(delta);

    player.setBlocking(game.keys.has("KeyK"));

    const speed = CONFIG.playerSpeed *
        (player.isDodging ? 2.4 : 1);

    player.move(
        movementX,
        movementZ,
        delta,
        speed
    );

    const bounds = CONFIG.arenaBounds;

    player.position.x = THREE.MathUtils.clamp(
        player.position.x,
        bounds.minX,
        bounds.maxX
    );

    player.position.z = THREE.MathUtils.clamp(
        player.position.z,
        bounds.minZ,
        bounds.maxZ
    );

    player.setFacing(
        opponent.position.x - player.position.x
    );
}

// ============================================
// OPPONENT AI
// ============================================

function updateOpponent(delta) {
    opponent.update(delta);

    const differenceX =
        player.position.x - opponent.position.x;

    const differenceZ =
        player.position.z - opponent.position.z;

    const distance = Math.hypot(
        differenceX,
        differenceZ
    );

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

        // The fighter's internal cooldown ensures
        // only one attack is triggered per attack cycle.
        if (opponent.attack()) {
            applyDamage(player, CONFIG.opponentDamage);
        }
    }

    const bounds = CONFIG.arenaBounds;

    opponent.position.x = THREE.MathUtils.clamp(
        opponent.position.x,
        bounds.minX,
        bounds.maxX
    );

    opponent.position.z = THREE.MathUtils.clamp(
        opponent.position.z,
        bounds.minZ,
        bounds.maxZ
    );
}

// ============================================
// PLAYER COMBAT
// ============================================

function playerAttack() {
    if (game.paused || game.finished) return;

    if (!player.attack()) return;

    const distanceX = Math.abs(
        opponent.position.x - player.position.x
    );

    const distanceZ = Math.abs(
        opponent.position.z - player.position.z
    );

    const inRange =
        Math.hypot(distanceX, distanceZ) <=
        CONFIG.playerAttackRange;

    if (inRange) {
        applyDamage(opponent, CONFIG.playerDamage);
    }
}

function playerDodge() {
    if (game.paused || game.finished) return;

    player.dodge();
}

// ============================================
// MATCH TIMER
// ============================================

function updateMatchTimer(delta) {
    if (game.paused || game.finished) return;

    game.timeRemaining = Math.max(
        0,
        game.timeRemaining - delta
    );

    updateTimerUI();

    if (game.timeRemaining <= 0) {
        if (player.health > opponent.health) {
            finishMatch("YOU WIN!");
        } else if (player.health < opponent.health) {
            finishMatch("YOU LOSE!");
        } else {
            finishMatch("DRAW!");
        }
    }
}

// ============================================
// PAUSE SYSTEM
// ============================================

function setPaused(paused) {
    if (game.finished) return;

    game.paused = paused;
    game.keys.clear();

    if (pauseMenu) {
        pauseMenu.hidden = !paused;
    }

    fightStatus.textContent = paused ? "PAUSED" : "FIGHT";
}

function togglePause() {
    setPaused(!game.paused);
}

if (resumeButton) {
    resumeButton.addEventListener("click", () => {
        setPaused(false);
    });
}

// ============================================
// KEYBOARD
// ============================================

const CONTROL_KEYS = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyJ",
    "KeyK",
    "Space",
    "Escape"
]);

window.addEventListener("keydown", (event) => {
    if (CONTROL_KEYS.has(event.code)) {
        event.preventDefault();
    }

    if (
        event.code === "Escape" &&
        !event.repeat &&
        !game.finished
    ) {
        togglePause();
        return;
    }

    if (
        event.repeat ||
        game.paused ||
        game.finished
    ) {
        return;
    }

    game.keys.add(event.code);

    if (event.code === "KeyJ") {
        playerAttack();
    }

    if (event.code === "Space") {
        playerDodge();
    }
});

window.addEventListener("keyup", (event) => {
    game.keys.delete(event.code);
});

window.addEventListener("blur", () => {
    game.keys.clear();

    if (!game.paused && !game.finished) {
        setPaused(true);
    }
});

document.addEventListener("visibilitychange", () => {
    if (
        document.hidden &&
        !game.paused &&
        !game.finished
    ) {
        setPaused(true);
    }
});

// ============================================
// MAIN GAME UPDATE
// ============================================

function update(delta) {
    if (game.paused || game.finished) return;

    updatePlayer(delta);
    updateOpponent(delta);
    updateMatchTimer(delta);
}

// ============================================
// RENDER LOOP
// ============================================

function animate() {
    try {
        const delta = Math.min(
            world ? world.clock.getDelta() : 0,
            0.05
        );

        game.elapsed += delta;

        if (world) {
            if (!game.paused && !game.finished) {
                update(delta);
            }

            world.update(delta, game.elapsed);
            world.renderer.render(world.scene, world.camera);
        }
    } catch (error) {
        showEngineFailure(error, "rendering the first or a later frame");
        return false;
    }

    requestAnimationFrame(animate);
    return true;
}

// ============================================
// RESIZE
// ============================================

window.addEventListener("resize", () => {
    if (world) {
        world.resize();
    }
});

// ============================================
// START
// ============================================

function showEngineFailure(error, phase = startupPhase) {
    const detail = error instanceof Error
        ? error.message
        : String(error);

    console.error(
        `SMASHERS INITIALIZATION FAILED during ${phase}:`,
        error
    );

    if (loadingScreen) {
        loadingScreen.classList.remove("hidden");
    }

    if (loadingStatus) {
        loadingStatus.textContent =
            `ENGINE INITIALIZATION FAILED (${phase}): ${detail}`;
    }

    if (fightStatus) {
        fightStatus.textContent = "ERROR";
    }

    if (loadingProgress) {
        loadingProgress.style.width = "0%";
    }
}

function startGame() {
    try {
        initializeWorld();
        startupPhase = "starting the renderer";

        if (!animate()) {
            return;
        }

        console.info(
            `SMASHERS READY — THREE.JS REVISION ${THREE.REVISION}`
        );
    } catch (error) {
        showEngineFailure(error);
    }
}

startGame();
