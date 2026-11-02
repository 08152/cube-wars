
import * as THREE from "three";

/* ==========================================
   CUBE WARS
   GAME ENGINE - game.js
========================================== */

const canvas = document.getElementById("game-canvas");

if (!canvas) {
    throw new Error("CUBE WARS: #game-canvas wurde nicht gefunden!");
}

// ------------------------------------------
// KONFIGURATION
// ------------------------------------------

const CONFIG = {
    fov: 85,
    near: 0.05,
    far: 1000,

    gravity: 24,
    jumpForce: 8.5,

    walkSpeed: 6,
    sprintSpeed: 10,
    crouchSpeed: 2.8,

    mouseSensitivity: 0.002,

    maxHealth: 100,
    maxShield: 100,
    maxStamina: 100,

    staminaDrain: 28,
    staminaRecovery: 20,

    playerHeight: 1.8,
    crouchHeight: 1.1,

    eyeHeight: 1.62,
    crouchEyeHeight: 0.95
};

// ------------------------------------------
// THREE.JS GRUNDLAGE
// ------------------------------------------

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x111722);

const camera = new THREE.PerspectiveCamera(
    CONFIG.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.near,
    CONFIG.far
);

camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.outputColorSpace = THREE.SRGBColorSpace;

// Keine Weltobjekte: vorerst nur der Spieler und die Kamera.
camera.position.set(0, CONFIG.eyeHeight, 0);
scene.add(camera);

// ------------------------------------------
// SPIELER
// ------------------------------------------

const player = {
    position: new THREE.Vector3(0, 0, 0),
    velocity: new THREE.Vector3(0, 0, 0),

    health: CONFIG.maxHealth,
    maxHealth: CONFIG.maxHealth,

    shield: CONFIG.maxShield,
    maxShield: CONFIG.maxShield,

    stamina: CONFIG.maxStamina,
    maxStamina: CONFIG.maxStamina,

    speed: CONFIG.walkSpeed,

    grounded: true,
    crouching: false,
    sprinting: false,
    moving: false,

    alive: true,
    kills: 0,

    selectedSlot: 1,

    eyeHeight: CONFIG.eyeHeight,

    // Später für Inventar und Waffen.
    inventory: [
        { name: "ENERGIEBLASTER", ammo: 30, maxAmmo: 30 },
        { name: "LEER", ammo: 0, maxAmmo: 0 },
        { name: "LEER", ammo: 0, maxAmmo: 0 },
        { name: "LEER", ammo: 0, maxAmmo: 0 },
        { name: "LEER", ammo: 0, maxAmmo: 0 }
    ]
};

// ------------------------------------------
// KAMERA
// ------------------------------------------

let yaw = 0;
let pitch = 0;

const PITCH_LIMIT = Math.PI / 2 - 0.01;

// ------------------------------------------
// TASTEN
// ------------------------------------------

const keys = {};

let gameStarted = false;
let paused = false;

const clock = new THREE.Clock();

let frameDelta = 0;

// ------------------------------------------
// KOLLISIONSSYSTEM
// ------------------------------------------

// Noch keine Welt.
// Später können hier Gebäude, Boden und Objekte
// mit einer eigenen Kollisionsfunktion ergänzt werden.

let collisionHandler = null;

function checkCollision(position) {

    if (!collisionHandler) {
        return false;
    }

    return collisionHandler(position, player);
}

// ------------------------------------------
// UI
// ------------------------------------------

const UI = window.CubeWarsUI;

function updateUI() {

    if (!UI) return;

    UI.updateHealth?.(player.health, player.maxHealth);
    UI.updateShield?.(player.shield, player.maxShield);
    UI.updateStamina?.(player.stamina, player.maxStamina);

    UI.updateKills?.(player.kills);

    UI.selectSlot?.(player.selectedSlot);

    const weapon = player.inventory[player.selectedSlot - 1];

    if (weapon) {
        UI.updateWeapon?.(weapon.name);
        UI.updateAmmo?.(weapon.ammo, weapon.maxAmmo);
    }
}

// ------------------------------------------
// MOUSE LOCK
// ------------------------------------------

function requestMouseLock() {

    if (!player.alive || paused) return;

    canvas.requestPointerLock?.();
}

canvas.addEventListener("click", () => {

    if (!paused && player.alive) {
        requestMouseLock();
    }

});

// ------------------------------------------
// MOUSE BEWEGUNG
// ------------------------------------------

document.addEventListener("mousemove", event => {

    if (document.pointerLockElement !== canvas) return;
    if (paused || !player.alive) return;

    yaw -= event.movementX * CONFIG.mouseSensitivity;
    pitch -= event.movementY * CONFIG.mouseSensitivity;

    pitch = THREE.MathUtils.clamp(
        pitch,
        -PITCH_LIMIT,
        PITCH_LIMIT
    );

    camera.rotation.set(pitch, yaw, 0, "YXZ");

});

