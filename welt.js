
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

    // --------------------------------------------------
    // TEXTUREN
    // --------------------------------------------------

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
                () => console.log("Textur geladen:", name),
                undefined,
                () => console.error("Textur fehlt:", path)
            );

            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 8;

            this.textures[name] = texture;
        }
    }

    // --------------------------------------------------
    // HILFSFUNKTIONEN
    // --------------------------------------------------

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    smoothstep(a, b, value) {
        const t = this.clamp((value - a) / (b - a), 0, 1);
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

    // --------------------------------------------------
    // INSELFORM
    // --------------------------------------------------

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

    // --------------------------------------------------
    // BERGE UND HÜGEL
    // --------------------------------------------------

    mountain(x, z, cx, cz, rx, rz, height) {
        const dx = (x - cx) / rx;
        const dz = (z - cz) / rz;

        const distance = Math.sqrt(dx * dx + dz * dz);
        const irregular = this.noise(x * 1.4, z * 1.4) * 0.12;

        const shape = Math.max(0, 1 - distance + irregular);

        return height * shape * shape;
    }

    hills(x, z) {
        return (
            Math.sin(x * 0.014 + z * 0.006) * 4 +
            Math.cos(z * 0.019 - x * 0.008) * 3 +
            this.noise(x, z) * 5
        );
    }

    // --------------------------------------------------
    // LANDSCHAFTSHÖHE
    // --------------------------------------------------

    getHeightAt(x, z) {
        const island = this.islandMask(x, z);

        if (island <= 0.001) {
            return -24;
        }

        let height = 5;

        // Grundlandschaft
        height += this.hills(x, z);

        // Große Bergketten
        height += this.mountain(x, z, -100, -45, 105, 120, 66);
        height += this.mountain(x, z, 35, 95, 90, 95, 47);
        height += this.mountain(x, z, 135, -100, 75, 85, 35);
        height += this.mountain(x, z, -180, 85, 55, 75, 27);

        // Weitere kleinere Berggruppen
        height += this.mountain(x, z, 15, -170, 55, 48, 19);
        height += this.mountain(x, z, -190, -125, 45, 48, 17);
        height += this.mountain(x, z, 185, 100, 42, 55, 15);

        // Bergstruktur
        const ridge =
            Math.abs(Math.sin(x * 0.035 + z * 0.019)) *
            Math.abs(Math.cos(z * 0.026));

        height += ridge * 5;

        // Täler
        const valley =
            Math.sin(x * 0.011 + 1.2) * 25 +
            Math.cos(x * 0.006) * 12;

        const valleyDistance = Math.abs(z - valley);
        const valleyMask = 1 - this.smoothstep(8, 35, valleyDistance);

        height -= valleyMask * 7;

        // Flussartige Senke
        const riverPath = Math.sin(x * 0.012) * 34 + 15;
        const riverDistance = Math.abs(z - riverPath);
        const river = 1 - this.smoothstep(4, 15, riverDistance);

        height -= river * 4;

        // Küstenabfall
        const coast = this.smoothstep(
            0.83,
            1.035,
            this.distanceToIsland(x, z)
        );

        height = THREE.MathUtils.lerp(height, -24, coast);

        return THREE.MathUtils.lerp(-24, height, island);
    }

    getGroundHeight(x, z) {
        return this.getHeightAt(x, z);
    }

    // --------------------------------------------------
    // BIOME
    // --------------------------------------------------

    ellipseMask(x, z, cx, cz, rx, rz) {
        const dx = (x - cx) / rx;
        const dz = (z - cz) / rz;

        const distortion = this.noise(x + cx, z + cz) * 0.10;
        const distance = Math.sqrt(dx * dx + dz * dz) + distortion;

        return 1 - this.smoothstep(0.82, 1.08, distance);
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

    // --------------------------------------------------
    // TERRAIN ERSTELLEN
    // --------------------------------------------------

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

            positions.setY(i, this.getHeightAt(x, z));
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

    // --------------------------------------------------
    // ECHTE BIOME-TEXTUREN
    // --------------------------------------------------

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

            shader.vertexShader = shader.vertexShader.replace(
                "#include <common>",
                `
                #include <common>

                varying vec3 vWorldPosition;
                varying vec3 vTerrainNormal;
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",
                `
                #include <begin_vertex>

                vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);

                vWorldPosition = worldPosition.xyz;
                vTerrainNormal = normalize(normal);
                `
            );

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
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <map_fragment>",
                `
                vec2 worldUV = vWorldPosition.xz * 0.018;

                vec3 grassColor = texture2D(
                    grassMap,
                    worldUV
                ).rgb;

                vec3 stoneColor = texture2D(
                    stoneMap,
                    worldUV * 1.15
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

                // Biome-Grenzen
                vec2 worldXZ = vWorldPosition.xz;

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

                // Übergänge zwischen den Biomen
                float biomeBlend = 0.035;

                vec3 terrainColor = grassColor;

                terrainColor = mix(
                    terrainColor,
                    sandColor,
                    smoothstep(
                        0.0,
                        biomeBlend,
                        desertMask
                    )
                );

                terrainColor = mix(
                    terrainColor,
                    iceColor,
                    smoothstep(
                        0.0,
                        biomeBlend,
                        iceMask
                    )
                );

                terrainColor = mix(
                    terrainColor,
                    jungleColor,
                    smoothstep(
                        0.0,
                        biomeBlend,
                        jungleMask
                    )
                );

                // Strand entlang der Küste
                float islandDistance = terrainIslandDistance(
                    worldXZ
                );

                float beachMask =
                    smoothstep(0.78, 0.91, islandDistance) *
                    (1.0 - smoothstep(0.94, 1.015, islandDistance));

                terrainColor = mix(
                    terrainColor,
                    sandColor,
                    beachMask * 0.9
                );

                // Felsige Berghänge
                float slope = 1.0 - abs(vTerrainNormal.y);

                float rockMask = smoothstep(
                    0.24,
                    0.72,
                    slope
                );

                // Hohe Bergregionen bekommen mehr Stein
                float mountainMask = smoothstep(
                    28.0,
                    65.0,
                    vWorldPosition.y
                );

                rockMask = max(
                    rockMask,
                    mountainMask * 0.65
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

        material.customProgramCacheKey = () => "cube-wars-biome-terrain-v3";

        return material;
    }

    // --------------------------------------------------
    // MEER
    // --------------------------------------------------

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

    // --------------------------------------------------
    // ZUGRIFF AUF TERRAIN
    // --------------------------------------------------

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

    // --------------------------------------------------
    // AUFRÄUMEN
    // --------------------------------------------------

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
