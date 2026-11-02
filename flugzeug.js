
import * as THREE from "three";

/* ==========================================
   CUBE WARS
   MILITARY TRANSPORT AIRCRAFT
   flugzeug.js
========================================== */

export class Flugzeug {

    constructor(scene, options = {}) {

        this.scene = scene;

        this.startPosition = options.startPosition ||
            new THREE.Vector3(-180, 85, 0);

        this.endPosition = options.endPosition ||
            new THREE.Vector3(180, 85, 0);

        this.speed = options.speed || 24;

        this.active = false;
        this.finished = false;
        this.progress = 0;

        this.group = new THREE.Group();
        this.propellers = [];
        this.lights = [];

        this.materials = {
            body: this.mat(0x414b50),
            dark: this.mat(0x20292e),
            armor: this.mat(0x59646a),
            metal: this.mat(0x899399),
            black: this.mat(0x10171c),
            glass: this.mat(0x142e40, 0.2),
            yellow: this.mat(0xd3a52e),
            white: this.mat(0xcbd1d2),
            red: this.mat(0xd52e32),
            green: this.mat(0x35d879)
        };

        this.createAircraft();

        this.group.position.copy(this.startPosition);
        this.scene.add(this.group);
    }

    mat(color, roughness = 0.85) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness,
            metalness: 0.25
        });
    }

    box(name, w, h, d, material, x, y, z) {

        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            material
        );

        mesh.name = name;
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.group.add(mesh);

        return mesh;
    }

    cylinder(name, radiusTop, radiusBottom, length, material,
             x, y, z, rotationZ = 0) {

        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(
                radiusTop,
                radiusBottom,
                length,
                12
            ),
            material
        );

        mesh.name = name;
        mesh.position.set(x, y, z);
        mesh.rotation.z = rotationZ;
        mesh.castShadow = true;

        this.group.add(mesh);

        return mesh;
    }

    createAircraft() {

        this.createFuselage();
        this.createCockpit();
        this.createWings();
        this.createEngines();
        this.createTail();
        this.createLandingGear();
        this.createSideDoor();
        this.createDecorativeGatling();
        this.createDetails();
        this.createLights();
    }

    // ======================================
    // RUMPF
    // ======================================

    createFuselage() {

        const B = this.materials;

        // Hauptkörper
        this.box(
            "Haupt-Rumpf",
            17, 3.5, 4.5,
            B.body,
            -0.5, 0, 0
        );

        // Verstärkte Unterseite
        this.box(
            "Unterer Rumpf",
            14, 0.8, 4.2,
            B.dark,
            -0.5, -2, 0
        );

        // Oberer Panzerstreifen
        this.box(
            "Oberer Rumpf",
            12, 0.35, 4.2,
            B.armor,
            -1, 1.85, 0
        );

        // Hinterer Rumpfbereich
        this.box(
            "Heckbereich",
            5, 2.7, 4.1,
            B.dark,
            -7.8, 0, 0
        );

        // Nasenbereich
        this.box(
            "Nase",
            3.5, 2.6, 3.8,
            B.armor,
            8.8, 0, 0
        );

        // Unterer Nasenschutz
        this.box(
            "Nasenpanzer",
            2.8, 0.7, 3.4,
            B.dark,
            9.1, -1.4, 0
        );

        // Panzerplatten an den Seiten
        for (let i = 0; i < 7; i++) {

            const x = 5 - i * 1.8;

            this.box(
                "Seitenpanzer",
                1.4, 2.1, 0.13,
                B.armor,
                x, 0, 2.3
            );

            this.box(
                "Seitenpanzer",
                1.4, 2.1, 0.13,
                B.armor,
                x, 0, -2.3
            );
        }

        // Untere Streifen
        this.box(
            "Warnstreifen",
            12, 0.12, 0.08,
            B.yellow,
            0, -1.3, 2.34
        );

        this.box(
            "Warnstreifen",
            12, 0.12, 0.08,
            B.yellow,
            0, -1.3, -2.34
        );
    }

    // ======================================
    // COCKPIT
    // ======================================

    createCockpit() {

        const B = this.materials;

        this.box(
            "Cockpit-Dach",
            3.5, 0.45, 3.7,
            B.dark,
            7.5, 1.5, 0
        );

        // Frontfenster
        this.box(
            "Frontfenster links",
            0.12, 1.35, 1.5,
            B.glass,
            9.15, 0.8, 0.9
        );

        this.box(
            "Frontfenster rechts",
            0.12, 1.35, 1.5,
            B.glass,
            9.15, 0.8, -0.9
        );

        // Seitenfenster
        for (let i = 0; i < 3; i++) {

            const z = 1.8 - i * 1.8;

            this.box(
                "Cockpit-Seitenfenster",
                0.8, 0.9, 0.1,
                B.glass,
                7.4, 0.8, z
            );
        }

        // Fensterrahmen
        this.box(
            "Cockpit-Rahmen",
            0.15, 1.5, 3.8,
            B.dark,
            9.25, 0.8, 0
        );
    }

    // ======================================
    // FLÜGEL
    // ======================================

    createWings() {

        const B = this.materials;

        // Hauptflügel
        this.box(
            "Hauptflügel",
            5.5, 0.45, 23,
            B.body,
            0, 0.4, 0
        );

        // Verstärkungen
        this.box(
            "Flügelverstärkung",
            4, 0.3, 19,
            B.dark,
            -0.2, 0.15, 0
        );

        // Flügelspitzen
        for (const side of [-1, 1]) {

            this.box(
                "Flügelspitze",
                3.5, 0.5, 1.1,
                B.yellow,
                0.3, 0.45, side * 11.5
            );

            this.box(
                "Flügelmarkierung",
                2, 0.12, 1.5,
                B.white,
                0.3, 0.72, side * 8
            );
        }

        // Hintere Flügelklappen
        for (const side of [-1, 1]) {

            this.box(
                "Flügelklappe",
                1.8, 0.18, 7,
                B.dark,
                -2.8, 0.15, side * 6
            );
        }

        // Antennen
        this.cylinder(
            "Flügelantenne",
            0.08, 0.08, 1.5,
            B.dark,
            -1, 1.25, 2,
            0.15
        );
    }

    // ======================================
    // GROSSE TRIEBWERKE
    // ======================================

    createEngines() {

        const B = this.materials;

        for (const side of [-1, 1]) {

            const z = side * 6.3;

            // Große Triebwerksgondel
            this.box(
                "Große Triebwerksgondel",
                5.5, 2.7, 3.4,
                B.dark,
                0, -1.5, z
            );

            // Außenpanzerung
            this.box(
                "Triebwerks-Panzerung",
                4.7, 2.9, 0.2,
                B.armor,
                0, -1.5, z + side * 1.75
            );

            // Dunkle Triebwerksöffnung
            this.cylinder(
                "Triebwerksöffnung",
                1.05, 1.25, 0.35,
                B.black,
                2.9, -1.5, z,
                Math.PI / 2
            );

            // Innerer Triebwerksring
            this.cylinder(
                "Triebwerksring",
                0.7, 0.85, 0.12,
                B.metal,
                3.12, -1.5, z,
                Math.PI / 2
            );

            // Heckauslass
            this.cylinder(
                "Triebwerksauslass",
                0.85, 0.85, 0.4,
                B.black,
                -2.9, -1.5, z,
                Math.PI / 2
            );

            // Seitliche Wartungsplatten
            for (let i = 0; i < 3; i++) {

                this.box(
                    "Triebwerks-Wartung",
                    0.8, 0.15, 1.1,
                    B.metal,
                    -1.7 + i * 1.4,
                    -0.05,
                    z + side * 1.75
                );
            }
        }
    }

    // ======================================
    // HECK
    // ======================================

    createTail() {

        const B = this.materials;

        // Höhenleitwerk
        this.box(
            "Höhenleitwerk",
            3.5, 0.4, 10,
            B.body,
            -7.2, 1.1, 0
        );

        // Seitenleitwerk
        this.box(
            "Seitenleitwerk",
            3, 5, 0.6,
            B.body,
            -7.8, 3, 0
        );

        // Heckmarkierung
        this.box(
            "Heckmarkierung",
            0.2, 2.7, 0.15,
            B.yellow,
            -7.8, 3, 0.36
        );

        // Heckantenne
        this.cylinder(
            "Heckantenne",
            0.06, 0.06, 1.8,
            B.black,
            -7.5, 5.8, 0
        );
    }

    // ======================================
    // FAHRWERK
    // ======================================

    createLandingGear() {

        const B = this.materials;

        for (const side of [-1, 1]) {

            // Fahrwerksbein
            this.cylinder(
                "Fahrwerksbein",
                0.18, 0.25, 2.2,
                B.metal,
                0, -2.5, side * 3.3
            );

            // Rad
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    0.65, 0.65, 0.35, 12
                ),
                B.black
            );

            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(0, -3.5, side * 3.3);

            this.group.add(wheel);
        }

        // Hinteres Fahrwerk
        this.cylinder(
            "Hinteres Fahrwerksbein",
            0.12, 0.16, 1.6,
            B.metal,
            -6, -2.2, 0
        );
    }

    // ======================================
    // OFFENE SEITENTÜR
    // ======================================

    createSideDoor() {

        const B = this.materials;

        // Rechte Seite = positive Z-Richtung.
        // Die große Öffnung bleibt frei.

        // Türrahmen oben
        this.box(
            "Türrahmen oben",
            5.2, 0.25, 0.25,
            B.metal,
            -1.7, 1.65, 2.42
        );

        // Türrahmen unten
        this.box(
            "Türrahmen unten",
            5.2, 0.25, 0.25,
            B.metal,
            -1.7, -1.65, 2.42
        );

        // Hinterer Türrahmen
        this.box(
            "Türrahmen hinten",
            0.25, 3.1, 0.25,
            B.metal,
            -4.3, 0, 2.42
        );

        // Offene Tür: seitlich nach außen geklappt
        const door = this.box(
            "Offene Frachttür",
            5.2, 3.2, 0.25,
            B.armor,
            -1.7, 0, 3.9
        );

        door.rotation.y = 0;

        // Türinnenseite
        this.box(
            "Tür-Innenverkleidung",
            4.6, 2.7, 0.08,
            B.dark,
            -1.7, 0, 4.05
        );

        // Boden der offenen Ladeöffnung
        this.box(
            "Ladeflächenboden",
            5.3, 0.2, 3.1,
            B.dark,
            -1.7, -1.85, 0
        );

        // Bodenstreifen
        for (let i = 0; i < 5; i++) {

            this.box(
                "Ladeflächenstreifen",
                0.08, 0.04, 2.5,
                B.yellow,
                -3.7 + i * 1,
                -1.72,
                0
            );
        }

        // Innenbeleuchtung
        this.box(
            "Tür-Innenlicht",
            0.2, 0.2, 2.5,
            B.yellow,
            0.5, 1.3, 0
        );
    }

    // ======================================
    // DEKORATIVE GATLING-ATTRAPPE
    // ======================================

    createDecorativeGatling() {

        const B = this.materials;

        const gun = new THREE.Group();

        gun.position.set(-2.2, -0.3, 2.85);

        // Halterung
        const mount = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 0.6, 1.2),
            B.dark
        );

        gun.add(mount);

        // Gehäuse
        const housing = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.8, 1.2),
            B.armor
        );

        housing.position.set(0.5, 0.1, 0);
        gun.add(housing);

        // Statische, rein dekorative Rohrgruppe
        // Keine Schussfunktion und keine Mechanik.

        const barrelMaterial = B.black;

        for (let i = 0; i < 6; i++) {

            const angle = (i / 6) * Math.PI * 2;

            const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    0.09, 0.09, 1.5, 8
                ),
                barrelMaterial
            );

            barrel.rotation.z = Math.PI / 2;

            barrel.position.set(
                1.35,
                Math.cos(angle) * 0.28,
                Math.sin(angle) * 0.28
            );

            gun.add(barrel);
        }

        // Schutzschild
        const shield = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 1.3, 1.8),
            B.armor
        );

        shield.position.set(-0.4, 0.1, 0);
        gun.add(shield);

        this.group.add(gun);
    }

    // ======================================
    // KLEINE DETAILS
    // ======================================

    createDetails() {

        const B = this.materials;

        // Wartungsklappen am Rumpf
        for (let i = 0; i < 8; i++) {

            this.box(
                "Wartungsklappe",
                0.8, 0.08, 0.08,
                B.metal,
                4 - i * 1.5,
                1.95,
                2.2
            );
        }

        // Kleine Sensoren
        this.box(
            "Sensor",
            0.6, 0.3, 0.5,
            B.dark,
            4, 2, -0.5
        );

        // Antennen
        this.cylinder(
            "Dachantenne",
            0.06, 0.06, 1.2,
            B.black,
            -2, 2.6, -0.5
        );

        // Seitliche Militärmarkierungen
        this.box(
            "Markierung",
            1.2, 0.7, 0.08,
            B.yellow,
            3, 0, -2.38
        );

        this.box(
            "Markierung",
            1.2, 0.7, 0.08,
            B.yellow,
            3, 0, 2.38
        );

        // Kleine Positionsleuchten
        this.createLight(0x35ff88, 0, 0.5, 11.7);
        this.createLight(0xff3333, 0, 0.5, -11.7);
    }

    // ======================================
    // LICHTER
    // ======================================

    createLight(color, x, y, z) {

        const light = new THREE.PointLight(
            color,
            2,
            5
        );

        light.position.set(x, y, z);

        this.group.add(light);

        const bulb = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 0.25, 0.25),
            new THREE.MeshBasicMaterial({ color })
        );

        bulb.position.set(x, y, z);

        this.group.add(bulb);

        this.lights.push(light);
    }

    // ======================================
    // FLUG STARTEN
    // ======================================

    start() {

        if (this.finished) {
            this.reset();
        }

        this.active = true;
        this.progress = 0;
    }

    // ======================================
    // FLUG STOPPEN
    // ======================================

    stop() {
        this.active = false;
    }

    // ======================================
    // FLUGZEUG UPDATE
    // ======================================

    update(delta) {

        if (!this.active) return;

        const distance = this.startPosition.distanceTo(
            this.endPosition
        );

        if (distance <= 0) {
            this.stop();
            return;
        }

        this.progress += (this.speed * delta) / distance;

        if (this.progress >= 1) {

            this.progress = 1;
            this.active = false;
            this.finished = true;
        }

        this.group.position.lerpVectors(
            this.startPosition,
            this.endPosition,
            this.progress
        );

        const direction = new THREE.Vector3()
            .subVectors(this.endPosition, this.startPosition)
            .normalize();

        this.group.rotation.y = Math.atan2(
            -direction.z,
            direction.x
        );
    }

    // ======================================
    // RESET
    // ======================================

    reset() {

        this.progress = 0;
        this.active = false;
        this.finished = false;

        this.group.position.copy(this.startPosition);
    }

    // ======================================
    // POSITION
    // ======================================

    getPosition() {
        return this.group.position.clone();
    }

    // ======================================
    // ENTFERNEN
    // ======================================

    destroy() {

        this.scene.remove(this.group);

        this.group.traverse(object => {

            if (object.geometry) {
                object.geometry.dispose();
            }

            // Materialien werden gemeinsam genutzt.
            // Daher hier nicht einzeln entsorgen.

        });
    }
}

export default Flugzeug;
