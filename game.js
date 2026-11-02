
import * as THREE from "three";
import { Welt } from "./welt.js";
import { Flugzeug } from "./flugzeug.js";

/* ==========================================
   CUBE WARS
   GAME ENGINE
========================================== */

const canvas = document.getElementById("game-canvas");

if (!canvas) {
    throw new Error("CUBE WARS: #game-canvas fehlt!");
}

const CONFIG = {
    fov: 85,
    near: 0.05,
    far: 1500,

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

    // Niedrigere Kamera
    eyeHeight: 1.35,
    crouchEyeHeight: 0.78,

    externalCameraDistance: 42,
    externalCameraHeight: 17,

    minimumPlayers: 2,
    networkInterval: 0.05
};

// ==========================================
// THREE.JS SZENE
// ==========================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x9cc9e8);

scene.fog = new THREE.FogExp2(
    0x9cc9e8,
    0.00065
);

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

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.75)
);

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(camera);

// ==========================================
// BELEUCHTUNG
// ==========================================

const hemisphereLight = new THREE.HemisphereLight(
    0xdceeff,
    0x526044,
    2.0
);

scene.add(hemisphereLight);

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    0.35
);

scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(
    0xfff1d5,
    2.4
);

sunLight.position.set(-180, 260, 120);
sunLight.castShadow = true;

sunLight.shadow.mapSize.set(2048, 2048);

sunLight.shadow.camera.left = -350;
sunLight.shadow.camera.right = 350;
sunLight.shadow.camera.top = 350;
sunLight.shadow.camera.bottom = -350;

sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 800;

sunLight.shadow.bias = -0.00015;
sunLight.shadow.normalBias = 0.025;

scene.add(sunLight);
scene.add(sunLight.target);

// ==========================================
// WELT
// ==========================================

const welt = new Welt(scene, {
    size: 600,
    segments: 320
});

// ==========================================
// FLUGZEUG
// ==========================================

const plane = new Flugzeug(scene);

// ==========================================
// SPIELER
// ==========================================

const player = {
    id: null,

    position: new THREE.Vector3(0, 0, 0),
    velocity: new THREE.Vector3(),

    health: CONFIG.maxHealth,
    maxHealth: CONFIG.maxHealth,

    shield: CONFIG.maxShield,
    maxShield: CONFIG.maxShield,

    stamina: CONFIG.maxStamina,
    maxStamina: CONFIG.maxStamina,

    speed: CONFIG.walkSpeed,

    grounded: false,
    crouching: false,
    sprinting: false,
    moving: false,

    alive: true,
    kills: 0,

    selectedSlot: 1,
    eyeHeight: CONFIG.eyeHeight,

    inventory: [
        {
            name: "ENERGIEBLASTER",
            ammo: 30,
            maxAmmo: 30
        },
        {
            name: "LEER",
            ammo: 0,
            maxAmmo: 0
        },
        {
            name: "LEER",
            ammo: 0,
            maxAmmo: 0
        },
        {
            name: "LEER",
            ammo: 0,
            maxAmmo: 0
        },
        {
            name: "LEER",
            ammo: 0,
            maxAmmo: 0
        }
    ]
};

// ==========================================
// SPIELPHASEN
// ==========================================

const PHASE = {
    CONNECTING: "connecting",
    WAITING: "waiting",
    COUNTDOWN: "countdown",
    FLIGHT: "flight",
    FALLING: "falling",
    PLAYING: "playing",
    DEAD: "dead"
};

let phase = PHASE.CONNECTING;

let matchStarted = false;
let hasJumped = false;
let paused = false;
let gameStarted = false;

let playerCount = 0;
let countdownSeconds = null;

// ==========================================
// UI
// ==========================================

const UI = window.CubeWarsUI;

