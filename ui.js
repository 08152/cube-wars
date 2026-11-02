
/* =========================================
   CUBE WARS
   GAME HUD SYSTEM
   ui.js
========================================= */

class CubeWarsUIController {

    constructor() {

        this.state = {
            health: 100,
            shield: 100,
            stamina: 100,
            ammo: 30,
            maxAmmo: 30,
            weapon: "STURMGEWEHR",
            kills: 0,
            enemies: 0,
            selectedSlot: 1,
            paused: false,
            dead: false,
            visible: false
        };

        this.initialized = false;

        this.initialize();
    }

    // ======================================
    // INITIALISIERUNG
    // ======================================

    initialize() {

        if (this.initialized) return;

        this.createInterface();

        this.initialized = true;

        this.updateAll();

        this.hidePause();
        this.hideDeath();

        console.log("CUBE WARS HUD erfolgreich geladen.");
    }

    // ======================================
    // HTML ELEMENTE ERSTELLEN
    // ======================================

    createElement(tag, id, parent, className = "") {

        let element = document.getElementById(id);

        if (!element) {

            element = document.createElement(tag);
            element.id = id;

            if (className) {
                element.className = className;
            }

            parent.appendChild(element);
        }

        return element;
    }

    createInterface() {

        const body = document.body;

        // Canvas
        let canvas = document.getElementById("game-canvas");

        if (!canvas) {

            canvas = document.createElement("canvas");
            canvas.id = "game-canvas";

            body.appendChild(canvas);
        }

        // UI Ebene
        this.uiLayer = this.createElement(
            "div",
            "ui-layer",
            body
        );

        // Fadenkreuz
        this.crosshair = this.createElement(
            "div",
            "crosshair",
            this.uiLayer
        );

        // Spielerstatus
        this.playerData = this.createElement(
            "div",
            "player-data",
            this.uiLayer
        );

        // Lebensanzeige
        this.createStatus(
            "health",
            "LEBEN",
            "#35e66b"
        );

        // Schildanzeige
        this.createStatus(
            "shield",
            "SCHILD",
            "#19baff"
        );

        // Ausdaueranzeige
        this.createStatus(
            "stamina",
            "AUSDAUER",
            "#ffe45c"
        );

        // Spielinformationen
        this.gameInfo = this.createElement(
            "div",
            "game-info",
            this.uiLayer
        );

        this.playerName = this.createElement(
            "div",
            "player-name",
            this.gameInfo
        );

        this.playerName.textContent = "CUBE WARS";

        this.killCounter = this.createElement(
            "div",
            "kill-counter",
            this.gameInfo
        );

        this.enemyCounter = this.createElement(
            "div",
            "enemy-counter",
            this.gameInfo
        );

        // Inventar
        this.inventory = this.createElement(
            "div",
            "inventory",
            this.uiLayer
        );

        this.createInventory();

        // Waffe
        this.weaponInfo = this.createElement(
            "div",
            "weapon-info",
            this.uiLayer
        );

        this.weaponName = this.createElement(
            "div",
            "weapon-name",
            this.weaponInfo
        );

        this.ammoElement = this.createElement(
            "div",
            "ammo",
            this.weaponInfo
        );

        // Benachrichtigungen
        this.notifications = this.createElement(
            "div",
            "notification-container",
            this.uiLayer
        );

        // Pausemenü
        this.createPauseMenu();

        // Todesmenü
        this.createDeathMenu();

        // Ladebildschirm
        this.loading = document.getElementById("game-loading");

        if (!this.loading) {

            this.loading = this.createElement(
                "div",
                "game-loading",
                body
            );

            this.loading.textContent = "SPIEL WIRD GELADEN";
        }
    }

    // ======================================
    // STATUSANZEIGEN
    // ======================================

    createStatus(type, label, color) {

        const container = this.createElement(
            "div",
            `${type}-container`,
            this.playerData
        );

        const labelElement = document.createElement("div");

        labelElement.className = "status-label";
        labelElement.innerHTML = `
            <span>${label}</span>
            <span id="${type}-value">100</span>
        `;

        this.playerData.appendChild(labelElement);

        const bar = this.createElement(
            "div",
            `${type}-bar`,
            container
        );

        bar.style.width = "100%";
        bar.style.background = color;

        this[`${type}Bar`] = bar;

        this[`${type}Value`] = document.getElementById(
            `${type}-value`
        );
    }

    updateStatus(type, value) {

        value = Math.max(0, Math.min(100, Number(value) || 0));

        this.state[type] = value;

        const bar = this[`${type}Bar`];
        const label = this[`${type}Value`];

        if (bar) {
            bar.style.width = `${value}%`;
        }

        if (label) {
            label.textContent = Math.round(value);
        }
    }

    updateHealth(value) {
        this.updateStatus("health", value);
    }

    updateShield(value) {
        this.updateStatus("shield", value);
    }

    updateStamina(value) {
        this.updateStatus("stamina", value);
    }

    // ======================================
    // INVENTAR
    // ======================================

