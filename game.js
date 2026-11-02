
import * as THREE from "three";

// ==========================================
// CUBE WARS - PLAYER SYSTEM
// ==========================================

// GRUNDEINSTELLUNGEN

const canvas = document.getElementById("game-canvas");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
    90,
    window.innerWidth / window.innerHeight,
    0.05,
    1000
);

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

// Keine Weltobjekte.
// Die Kamera ist die First-Person-Ansicht.

// ==========================================
// PLAYER
// ==========================================

const player = {

    // Position: Füße des Spielers
    position: new THREE.Vector3(0, 0, 0),

    velocity: new THREE.Vector3(0, 0, 0),

    health: 100,
    maxHealth: 100,

    stamina: 100,
    maxStamina: 100,

    speed: 5.5,
    sprintSpeed: 9,
    crouchSpeed: 2.5,

    jumpForce: 7.5,
    gravity: 22,

    height: 1.8,
    normalHeight: 1.8,
    crouchHeight: 1.1,

    grounded: true,
    crouching: false,
    sprinting: false,

    alive: true,

    kills: 0,

    selectedSlot: 1,

    isMoving: false
};

// KAMERA

let yaw = 0;
let pitch = 0;

camera.rotation.order = "YXZ";

camera.position.set(
    player.position.x,
    player.position.y + player.height,
    player.position.z
);

// ==========================================
// INPUT SYSTEM
// ==========================================

const keys = {};

let mouseLocked = false;
let paused = false;
let gameStarted = false;

let mouseSensitivity = 0.002;

const blockedKeys = [
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight"
];

document.addEventListener("keydown", event => {

    if (blockedKeys.includes(event.code)) {
        event.preventDefault();
    }

    keys[event.code] = true;

    if (event.repeat) return;

    // INVENTAR
    if (event.code.startsWith("Digit")) {

        const slot = Number(event.code.replace("Digit", ""));

        if (slot >= 1 && slot <= 5) {
            selectSlot(slot);
        }
    }

    // SPRINGEN
    if (event.code === "Space") {
        jump();
    }

    // PAUSE
    if (event.code === "Escape" && gameStarted) {
        if (mouseLocked) {
            document.exitPointerLock();
        } else {
            showPause();
        }
    }
});

document.addEventListener("keyup", event => {
    keys[event.code] = false;
});

window.addEventListener("blur", () => {
    for (const key in keys) {
        keys[key] = false;
    }
});

// ==========================================
// MOUSE LOOK
// ==========================================

canvas.addEventListener("click", () => {

    if (!gameStarted || paused || !player.alive) return;

    if (!mouseLocked) {
        canvas.requestPointerLock();
    }
});

document.addEventListener("pointerlockchange", () => {

    mouseLocked = document.pointerLockElement === canvas;

    if (mouseLocked) {
        paused = false;
        hidePause();
    } else if (gameStarted && !paused) {
        showPause();
    }
});

document.addEventListener("mousemove", event => {

    if (!mouseLocked || paused) return;

    yaw -= event.movementX * mouseSensitivity;

    pitch -= event.movementY * mouseSensitivity;

    pitch = THREE.MathUtils.clamp(
        pitch,
        -Math.PI / 2 + 0.02,
        Math.PI / 2 - 0.02
    );

    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
});

// ==========================================
// MOVEMENT
// ==========================================

function getMovementDirection() {

    const forward = new THREE.Vector3(
        -Math.sin(yaw),
        0,
        -Math.cos(yaw)
    );

    const right = new THREE.Vector3(
        Math.cos(yaw),
        0,
        -Math.sin(yaw)
    );

    const direction = new THREE.Vector3();

    if (keys.KeyW) direction.add(forward);
    if (keys.KeyS) direction.sub(forward);
    if (keys.KeyD) direction.add(right);
    if (keys.KeyA) direction.sub(right);

    if (direction.lengthSq() > 0) {
        direction.normalize();
    }

    return direction;
}

// ==========================================
// JUMP
// ==========================================

function jump() {

    if (!gameStarted || paused || !mouseLocked) return;

    if (!player.grounded || !player.alive) return;

    player.velocity.y = player.jumpForce;
    player.grounded = false;
}

// ==========================================
// CROUCH
// ==========================================

function updateCrouch() {

    player.crouching = !!keys.ControlLeft || !!keys.ControlRight;

    player.height = THREE.MathUtils.damp(
        player.height,
        player.crouching ? player.crouchHeight : player.normalHeight,
        12,
        clock.getDelta()
    );
}

// ==========================================
// SPRINT
// ==========================================

function updateSprint() {

    const wantsSprint =
        keys.ShiftLeft ||
        keys.ShiftRight;

    const moving = player.isMoving;

    player.sprinting =
        wantsSprint &&
        moving &&
        !player.crouching &&
        player.stamina > 0;

    if (player.sprinting) {

        player.stamina -= 25 * frameDelta;

    } else {

        player.stamina += 15 * frameDelta;
    }

    player.stamina = THREE.MathUtils.clamp(
        player.stamina,
        0,
        player.maxStamina
    );
}

// ==========================================
// PHYSICS
// ==========================================

// Hier kann später die Welt ihre Kollisionen
// an das Spielersystem übergeben.

let collisionHandler = null;

function canMoveTo(position) {

    if (!collisionHandler) return true;

    return collisionHandler(
        position,
        player
    ) !== false;
}