function updateUI() {
    if (!UI) return;

    UI.updateHealth?.(
        player.health,
        player.maxHealth
    );

    UI.updateShield?.(
        player.shield,
        player.maxShield
    );

    UI.updateStamina?.(
        player.stamina,
        player.maxStamina
    );

    UI.updateKills?.(player.kills);
    UI.selectSlot?.(player.selectedSlot);

    const weapon = player.inventory[player.selectedSlot - 1];

    if (weapon) {
        UI.updateWeapon?.(weapon.name);
        UI.updateAmmo?.(weapon.ammo, weapon.maxAmmo);
    }

    UI.updateEnemies?.(
        Math.max(0, playerCount - 1)
    );
}

function notify(message) {
    UI?.notify?.(message);
}

// ==========================================
// WARTESCHLANGEN-OVERLAY
// ==========================================

const queueOverlay = document.createElement("div");

queueOverlay.id = "cube-wars-queue";

Object.assign(queueOverlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "10000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    background: "rgba(5, 10, 20, 0.86)",
    color: "white",
    fontFamily: "Arial, sans-serif",
    textAlign: "center",
    pointerEvents: "none"
});

queueOverlay.innerHTML = `
    <div style="
        font-size:14px;
        letter-spacing:6px;
        color:#a8cfff;
        margin-bottom:20px;
        font-weight:800;
    ">
        CUBE WARS
    </div>

    <div id="queue-title" style="
        font-size:36px;
        font-weight:900;
        margin-bottom:14px;
    ">
        VERBINDE MIT SERVER
    </div>

    <div id="queue-description" style="
        font-size:17px;
        color:#d4deec;
    ">
        Bitte warten ...
    </div>

    <div id="queue-count" style="
        font-size:48px;
        font-weight:900;
        margin-top:24px;
    ">
        0 / 2
    </div>
`;

document.body.appendChild(queueOverlay);

const queueTitle = document.getElementById("queue-title");
const queueDescription = document.getElementById("queue-description");
const queueCount = document.getElementById("queue-count");

function showQueue(title, description, count) {
    queueOverlay.style.display = "flex";

    queueTitle.textContent = title;
    queueDescription.textContent = description;
    queueCount.textContent = count;
}

function hideQueue() {
    queueOverlay.style.display = "none";
}

// ==========================================
// SERVERVERBINDUNG
// ==========================================

let socket = null;
let reconnectTimer = null;
let reconnectDelay = 2000;

