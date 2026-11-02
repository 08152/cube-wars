
import * as THREE from "three";

export class Welt {
    constructor(scene, options = {}) {
        this.scene = scene;

        this.size = options.size ?? 600;
        this.segments = options.segments ?? 400;
        this.halfSize = this.size / 2;

        this.textures = {};
        this.textureLoader = new THREE.TextureLoader();

        this.loadTextures();
        this.createTerrain();
        this.createOcean();
    }

    // ==========================================
    // TEXTUREN
    // ==========================================

    loadTextures() {
        const files = {
            grass: "./grass.png",
            stone: "./stein.png",
            sand: "./sand.png",
            ice: "./eis.png",
            jungle: "./jungle.png"
        };

        for (const [name, path] of Object.entries(files)) {
            const texture = this.textureLoader.load(
                path,
                () => {
                    console.log("CUBE WARS: Textur geladen:", name);
                    texture.needsUpdate = true;
                },
                undefined,
                (error) => {
                    console.error(
                        "CUBE WARS: Textur konnte nicht geladen werden:",
                        path,
                        error
                    );
                }
            );

            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;

            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 8;

            this.textures[name] = texture;
        }
    }

    // ==========================================
    // MATHEMATIK
    // ==========================================

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    smoothstep(a, b, value) {
        const t = this.clamp(
            (value - a) / (b - a),
            0,
            1
        );

        return t * t * (3 - 2 * t);
    }

    noise(x, z) {
        return (
            Math.sin(x * 0.018 + z * 0.009) * 0.42 +
            Math.cos(z * 0.025 - x * 0.013) * 0.30 +
            Math.sin((x + z) * 0.042) * 0.16 +
            Math.cos((x - z) * 0.009) * 0.12
        );
    }

    // ==========================================
    // INSEL
    // ==========================================

    distanceToIsland(x, z) {
        const angle = Math.atan2(z, x);

        const irregularity =
            1 +
            Math.sin(angle * 5 + 1.2) * 0.055 +
            Math.cos(angle * 9 - 0.8) * 0.035 +
            Math.sin(angle * 13 + 2.4) * 0.018;

        const dx = x / (this.halfSize * 0.91);
        const dz = z / (this.halfSize * 0.87);

        return Math.sqrt(dx * dx + dz * dz) / irregularity;
    }

    islandMask(x, z) {
        return 1 - this.smoothstep(
            0.91,
            1.035,
            this.distanceToIsland(x, z)
        );
    }

    isInsideWorld(x, z) {
        return this.distanceToIsland(x, z) < 1.02;
    }

    // ==========================================
    // NATÜRLICHE HÜGEL
    // ==========================================

    roundedHill(x, z, cx, cz, radiusX, radiusZ, height) {
        const dx = (x - cx) / radiusX;
        const dz = (z - cz) / radiusZ;

        const distance = Math.sqrt(dx * dx + dz * dz);

        const irregular =
            this.noise(x * 1.3, z * 1.3) * 0.08;

        const shape = Math.max(
            0,
            1 - distance + irregular
        );

        return height * shape * shape;
    }

    rollingHills(x, z) {
        return (
            Math.sin(x * 0.012 + z * 0.004) * 2.8 +
            Math.cos(z * 0.014 - x * 0.006) * 2.2 +
            Math.sin(x * 0.026 + z * 0.019) * 0.8 +
            this.noise(x, z) * 2.2
        );
    }

    // ==========================================
    // FLUSSBETTEN
    // ==========================================

    getRiverData(x, z) {
        // Hauptfluss: lang und leicht geschwungen.
        const mainRiverPath =
            Math.sin(x * 0.008) * 48 +
            Math.sin(x * 0.019) * 12 -
            25;

        const mainDistance = Math.abs(z - mainRiverPath);

        // Zweiter Flussarm.
        const branchPath =
            -Math.sin((x + 90) * 0.009) * 34 +
            105;

        const branchDistance = Math.abs(z - branchPath);

        // Kleiner Nebenfluss.
        const smallPath =
            Math.sin((x - 110) * 0.014) * 19 -
            135;

        const smallDistance = Math.abs(z - smallPath);

        const main = 1 - this.smoothstep(
            4,
            17,
            mainDistance
        );

        const branch = 1 - this.smoothstep(
            3,
            11,
            branchDistance
        );

        const small = 1 - this.smoothstep(
            2.5,
            8,
            smallDistance
        );

        return {
            main,
            branch,
            small,
            combined: Math.max(
                main,
                branch * 0.8,
                small * 0.65
            )
        };
    }