    createInventory() {

        this.inventory.innerHTML = "";

        for (let i = 1; i <= 5; i++) {

            const slot = document.createElement("div");

            slot.className = "inventory-slot";
            slot.dataset.slot = i;

            slot.textContent = "";

            slot.addEventListener("click", () => {
                this.selectSlot(i);
            });

            this.inventory.appendChild(slot);
        }

        this.selectSlot(1);
    }

    selectSlot(number) {

        number = Math.max(1, Math.min(5, number));

        this.state.selectedSlot = number;

        document.querySelectorAll(".inventory-slot")
            .forEach(slot => {

                slot.classList.toggle(
                    "active",
                    Number(slot.dataset.slot) === number
                );
            });
    }

    setSlotContent(number, content) {

        const slot = document.querySelector(
            `.inventory-slot[data-slot="${number}"]`
        );

        if (!slot) return;

        slot.textContent = content || "";
    }

    // ======================================
    // WAFFE UND MUNITION
    // ======================================

    updateWeapon(name) {

        this.state.weapon = name || "KEINE WAFFE";

        if (this.weaponName) {
            this.weaponName.textContent = this.state.weapon;
        }
    }

    updateAmmo(current, maximum = this.state.maxAmmo) {

        this.state.ammo = current;
        this.state.maxAmmo = maximum;

        if (this.ammoElement) {

            this.ammoElement.innerHTML = `
                ${current}
                <span>/ ${maximum}</span>
            `;
        }
    }

    // ======================================
    // KILLS UND SPIELER
    // ======================================

    updateKills(value) {

        this.state.kills = value;

        this.killCounter.textContent =
            `KILLS: ${value}`;
    }

    updateEnemies(value) {

        this.state.enemies = value;

        this.enemyCounter.textContent =
            `SPIELER: ${value}`;
    }

    // ======================================
    // BENACHRICHTIGUNGEN
    // ======================================

    notify(message, duration = 3000) {

        const notification = document.createElement("div");

        notification.className = "notification";
        notification.textContent = message;

        this.notifications.appendChild(notification);

        setTimeout(() => {

            notification.remove();

        }, duration);
    }

    // ======================================
    // PAUSEMENÜ
    // ======================================

    createPauseMenu() {

        this.pauseMenu = this.createElement(
            "div",
            "pause-menu",
            document.body
        );

        this.pauseMenu.innerHTML = `
            <div class="pause-panel">
                <h2>PAUSE</h2>
                <p>CUBE WARS</p>
                <button id="resume-button">
                    WEITERSPIELEN
                </button>
                <button id="menu-button">
                    ZUR LOBBY
                </button>
            </div>
        `;

        this.pauseMenu.querySelector(
            "#resume-button"
        ).addEventListener("click", () => {

            this.hidePause();

            if (window.CubeWars?.resume) {
                window.CubeWars.resume();
            }
        });

        this.pauseMenu.querySelector(
            "#menu-button"
        ).addEventListener("click", () => {

            location.href = "./lobby.html";
        });
    }

    showPause() {

        this.state.paused = true;

        this.pauseMenu.style.display = "flex";
    }

    hidePause() {

        this.state.paused = false;

        if (this.pauseMenu) {
            this.pauseMenu.style.display = "none";
        }
    }

    // ======================================
    // TODESMENÜ
    // ======================================

    createDeathMenu() {

        this.deathMenu = this.createElement(
            "div",
            "death-menu",
            document.body
        );

        this.deathMenu.innerHTML = `
            <div class="pause-panel">
                <h2>ELIMINIERT</h2>
                <p>Du bist aus dem Spiel ausgeschieden.</p>
                <button id="respawn-button">
                    ERNEUT SPIELEN
                </button>
                <button id="death-lobby-button">
                    ZUR LOBBY
                </button>
            </div>
        `;

        this.deathMenu.querySelector(
            "#respawn-button"
        ).addEventListener("click", () => {

            this.hideDeath();

            if (window.CubeWars?.respawn) {
                window.CubeWars.respawn();
            }
        });

        this.deathMenu.querySelector(
            "#death-lobby-button"
        ).addEventListener("click", () => {

            location.href = "./lobby.html";
        });
    }

    showDeath() {

        this.state.dead = true;

        this.deathMenu.style.display = "flex";
    }

    hideDeath() {

        this.state.dead = false;

        if (this.deathMenu) {
            this.deathMenu.style.display = "none";
        }
    }

    // ======================================
    // HUD EIN- UND AUSBLENDEN
    // ======================================

    showHUD() {

        this.state.visible = true;

        this.uiLayer.style.display = "block";
    }

    hideHUD() {

        this.state.visible = false;

        this.uiLayer.style.display = "none";
    }

    // ======================================
    // ALLE WERTE AKTUALISIEREN
    // ======================================

    updateAll() {

        this.updateHealth(this.state.health);
        this.updateShield(this.state.shield);
        this.updateStamina(this.state.stamina);

        this.updateAmmo(
            this.state.ammo,
            this.state.maxAmmo
        );

        this.updateWeapon(this.state.weapon);
        this.updateKills(this.state.kills);
        this.updateEnemies(this.state.enemies);
    }
}

// ==========================================
// GLOBALE SCHNITTSTELLE
// ==========================================

const CubeWarsUI = new CubeWarsUIController();

window.CubeWarsUI = CubeWarsUI;