// ------------------------------------------
// TASTATUR
// ------------------------------------------

document.addEventListener("keydown", event => {

    keys[event.code] = true;

    if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
            .includes(event.code)
    ) {
        event.preventDefault();
    }

    if (event.repeat) return;

    // ESCAPE
    if (event.code === "Escape") {

        if (paused) {
            resumeGame();
        } else {
            pauseGame();
        }

        return;
    }

    // SPRINGEN
    if (event.code === "Space") {
        jump();
    }

    // INVENTAR
    if (event.code.startsWith("Digit")) {

        const slot = Number(event.code.replace("Digit", ""));

        if (slot >= 1 && slot <= 5) {
            selectSlot(slot);
        }
    }

});

document.addEventListener("keyup", event => {
    keys[event.code] = false;
});

// ------------------------------------------
// SPRINGEN
// ------------------------------------------

function jump() {

    if (!player.alive || paused) return;
    if (!player.grounded || player.crouching) return;

    player.velocity.y = CONFIG.jumpForce;
    player.grounded = false;
}

// ------------------------------------------
// INVENTAR
// ------------------------------------------

function selectSlot(slot) {

    if (slot < 1 || slot > 5) return;

    player.selectedSlot = slot;

    UI?.selectSlot?.(slot);

    const weapon = player.inventory[slot - 1];

    if (weapon) {
        UI?.updateWeapon?.(weapon.name);
        UI?.updateAmmo?.(weapon.ammo, weapon.maxAmmo);
    }
}

// ------------------------------------------
// DUCKEN
// ------------------------------------------

function updateCrouch() {

    const shouldCrouch = keys["ControlLeft"] || keys["ControlRight"];

    player.crouching = shouldCrouch;

    const targetHeight = shouldCrouch
        ? CONFIG.crouchEyeHeight
        : CONFIG.eyeHeight;

    player.eyeHeight = THREE.MathUtils.lerp(
        player.eyeHeight,
        targetHeight,
        Math.min(frameDelta * 12, 1)
    );
}

// ------------------------------------------
// BEWEGUNG
// ------------------------------------------

function updateMovement(delta) {

    if (!player.alive || paused) return;

    const forwardInput =
        (keys["KeyW"] ? 1 : 0) -
        (keys["KeyS"] ? 1 : 0);

    const sideInput =
        (keys["KeyD"] ? 1 : 0) -
        (keys["KeyA"] ? 1 : 0);

    const direction = new THREE.Vector3(
        sideInput,
        0,
        forwardInput
    );

    player.moving = direction.lengthSq() > 0;

    if (player.moving) {
        direction.normalize();

        direction.applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yaw
        );
    }

    // SPRINT
    const wantsSprint =
        keys["ShiftLeft"] ||
        keys["ShiftRight"];

    player.sprinting =
        wantsSprint &&
        player.moving &&
        !player.crouching &&
        player.stamina > 0;

    if (player.crouching) {
        player.speed = CONFIG.crouchSpeed;
    } else if (player.sprinting) {
        player.speed = CONFIG.sprintSpeed;
    } else {
        player.speed = CONFIG.walkSpeed;
    }

    // AUSDAUER
    if (player.sprinting) {

        player.stamina -= CONFIG.staminaDrain * delta;

    } else {

        player.stamina += CONFIG.staminaRecovery * delta;

    }

    player.stamina = THREE.MathUtils.clamp(
        player.stamina,
        0,
        player.maxStamina
    );

    // HORIZONTALE BEWEGUNG
    const movement = direction.multiplyScalar(
        player.speed * delta
    );

    const nextPosition = player.position.clone();

    nextPosition.x += movement.x;
    nextPosition.z += movement.z;

    if (!checkCollision(nextPosition)) {
        player.position.x = nextPosition.x;
        player.position.z = nextPosition.z;
    }

    // SCHWERKRAFT
    player.velocity.y -= CONFIG.gravity * delta;

    const nextY = player.position.y + player.velocity.y * delta;

    if (nextY <= 0) {

        player.position.y = 0;
        player.velocity.y = 0;
        player.grounded = true;

    } else {

        player.position.y = nextY;
        player.grounded = false;

    }

    // KAMERA
    camera.position.set(
        player.position.x,
        player.position.y + player.eyeHeight,
        player.position.z
    );
}

// ------------------------------------------
// AUSDAUER UND HUD
// ------------------------------------------

let hudUpdateTimer = 0;

function updateHUD(delta) {

    hudUpdateTimer += delta;

    if (hudUpdateTimer < 0.05) return;

    hudUpdateTimer = 0;

    updateUI();
}

// ------------------------------------------
// SCHADEN
// ------------------------------------------