    // ==========================================
    // GELÄNDEHÖHE
    // ==========================================

    getHeightAt(x, z) {
        const island = this.islandMask(x, z);

        if (island <= 0.001) {
            return -24;
        }

        let height = 5;

        // Sanfte Grundlandschaft.
        height += this.rollingHills(x, z);

        // Breite, abgerundete Hügel.
        height += this.roundedHill(
            x, z, -105, -35, 115, 95, 17
        );

        height += this.roundedHill(
            x, z, 55, 105, 105, 95, 13
        );

        height += this.roundedHill(
            x, z, 145, -100, 85, 90, 12
        );

        height += this.roundedHill(
            x, z, -190, 95, 65, 70, 10
        );

        height += this.roundedHill(
            x, z, 5, -185, 75, 55, 8
        );

        height += this.roundedHill(
            x, z, 190, 110, 50, 60, 7
        );

        // Kleine natürliche Unebenheiten.
        height += this.noise(x * 1.8, z * 1.8) * 1.3;

        // Flache Senken für die Flüsse.
        const rivers = this.getRiverData(x, z);

        height -= rivers.main * 2.8;
        height -= rivers.branch * 2.1;
        height -= rivers.small * 1.5;

        // Breitere, sanfte Flusstäler.
        height -= rivers.combined * 1.5;

        // Küste: weicher Abfall ins Meer.
        const coast = this.smoothstep(
            0.82,
            1.035,
            this.distanceToIsland(x, z)
        );

        height = THREE.MathUtils.lerp(
            height,
            -24,
            coast
        );

        return THREE.MathUtils.lerp(
            -24,
            height,
            island
        );
    }

    getGroundHeight(x, z) {
        return this.getHeightAt(x, z);
    }

    // ==========================================
    // BIOME
    // ==========================================

    ellipseMask(x, z, cx, cz, rx, rz) {
        const dx = (x - cx) / rx;
        const dz = (z - cz) / rz;

        const distortion =
            this.noise(x + cx, z + cz) * 0.10;

        const distance =
            Math.sqrt(dx * dx + dz * dz) + distortion;

        return 1 - this.smoothstep(
            0.82,
            1.08,
            distance
        );
    }

    getBiomeAt(x, z) {
        const desert = this.ellipseMask(
            x, z, 155, 105, 88, 75
        );

        const ice = this.ellipseMask(
            x, z, -125, -175, 80, 67
        );

        const jungle = this.ellipseMask(
            x, z, -190, 125, 58, 48
        );

        if (ice > 0.5) return "ice";
        if (desert > 0.5) return "sand";
        if (jungle > 0.5) return "jungle";

        return "grass";
    }

    getBiome(x, z) {
        return this.getBiomeAt(x, z);
    }

    // ==========================================
    // TERRAIN ERSTELLEN
    // ==========================================

    createTerrain() {
        const geometry = new THREE.PlaneGeometry(
            this.size,
            this.size,
            this.segments,
            this.segments
        );

        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position;

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);