function connectServer() {
    if (
        socket &&
        (
            socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }

    const protocol = location.protocol === "https:"
        ? "wss:"
        : "ws:";

    socket = new WebSocket(
        `${protocol}//${location.host}`
    );

    socket.addEventListener("open", () => {
        console.log("CUBE WARS: Server verbunden.");

        reconnectDelay = 2000;

        if (!matchStarted) {
            phase = PHASE.WAITING;

            showQueue(
                "SPIELERSUCHE",
                "Warte auf einen weiteren Spieler ...",
                "0 / 2"
            );
        }
    });

    socket.addEventListener("message", event => {
        let data;

        try {
            data = JSON.parse(event.data);
        } catch {
            console.warn("Ungültige Servernachricht.");
            return;
        }

        handleServerMessage(data);
    });

    socket.addEventListener("close", () => {
        console.warn("CUBE WARS: Serververbindung verloren.");

        if (!matchStarted) {
            phase = PHASE.CONNECTING;

            showQueue(
                "VERBINDUNG VERLOREN",
                "Versuche erneut, den Server zu erreichen ...",
                "— / 2"
            );
        }

        clearTimeout(reconnectTimer);

        reconnectTimer = setTimeout(() => {
            connectServer();
            reconnectDelay = Math.min(
                reconnectDelay * 1.5,
                15000
            );
        }, reconnectDelay);
    });

    socket.addEventListener("error", () => {
        console.error(
            "CUBE WARS: Serververbindung fehlgeschlagen."
        );
    });
}

connectServer();

// ==========================================
// SERVERNACHRICHTEN
// ==========================================

function handleServerMessage(data) {
    switch (data.type) {
        case "connected":
            player.id = data.id;
            break;

        case "queue":
            playerCount = data.players ?? 0;

            if (data.matchStarted) {
                startMatch();
                break;
            }

            if (data.countdown !== null && data.countdown !== undefined) {
                phase = PHASE.COUNTDOWN;

                countdownSeconds = data.countdown;

                showQueue(
                    "SPIEL STARTET BALD",
                    `Das Flugzeug startet in ${countdownSeconds} Sekunden.`,
                    `${playerCount} / ${CONFIG.minimumPlayers}`
                );
            } else {
                phase = PHASE.WAITING;

                showQueue(
                    "SPIELERSUCHE",
                    playerCount < CONFIG.minimumPlayers
                        ? "Warte auf einen weiteren Spieler ..."
                        : "Spieler gefunden.",
                    `${playerCount} / ${CONFIG.minimumPlayers}`
                );
            }

            updateUI();
            break;

        case "countdown":
            phase = PHASE.COUNTDOWN;
            countdownSeconds = data.seconds;

            showQueue(
                "SPIELER GEFUNDEN",
                "Das Flugzeug startet gleich!",
                `${playerCount} / ${CONFIG.minimumPlayers}`
            );
            break;

        case "match-start":
            playerCount = data.players ?? playerCount;
            startMatch();
            break;

        case "player-left":
            playerCount = Math.max(
                0,
                playerCount - 1
            );

            updateUI();
            break;

        case "player-position":
            // Hier können später andere Spieler dargestellt werden.
            break;
    }
}

// ==========================================
// MATCH START
// ==========================================

function startMatch() {
    if (matchStarted) return;

    matchStarted = true;
    gameStarted = true;

    phase = PHASE.FLIGHT;

    hideQueue();

    const loading = document.getElementById("game-loading");

    if (loading) {
        loading.style.display = "none";
    }

    UI?.showHUD?.();

    plane.start();

    notify("DAS FLUGZEUG STARTET!");

    updateUI();
}

// ==========================================
// FLUGZEUGPOSITION
// ==========================================

function getPlanePosition() {
    const position = plane.getPosition?.();

    if (position?.isVector3) {
        return position.clone();
    }

    if (plane.mesh?.position) {
        return plane.mesh.position.clone();
    }

    if (plane.model?.position) {
        return plane.model.position.clone();
    }

    return new THREE.Vector3(-180, 85, 0);
}

// ==========================================
// FLUGZEUGKAMERA
// ==========================================

const cameraTarget = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();

function updateExternalPlaneCamera() {
    const planePosition = getPlanePosition();

    cameraOffset.set(
        -CONFIG.externalCameraDistance,
        CONFIG.externalCameraHeight,
        30
    );

    if (plane.mesh?.rotation) {
        cameraOffset.applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            plane.mesh.rotation.y
        );
    }

    camera.position.copy(planePosition).add(cameraOffset);

    cameraTarget.copy(planePosition);
    cameraTarget.y += 2;

    camera.lookAt(cameraTarget);
}

// ==========================================
// SPIELER IM FLUGZEUG
// ==========================================

function updatePlayerInPlane() {
    const planePosition = getPlanePosition();

    player.position.set(
        planePosition.x,
        planePosition.y - 2.5,
        planePosition.z
    );

    player.velocity.set(0, 0, 0);

    updateExternalPlaneCamera();
}

// ==========================================
// ABSRPUNG
// ==========================================

let yaw = 0;
let pitch = 0;

function jumpFromPlane() {
    if (!matchStarted) return;
    if (phase !== PHASE.FLIGHT) return;
    if (hasJumped || !player.alive) return;

    hasJumped = true;
    phase = PHASE.FALLING;

    const planePosition = getPlanePosition();

    player.position.set(
        planePosition.x,
        planePosition.y - 3,
        planePosition.z
    );

    player.velocity.set(
        24,
        -2,
        0
    );

    player.grounded = false;

    yaw = 0;
    pitch = 0;

    camera.rotation.set(0, 0, 0);

    camera.position.set(
        player.position.x,
        player.position.y + player.eyeHeight,
        player.position.z
    );

    notify("ABSPRUNG! DU BIST IN DER LUFT!");

    hideQueue();

    canvas.requestPointerLock?.();

    updateUI();
}