function damage(amount) {

    if (!player.alive || amount <= 0) return;

    let remainingDamage = amount;

    // Erst Schild reduzieren.
    const shieldDamage = Math.min(
        player.shield,
        remainingDamage
    );

    player.shield -= shieldDamage;
    remainingDamage -= shieldDamage;

    // Rest geht auf Leben.
    if (remainingDamage > 0) {
        player.health -= remainingDamage;
    }

    player.health = Math.max(0, player.health);

    updateUI();

    UI?.notify?.("DU WURDEST GETROFFEN!");

    if (player.health <= 0) {
        die();
    }
}

// ------------------------------------------
// HEILEN
// ------------------------------------------

function heal(amount) {

    if (!player.alive || amount <= 0) return;

    player.health = Math.min(
        player.maxHealth,
        player.health + amount
    );

    updateUI();
}

// ------------------------------------------
// SCHILD AUFFÜLLEN
// ------------------------------------------

function restoreShield(amount) {

    if (!player.alive || amount <= 0) return;

    player.shield = Math.min(
        player.maxShield,
        player.shield + amount
    );

    updateUI();
}

// ------------------------------------------
// TOD
// ------------------------------------------

function die() {

    if (!player.alive) return;

    player.alive = false;
    player.velocity.set(0, 0, 0);

    document.exitPointerLock?.();

    UI?.showDeath?.();

}

// ------------------------------------------
// RESPAWN
// ------------------------------------------

function respawn(position = new THREE.Vector3(0, 0, 0)) {

    player.position.copy(position);

    player.velocity.set(0, 0, 0);

    player.health = player.maxHealth;
    player.shield = player.maxShield;
    player.stamina = player.maxStamina;

    player.alive = true;
    player.grounded = true;

    player.crouching = false;
    player.sprinting = false;

    player.eyeHeight = CONFIG.eyeHeight;

    yaw = 0;
    pitch = 0;

    camera.rotation.set(0, 0, 0);

    camera.position.set(
        player.position.x,
        player.position.y + CONFIG.eyeHeight,
        player.position.z
    );

    UI?.hideDeath?.();
    updateUI();

    requestMouseLock();
}

// ------------------------------------------
// PAUSE
// ------------------------------------------

function pauseGame() {

    if (paused || !player.alive) return;

    paused = true;

    document.exitPointerLock?.();

    UI?.showPause?.();
}

function resumeGame() {

    if (!paused || !player.alive) return;

    paused = false;

    UI?.hidePause?.();

    requestMouseLock();
}

// ------------------------------------------
// POINTER LOCK
// ------------------------------------------

document.addEventListener("pointerlockchange", () => {

    const locked = document.pointerLockElement === canvas;

    if (locked) {

        if (player.alive) {
            paused = false;
            UI?.hidePause?.();
        }

    } else if (gameStarted && player.alive && !paused) {

        paused = true;
        UI?.showPause?.();

    }

});

// ------------------------------------------
// FENSTERGRÖSSE
// ------------------------------------------

window.addEventListener("resize", () => {

    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

});

// ------------------------------------------
// SPIELSTART
// ------------------------------------------

function initializeGame() {

    player.position.set(0, 0, 0);

    camera.position.set(
        0,
        CONFIG.eyeHeight,
        0
    );

    updateUI();

    gameStarted = true;

    const loading = document.getElementById("game-loading");

    if (loading) {
        loading.style.display = "none";
    }

    UI?.showHUD?.();

    UI?.notify?.("CUBE WARS BEREIT");

}

// ------------------------------------------
// HAUPTSCHLEIFE
// ------------------------------------------

function animate() {

    requestAnimationFrame(animate);

    frameDelta = Math.min(clock.getDelta(), 0.05);

    if (gameStarted && !paused && player.alive) {

        updateCrouch();

        updateMovement(frameDelta);

        updateHUD(frameDelta);

    }

    renderer.render(scene, camera);

}

// ------------------------------------------
// BUTTONS
// ------------------------------------------

document.getElementById("resume-button")?.addEventListener(
    "click",
    resumeGame
);

document.getElementById("menu-button")?.addEventListener(
    "click",
    () => {
        window.location.href = "lobby.html";
    }
);

document.getElementById("respawn-button")?.addEventListener(
    "click",
    () => {
        respawn();
    }
);

document.getElementById("death-lobby-button")?.addEventListener(
    "click",
    () => {
        window.location.href = "lobby.html";
    }
);

// ------------------------------------------
// ÖFFENTLICHE SPIEL-API
// ------------------------------------------

window.CubeWars = {

    player,
    camera,
    scene,
    renderer,

    damage,
    heal,
    restoreShield,
    respawn,

    selectSlot,

    pause: pauseGame,
    resume: resumeGame,

    setCollisionHandler(callback) {
        collisionHandler = callback;
    },

    get paused() {
        return paused;
    },

    get mouseLocked() {
        return document.pointerLockElement === canvas;
    },

    get started() {
        return gameStarted;
    },

    start() {
        if (!gameStarted) {
            initializeGame();
        }
    }

};

// ------------------------------------------
// LOS
// ------------------------------------------

initializeGame();
animate();

console.log("CUBE WARS GAME ENGINE gestartet.");