            positions.setY(
                i,
                this.getHeightAt(x, z)
            );
        }

        positions.needsUpdate = true;

        geometry.computeVertexNormals();

        this.material = this.createTerrainMaterial();

        this.terrain = new THREE.Mesh(
            geometry,
            this.material
        );

        this.terrain.name = "CUBE_WARS_WORLD";
        this.terrain.receiveShadow = true;
        this.terrain.castShadow = false;

        this.scene.add(this.terrain);
    }

    // ==========================================
    // TEXTUR-SHADER
    // ==========================================

    createTerrainMaterial() {
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 1,
            metalness: 0
        });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.grassMap = {
                value: this.textures.grass
            };

            shader.uniforms.stoneMap = {
                value: this.textures.stone
            };

            shader.uniforms.sandMap = {
                value: this.textures.sand
            };

            shader.uniforms.iceMap = {
                value: this.textures.ice
            };

            shader.uniforms.jungleMap = {
                value: this.textures.jungle
            };

            // Vertex-Shader
            shader.vertexShader = shader.vertexShader.replace(
                "#include <common>",
                `
                #include <common>

                varying vec3 vWorldPosition;
                varying vec3 vTerrainNormal;
                `
            );

            // WICHTIG:
            // worldPosition wird vom Three.js-Shader bereits erzeugt.
            // Wir verwenden diese Variable nur, statt sie doppelt anzulegen.
            shader.vertexShader = shader.vertexShader.replace(
                "#include <worldpos_vertex>",
                `
                #include <worldpos_vertex>

                vWorldPosition = worldPosition.xyz;
                vTerrainNormal = normalize(
                    mat3(modelMatrix) * normal
                );
                `
            );

            // Fragment-Shader
            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <common>",
                `
                #include <common>

                uniform sampler2D grassMap;
                uniform sampler2D stoneMap;
                uniform sampler2D sandMap;
                uniform sampler2D iceMap;
                uniform sampler2D jungleMap;

                varying vec3 vWorldPosition;
                varying vec3 vTerrainNormal;

                float terrainNoise(vec2 p) {
                    return
                        sin(p.x * 0.018 + p.y * 0.009) * 0.42 +
                        cos(p.y * 0.025 - p.x * 0.013) * 0.30 +
                        sin((p.x + p.y) * 0.042) * 0.16;
                }

                float terrainEllipse(
                    vec2 p,
                    vec2 center,
                    vec2 radius
                ) {
                    vec2 d = (p - center) / radius;

                    float distortion =
                        terrainNoise(p + center) * 0.10;

                    float distanceValue =
                        length(d) + distortion;

                    return 1.0 - smoothstep(
                        0.82,
                        1.08,
                        distanceValue
                    );
                }

                float terrainIslandDistance(vec2 p) {
                    float angle = atan(p.y, p.x);

                    float irregularity =
                        1.0 +
                        sin(angle * 5.0 + 1.2) * 0.055 +
                        cos(angle * 9.0 - 0.8) * 0.035 +
                        sin(angle * 13.0 + 2.4) * 0.018;

                    vec2 d = vec2(
                        p.x / 273.0,
                        p.y / 261.0
                    );

                    return length(d) / irregularity;
                }

                float riverMask(vec2 p) {
                    float mainPath =
                        sin(p.x * 0.008) * 48.0 +
                        sin(p.x * 0.019) * 12.0 -
                        25.0;

                    float branchPath =
                        -sin((p.x + 90.0) * 0.009) * 34.0 +
                        105.0;

                    float smallPath =
                        sin((p.x - 110.0) * 0.014) * 19.0 -
                        135.0;

                    float mainRiver =
                        1.0 - smoothstep(
                            4.0,
                            17.0,
                            abs(p.y - mainPath)
                        );

                    float branchRiver =
                        1.0 - smoothstep(
                            3.0,
                            11.0,
                            abs(p.y - branchPath)
                        );

                    float smallRiver =
                        1.0 - smoothstep(
                            2.5,
                            8.0,
                            abs(p.y - smallPath)
                        );

                    return max(
                        mainRiver,
                        max(
                            branchRiver * 0.8,
                            smallRiver * 0.65
                        )
                    );
                }
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <map_fragment>",
                `
                // Weltkoordinaten statt kleiner UV-Flächen.
                vec2 worldXZ = vWorldPosition.xz;

                // Kleinere Zahl = größere Texturmuster.
                vec2 worldUV = worldXZ * 0.010;

                vec3 grassColor = texture2D(
                    grassMap,
                    worldUV
                ).rgb;

                vec3 stoneColor = texture2D(
                    stoneMap,
                    worldUV * 0.95
                ).rgb;

                vec3 sandColor = texture2D(
                    sandMap,
                    worldUV
                ).rgb;

                vec3 iceColor = texture2D(
                    iceMap,
                    worldUV
                ).rgb;

                vec3 jungleColor = texture2D(
                    jungleMap,
                    worldUV
                ).rgb;

                // Biome
                float desertMask = terrainEllipse(
                    worldXZ,
                    vec2(155.0, 105.0),
                    vec2(88.0, 75.0)
                );

                float iceMask = terrainEllipse(
                    worldXZ,
                    vec2(-125.0, -175.0),
                    vec2(80.0, 67.0)
                );

                float jungleMask = terrainEllipse(
                    worldXZ,
                    vec2(-190.0, 125.0),
                    vec2(58.0, 48.0)
                );

                vec3 terrainColor = grassColor;

                terrainColor = mix(
                    terrainColor,
                    sandColor,
                    smoothstep(0.0, 0.08, desertMask)
                );

                terrainColor = mix(
                    terrainColor,
                    iceColor,
                    smoothstep(0.0, 0.08, iceMask)
                );

                terrainColor = mix(
                    terrainColor,
                    jungleColor,
                    smoothstep(0.0, 0.08, jungleMask)
                );

                // Strand an der Küste
                float islandDistance =
                    terrainIslandDistance(worldXZ);

                float beachMask =
                    smoothstep(0.78, 0.91, islandDistance) *
                    (1.0 - smoothstep(0.94, 1.015, islandDistance));

                terrainColor = mix(
                    terrainColor,
                    sandColor,
                    beachMask * 0.9
                );

                // Flussbetten erhalten einen sandigen Untergrund.
                float river = riverMask(worldXZ);

                terrainColor = mix(
                    terrainColor,
                    sandColor,
                    river * 0.85
                );

                // Felsige Hänge.
                float slope = 1.0 - abs(vTerrainNormal.y);

                float rockMask = smoothstep(
                    0.28,
                    0.72,
                    slope
                );

                // Nur ein leichter Steinanteil auf hohen Flächen.
                float highLand = smoothstep(
                    24.0,
                    48.0,
                    vWorldPosition.y
                );

                rockMask = max(
                    rockMask,
                    highLand * 0.35
                );

                terrainColor = mix(
                    terrainColor,
                    stoneColor,
                    rockMask
                );

                diffuseColor.rgb *= terrainColor;
                `
            );
        };

        material.customProgramCacheKey = () =>
            "cube-wars-natural-terrain-v4";

        return material;
    }

    // ==========================================
    // MEER
    // ==========================================

    createOcean() {
        const geometry = new THREE.PlaneGeometry(
            2000,
            2000,
            1,
            1
        );

        geometry.rotateX(-Math.PI / 2);

        const material = new THREE.MeshStandardMaterial({
            color: 0x267fa3,
            roughness: 0.28,
            metalness: 0.12
        });

        this.ocean = new THREE.Mesh(
            geometry,
            material
        );

        this.ocean.name = "CUBE_WARS_OCEAN";
        this.ocean.position.y = -24;
        this.ocean.receiveShadow = true;

        this.scene.add(this.ocean);
    }

    // ==========================================
    // ZUGRIFF
    // ==========================================

    getTerrain() {
        return this.terrain;
    }

    getSlopeAt(x, z) {
        const step = 2;

        const left = this.getHeightAt(x - step, z);
        const right = this.getHeightAt(x + step, z);

        const back = this.getHeightAt(x, z - step);
        const front = this.getHeightAt(x, z + step);

        const dx = (right - left) / (step * 2);
        const dz = (front - back) / (step * 2);

        return Math.sqrt(dx * dx + dz * dz);
    }

    // ==========================================
    // AUFRÄUMEN
    // ==========================================

    destroy() {
        if (this.terrain) {
            this.scene.remove(this.terrain);

            this.terrain.geometry.dispose();
            this.terrain.material.dispose();
        }

        if (this.ocean) {
            this.scene.remove(this.ocean);

            this.ocean.geometry.dispose();
            this.ocean.material.dispose();
        }

        for (const texture of Object.values(this.textures)) {
            texture.dispose();
        }
    }
}