// ==========================================
// KAMERA UND MOUSE
// ==========================================

const PITCH_LIMIT = Math.PI / 2 - 0.01;

canvas.addEventListener("click", () => {
    if (
        matchStarted &&
        hasJumped &&
        player.alive &&
        !paused
    ) {
        canvas.requestPointerLock?.();
    }
});

document.addEventListener("mousemove", event => {
    if (document.pointerLockElement !== canvas) return;
    if (!hasJumped || paused || !player.alive) return;

    yaw -= event.movementX * CONFIG.mouseSensitivity;
    pitch -= event.movementY * CONFIG.mouseSensitivity;

    pitch = THREE.MathUtils.clamp(
        pitch,
        -PITCH_LIMIT,
        PITCH_LIMIT
    );

    camera.rotation.set(
        pitch,
        yaw,
        0,
        "YXZ"
    );
});

// ==========================================
// TASTEN
// ==========================================

const keys = {};

document.addEventListener("keydown", event => {
    keys[event.code] = true;

    if (event.code === "Space") {
        event.preventDefault();

        if (phase === PHASE.FLIGHT) {
            jumpFromPlane();
        } else if (phase === PHASE.PLAYING) {
            jump();
        }
    }

    if (event.repeat) return;

    if (event.code === "Escape" && hasJumped) {
        if (paused) {
            resumeGame();
        } else {
            pauseGame();
        }
    }

    if (event.code.startsWith("Digit")) {
        const slot = Number(
            event.code.replace("Digit", "")
        );

        if (slot >= 1 && slot <= 5) {
            selectSlot(slot);
        }
    }
});

document.addEventListener("keyup", event => {
    keys[event.code] = false;
});

window.addEventListener("blur", () => {
    for (const key of Object.keys(keys)) {
        keys[key] = false;
    }
});

// ==========================================
// SPRINGEN
// ==========================================

function jump() {
    if (!player.alive || paused) return;
    if (!player.grounded || player.crouching) return;

    player.velocity.y = CONFIG.jumpForce;
    player.grounded = false;
}

// ==========================================
// INVENTAR
// ==========================================

function selectSlot(slot) {
    if (slot < 1 || slot > 5) return;

    player.selectedSlot = slot;

    UI?.selectSlot?.(slot);

    const weapon = player.inventory[slot - 1];

    if (weapon) {
        UI?.updateWeapon?.(weapon.name);
        UI?.updateAmmo?.(
            weapon.ammo,
            weapon.maxAmmo
        );
    }
}

// ==========================================
// DUCKEN
// ==========================================

function updateCrouch(delta) {
    const shouldCrouch =
        keys["ControlLeft"] ||
        keys["ControlRight"];

    player.crouching = shouldCrouch;

    const targetHeight = shouldCrouch
        ? CONFIG.crouchEyeHeight
        : CONFIG.eyeHeight;

    player.eyeHeight = THREE.MathUtils.lerp(
        player.eyeHeight,
        targetHeight,
        Math.min(delta * 12, 1)
    );
}

// ==========================================
// BEWEGUNGSRICHTUNG
// ==========================================

const worldUp = new THREE.Vector3(0, 1, 0);

function getMovementDirection() {
    const forwardInput =
        (keys["KeyW"] ? 1 : 0) -
        (keys["KeyS"] ? 1 : 0);

    const sideInput =
        (keys["KeyD"] ? 1 : 0) -
        (keys["KeyA"] ? 1 : 0);

    const direction = new THREE.Vector3(
        sideInput,
        0,
        -forwardInput
    );

    if (direction.lengthSq() > 0) {
        direction.normalize();
        direction.applyAxisAngle(worldUp, yaw);
    }

    return direction;
}