function updatePhysics(dt) {

    if (!player.alive) return;

    // GRAVITY

    if (!player.grounded) {

        player.velocity.y -= player.gravity * dt;

    }

    // VERTIKALE BEWEGUNG

    const nextY =
        player.position.y + player.velocity.y * dt;

    if (nextY <= 0) {

        player.position.y = 0;
        player.velocity.y = 0;
        player.grounded = true;

    } else {

        player.position.y = nextY;
        player.grounded = false;
    }

    // HORIZONTALE BEWEGUNG

    const direction = getMovementDirection();

    player.isMoving = direction.lengthSq() > 0;

    const currentSpeed = player.crouching
        ? player.crouchSpeed
        : player.sprinting
            ? player.sprintSpeed
            : player.speed;

    const movement = direction.multiplyScalar(
        currentSpeed * dt
    );

    // X-KOLLISION

    const nextX = player.position.clone();
    nextX.x += movement.x;

    if (canMoveTo(nextX)) {
        player.position.x = nextX.x;
    }

    // Z-KOLLISION

    const nextZ = player.position.clone();
    nextZ.z += movement.z;

    if (canMoveTo(nextZ)) {
        player.position.z = nextZ.z;
    }
}

// ==========================================
// CAMERA UPDATE
// ==========================================

function updateCamera(dt) {

    const targetHeight =
        player.position.y + player.height;

    camera.position.x = player.position.x;
    camera.position.z = player.position.z;

    camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        targetHeight,
        15,
        dt
    );
}

// ==========================================
// HEALTH SYSTEM
// ==========================================

function damage(amount) {

    if (!player.alive) return;

    player.health = Math.max(
        0,
        player.health - Math.max(0, amount)
    );

    updateHealthUI();

    if (player.health <= 0) {
        playerDeath();
    }
}

function heal(amount) {

    if (!player.alive) return;

    player.health = Math.min(
        player.maxHealth,
        player.health + Math.max(0, amount)
    );

    updateHealthUI();
}

function updateHealthUI() {

    if (window.CubeWarsUI?.updateHealth) {
        window.CubeWarsUI.updateHealth(
            player.health,
            player.maxHealth
        );
    }
}

// ==========================================
// DEATH / RESPAWN
// ==========================================

function playerDeath() {

    player.alive = false;
    player.velocity.set(0, 0, 0);

    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    console.log("PLAYER ELIMINIERT");

    // Hier kann später das Death-Menü
    // durch ui.js geöffnet werden.

    if (window.CubeWarsUI?.showDeath) {
        window.CubeWarsUI.showDeath();
    }
}

function respawn(position = new THREE.Vector3(0, 0, 0)) {

    player.position.copy(position);

    player.velocity.set(0, 0, 0);

    player.health = player.maxHealth;
    player.stamina = player.maxStamina;

    player.height = player.normalHeight;

    player.grounded = true;
    player.crouching = false;
    player.sprinting = false;
    player.alive = true;

    updateHealthUI();

    camera.position.set(
        player.position.x,
        player.position.y + player.height,
        player.position.z
    );
}

// ==========================================
// INVENTORY SELECTION
// ==========================================

function selectSlot(slot) {

    if (slot < 1 || slot > 5) return;

    player.selectedSlot = slot;

    if (window.CubeWarsUI?.selectSlot) {
        window.CubeWarsUI.selectSlot(slot);
    }
}

// ==========================================
// PAUSE SYSTEM
// ==========================================

function showPause() {

    paused = true;

    const menu = document.getElementById("pause-menu");

    if (menu) {
        menu.style.display = "flex";
    }

    for (const key in keys) {
        keys[key] = false;
    }
}

function hidePause() {

    const menu = document.getElementById("pause-menu");

    if (menu) {
        menu.style.display = "none";
    }
}

document.getElementById("resume-button")?.addEventListener("click", () => {

    paused = false;

    hidePause();

    canvas.requestPointerLock();
});

document.getElementById("menu-button")?.addEventListener("click", () => {

    window.location.href = "lobby.html";

});

// ==========================================
// GAME INITIALIZATION
// ==========================================

function initializeGame() {

    gameStarted = true;

    const loading = document.getElementById("game-loading");

    if (loading) {
        loading.style.display = "none";
    }

    const elements = [
        "crosshair",
        "player-data",
        "game-info",
        "inventory"
    ];

    elements.forEach(id => {

        const element = document.getElementById(id);

        if (element) {
            element.style.display =
                id === "inventory" ? "flex" : "block";
        }
    });

    updateHealthUI();

    console.log("CUBE WARS PLAYER SYSTEM INITIALISIERT");
}

// ==========================================
// FRAME LOOP
// ==========================================

const clock = new THREE.Clock();

let frameDelta = 0;

function animate() {

    requestAnimationFrame(animate);

    frameDelta = Math.min(clock.getDelta(), 0.05);

    if (gameStarted && !paused && mouseLocked && player.alive) {

        updateCrouch();

        updateSprint();

        updatePhysics(frameDelta);

        updateCamera(frameDelta);

    }

    renderer.render(scene, camera);
}

// ==========================================
// WINDOW RESIZE
// ==========================================

window.addEventListener("resize", () => {

    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

});

// ==========================================
// PUBLIC GAME API
// ==========================================

window.CubeWars = {

    player,
    camera,
    scene,
    renderer,

    damage,
    heal,
    respawn,

    selectSlot,

    pause: showPause,
    resume: hidePause,

    setCollisionHandler(callback) {
        collisionHandler = callback;
    },

    start() {
        if (!gameStarted) initializeGame();
    },

    get mouseLocked() {
        return mouseLocked;
    },

    get paused() {
        return paused;
    }

};

// START

initializeGame();
animate();