// ==========================================
// SPIELERBEWEGUNG
// ==========================================

function updateMovement(delta) {
    if (!player.alive || paused) return;

    const direction = getMovementDirection();

    player.moving = direction.lengthSq() > 0;

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

    // Horizontale Bewegung
    const oldX = player.position.x;
    const oldZ = player.position.z;

    player.position.x += direction.x * player.speed * delta;
    player.position.z += direction.z * player.speed * delta;

    // Inselgrenze
    if (
        !welt.isInsideWorld(
            player.position.x,
            player.position.z
        )
    ) {
        player.position.x = oldX;
        player.position.z = oldZ;
    }

    // Gelände
    const groundHeight = welt.getGroundHeight(
        player.position.x,
        player.position.z
    );

    player.velocity.y -= CONFIG.gravity * delta;

    const nextY =
        player.position.y +
        player.velocity.y * delta;

    if (nextY <= groundHeight) {
        player.position.y = groundHeight;
        player.velocity.y = 0;
        player.grounded = true;
    } else {
        player.position.y = nextY;
        player.grounded = false;
    }

    camera.position.set(
        player.position.x,
        player.position.y + player.eyeHeight,
        player.position.z
    );

    if (player.position.y < -40) {
        die();
    }
}

// ==========================================
// FREIER FALL
// ==========================================

function updateFalling(delta) {
    if (!player.alive || paused) return;

    const direction = getMovementDirection();

    if (direction.lengthSq() > 0) {
        player.position.addScaledVector(
            direction,
            5 * delta
        );
    }

    player.velocity.y -= CONFIG.gravity * delta;

    player.position.y += player.velocity.y * delta;

    // Spieler bleibt innerhalb der Inselgrenze.
    if (
        !welt.isInsideWorld(
            player.position.x,
            player.position.z
        )
    ) {
        const centerDirection = new THREE.Vector2(
            -player.position.x,
            -player.position.z
        ).normalize();

        player.position.x += centerDirection.x * 4 * delta;
        player.position.z += centerDirection.y * 4 * delta;
    }

    const groundHeight = welt.getGroundHeight(
        player.position.x,
        player.position.z
    );

    if (player.position.y <= groundHeight) {
        player.position.y = groundHeight;
        player.velocity.y = 0;

        player.grounded = true;
        phase = PHASE.PLAYING;

        notify("LANDUNG ERFOLGREICH!");
    }

    camera.position.set(
        player.position.x,
        player.position.y + player.eyeHeight,
        player.position.z
    );

    if (player.position.y < -40) {
        die();
    }
}

// ==========================================
// HUD AKTUALISIERUNG
// ==========================================

let hudTimer = 0;

function updateHUD(delta) {
    hudTimer += delta;

    if (hudTimer < 0.05) return;

    hudTimer = 0;

    updateUI();
}

// ==========================================
// SERVERPOSITION SENDEN
// ==========================================

let networkTimer = 0;

function sendPlayerPosition(delta) {
    networkTimer += delta;

    if (networkTimer < CONFIG.networkInterval) return;

    networkTimer = 0;

    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (!matchStarted || !hasJumped) return;

    socket.send(JSON.stringify({
        type: "position",
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
    }));
}

// ==========================================
// LEBEN UND SCHILD
// ==========================================

function damage(amount) {
    if (!player.alive || amount <= 0) return;

    let remaining = amount;

    const shieldDamage = Math.min(
        player.shield,
        remaining
    );

    player.shield -= shieldDamage;
    remaining -= shieldDamage;

    if (remaining > 0) {
        player.health -= remaining;
    }

    player.health = Math.max(
        0,
        player.health
    );

    updateUI();

    notify("DU WURDEST GETROFFEN!");

    if (player.health <= 0) {
        die();
    }
}

function heal(amount) {
    if (!player.alive || amount <= 0) return;

    player.health = Math.min(
        player.maxHealth,
        player.health + amount
    );

    updateUI();
}

function restoreShield(amount) {
    if (!player.alive || amount <= 0) return;

    player.shield = Math.min(
        player.maxShield,
        player.shield + amount
    );

    updateUI();
}

// ==========================================
// TOD
// ==========================================

function die() {
    if (!player.alive) return;

    player.alive = false;
    player.velocity.set(0, 0, 0);

    phase = PHASE.DEAD;

    document.exitPointerLock?.();

    UI?.showDeath?.();
}

// ==========================================
// RESPAWN
// ==========================================

function respawn(position = new THREE.Vector3(0, 0, 0)) {
    player.position.copy(position);

    player.position.y = welt.getGroundHeight(
        position.x,
        position.z
    );

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

    phase = PHASE.PLAYING;

    camera.rotation.set(0, 0, 0);

    camera.position.set(
        player.position.x,
        player.position.y + CONFIG.eyeHeight,
        player.position.z
    );

    UI?.hideDeath?.();

    updateUI();

    canvas.requestPointerLock?.();
}

// ==========================================
// PAUSE
// ==========================================

function pauseGame() {
    if (paused || !player.alive || !hasJumped) return;

    paused = true;

    document.exitPointerLock?.();

    UI?.showPause?.();
}

function resumeGame() {
    if (!paused || !player.alive) return;

    paused = false;

    UI?.hidePause?.();

    canvas.requestPointerLock?.();
}

// ==========================================
// POINTER LOCK
// ==========================================

document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;

    if (!hasJumped || !player.alive) return;

    if (locked) {
        if (paused) {
            paused = false;
            UI?.hidePause?.();
        }
    } else if (
        gameStarted &&
        !paused &&
        player.alive
    ) {
        pauseGame();
    }
});

// ==========================================
// RESIZE
// ==========================================

window.addEventListener("resize", () => {
    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 1.75)
    );
});

// ==========================================
// BUTTONS
// ==========================================

document.getElementById("resume-button")?.addEventListener(
    "click",
    resumeGame
);

document.getElementById("menu-button")?.addEventListener(
    "click",
    () => {
        window.location.href = "./lobby.html";
    }
);

document.getElementById("respawn-button")?.addEventListener(
    "click",
    () => respawn()
);

document.getElementById("death-lobby-button")?.addEventListener(
    "click",
    () => {
        window.location.href = "./lobby.html";
    }
);

// ==========================================
// ANIMATION
// ==========================================

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(
        clock.getDelta(),
        0.05
    );

    if (matchStarted && player.alive && !paused) {

        // Flugzeugphase
        if (phase === PHASE.FLIGHT) {
            plane.update(delta);
            updatePlayerInPlane();
        }

        // Absprung
        if (phase === PHASE.FALLING) {
            updateFalling(delta);
        }

        // Normales Gameplay
        if (phase === PHASE.PLAYING) {
            updateCrouch(delta);
            updateMovement(delta);
        }

        updateHUD(delta);
        sendPlayerPosition(delta);

    } else if (
        phase === PHASE.FLIGHT &&
        matchStarted
    ) {
        updateExternalPlaneCamera();
    }

    renderer.render(scene, camera);
}

// ==========================================
// ÖFFENTLICHE API
// ==========================================

window.CubeWars = {
    player,
    camera,
    scene,
    renderer,
    welt,
    plane,

    damage,
    heal,
    restoreShield,
    respawn,

    selectSlot,

    pause: pauseGame,
    resume: resumeGame,

    get phase() {
        return phase;
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

    get matchStarted() {
        return matchStarted;
    },

    get hasJumped() {
        return hasJumped;
    },

    get playerCount() {
        return playerCount;
    }
};

// ==========================================
// START
// ==========================================

showQueue(
    "VERBINDE MIT SERVER",
    "Warte auf Serververbindung ...",
    "0 / 2"
);

updateUI();

animate();

console.log("CUBE WARS Engine geladen.");
