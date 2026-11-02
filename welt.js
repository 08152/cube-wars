
import * as THREE from "three";

export class Welt {
    constructor(scene, options = {}) {
        this.scene = scene;

        // Weltgröße: 5 Kilometer
        this.size = options.size || 5000;
        this.segments = options.segments || 500;

        this.halfSize = this.size / 2;
        this.scale = this.size / 600;

        this.textures = {};
        this.textureLoader = new THREE.TextureLoader();

        this.material = null;
        this.terrain = null;
        this.ocean = null;

        this.seed = 12345;

        this.rivers = this.createRivers();
        this.biomes = this.createBiomes();

        this.loadTextures();
        this.createTerrain();
        this.createOcean();
    }

    // -----------------------------------------
    // TEXTUREN
    // -----------------------------------------

    loadTextures() {
        const textureFiles = {
            grass: "./grass.png",
            stone: "./stein.png",
            sand: "./sand.png",
            ice: "./eis.png",
            jungle: "./jungle.png"
        };

        for (const [name, path] of Object.entries(textureFiles)) {
            const texture = this.textureLoader.load(
                path,
                () => {
                    console.log("Textur geladen:", path);
                },
                undefined,
                (error) => {
                    console.error("Textur konnte nicht geladen werden:", path, error);
                }
            );

            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;

            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 8;

            this.textures[name] = texture;
        }
    }

    // -----------------------------------------
    // BIOME
    // -----------------------------------------

    createBiomes() {
        const s = this.scale;

        return {
            desert: {
                x: 155 * s,
                z: 105 * s,
                rx: 88 * s,
                rz: 75 * s
            },

            ice: {
                x: -125 * s,
                z: -175 * s,
                rx: 80 * s,
                rz: 67 * s
            },

            jungle: {
                x: -190 * s,
                z: 125 * s,
                rx: 58 * s,
                rz: 48 * s
            }
        };
    }

    getBiomeAt(x, z) {
        const distance = (biome) => {
            const dx = (x - biome.x) / biome.rx;
            const dz = (z - biome.z) / biome.rz;
            return Math.sqrt(dx * dx + dz * dz);
        };

        if (distance(this.biomes.desert) < 1) return "desert";
        if (distance(this.biomes.ice) < 1) return "ice";
        if (distance(this.biomes.jungle) < 1) return "jungle";

        return "grass";
    }

    getBiome(x, z) {
        return this.getBiomeAt(x, z);
    }

    // -----------------------------------------
    // FLÜSSE
    // -----------------------------------------

    createRivers() {
        const s = this.scale;

        return [
            {
                width: 17 * s,
                depth: 5 * s,
                points: [
                    [-270 * s, -260 * s],
                    [-220 * s, -190 * s],
                    [-150 * s, -120 * s],
                    [-80 * s, -55 * s],
                    [0, 10 * s],
                    [85 * s, 70 * s],
                    [170 * s, 135 * s],
                    [260 * s, 230 * s]
                ]
            },
            {
                width: 10 * s,
                depth: 3.5 * s,
                points: [
                    [-210 * s, 110 * s],
                    [-145 * s, 85 * s],
                    [-90 * s, 55 * s],
                    [-25 * s, 20 * s],
                    [0, 10 * s]
                ]
            },
            {
                width: 9 * s,
                depth: 3 * s,
                points: [
                    [120 * s, -240 * s],
                    [105 * s, -170 * s],
                    [85 * s, -100 * s],
                    [85 * s, 70 * s]
                ]
            }
        ];
    }

    distanceToSegment(px, pz, ax, az, bx, bz) {
        const dx = bx - ax;
        const dz = bz - az;

        const lengthSquared = dx * dx + dz * dz;

        if (lengthSquared === 0) {
            return Math.hypot(px - ax, pz - az);
        }

        let t = ((px - ax) * dx + (pz - az) * dz) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const x = ax + t * dx;
        const z = az + t * dz;

        return Math.hypot(px - x, pz - z);
    }

    getRiverData(x, z) {
        let strongest = 0;
        let riverDepth = 0;

        for (const river of this.rivers) {
            for (let i = 0; i < river.points.length - 1; i++) {
                const a = river.points[i];
                const b = river.points[i + 1];

                const distance = this.distanceToSegment(
                    x, z,
                    a[0], a[1],
                    b[0], b[1]
                );

                const normalized = distance / river.width;

                const influence = 1 - THREE.MathUtils.smoothstep(
                    normalized,
                    0.55,
                    1.8
                );

                if (influence > strongest) {
                    strongest = influence;
                    riverDepth = river.depth;
                }
            }
        }

        return {
            mask: strongest,
            depth: riverDepth
        };
    }

    // -----------------------------------------
    // NATÜRLICHE LANDSCHAFT
    // -----------------------------------------

    noise(x, z) {
        const value = Math.sin(x * 0.013 + this.seed) *
            Math.cos(z * 0.017 - this.seed * 0.5);

        const detail = Math.sin(x * 0.037 + z * 0.021) *
            Math.cos(z * 0.031 - x * 0.019);

        return value * 0.65 + detail * 0.35;
    }

    smoothNoise(x, z, scale) {
        const sx = x * scale;
        const sz = z * scale;

        const ix = Math.floor(sx);
        const iz = Math.floor(sz);

        const fx = sx - ix;
        const fz = sz - iz;

        const fade = (t) => t * t * (3 - 2 * t);

        const a = this.noise(ix, iz);
        const b = this.noise(ix + 1, iz);
        const c = this.noise(ix, iz + 1);
        const d = this.noise(ix + 1, iz + 1);

        const u = fade(fx);
        const v = fade(fz);

        const top = THREE.MathUtils.lerp(a, b, u);
        const bottom = THREE.MathUtils.lerp(c, d, u);

        return THREE.MathUtils.lerp(top, bottom, v);
    }

    getHeightAt(x, z) {
        const normalizedX = x / this.halfSize;
        const normalizedZ = z / this.halfSize;

        const distance = Math.sqrt(
            normalizedX * normalizedX +
            normalizedZ * normalizedZ
        );

        // Sanft abfallende Küsten
        const coast = 1 - THREE.MathUtils.smoothstep(
            distance,
            0.72,
            1.0
        );

        if (coast <= 0) return -12;

        // Große Landschaftsformen
        const broadHills =
            this.smoothNoise(x, z, 0.00065) * 23 +
            this.smoothNoise(x + 800, z - 400, 0.0015) * 12;

        // Kleinere natürliche Unebenheiten
        const smallHills =
            this.smoothNoise(x + 1500, z + 900, 0.005) * 5 +
            this.smoothNoise(x - 300, z + 600, 0.013) * 1.5;

        // Einige höhere Gebiete
        const mountainRegion = Math.max(
            0,
            this.smoothNoise(x - 300, z - 700, 0.0009)
        );

        const mountains = Math.pow(mountainRegion, 2) * 27;

        let height = 15 + broadHills + smallHills + mountains;

        // Landschaft zur Küste absenken
        height *= coast;

        // Flusstäler in die Landschaft schneiden
        const river = this.getRiverData(x, z);

        height -= river.mask * river.depth;

        // Flussufer etwas weicher gestalten
        height -= river.mask * 1.5;

        return height;
    }

    getGroundHeight(x, z) {
        return this.getHeightAt(x, z);
    }

    getSlopeAt(x, z) {
        const step = 2;

        const h1 = this.getHeightAt(x + step, z);
        const h2 = this.getHeightAt(x - step, z);
        const h3 = this.getHeightAt(x, z + step);
        const h4 = this.getHeightAt(x, z - step);

        const dx = (h1 - h2) / (step * 2);
        const dz = (h3 - h4) / (step * 2);

        return Math.sqrt(dx * dx + dz * dz);
    }

    isInsideWorld(x, z) {
        return Math.hypot(x, z) < this.halfSize;
    }

    // -----------------------------------------
    // TERRAIN ERSTELLEN
    // -----------------------------------------

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

        this.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 1,
            metalness: 0
        });

        this.material.onBeforeCompile = (shader) => {
            shader.uniforms.grassMap = { value: this.textures.grass };
            shader.uniforms.stoneMap = { value: this.textures.stone };
            shader.uniforms.sandMap = { value: this.textures.sand };
            shader.uniforms.iceMap = { value: this.textures.ice };
            shader.uniforms.jungleMap = { value: this.textures.jungle };

            shader.vertexShader = shader.vertexShader.replace(
                "#include <common>",
                `
                #include <common>
                varying vec3 vTerrainWorldPosition;
                varying vec3 vTerrainNormal;
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                "#include <worldpos_vertex>",
                `
                #include <worldpos_vertex>
                vTerrainWorldPosition = worldPosition.xyz;
                vTerrainNormal = normalize(mat3(modelMatrix) * normal);
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

                varying vec3 vTerrainWorldPosition;
                varying vec3 vTerrainNormal;

                float biomeMask(vec2 p, vec2 center, vec2 radius) {
                    vec2 d = (p - center) / radius;
                    float dist = length(d);
                    return 1.0 - smoothstep(0.78, 1.18, dist);
                }
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <map_fragment>",
                `
                vec2 terrainUV = vTerrainWorldPosition.xz * 0.004;

                vec4 grassColor = texture2D(grassMap, terrainUV);
                vec4 stoneColor = texture2D(stoneMap, terrainUV * 1.15);
                vec4 sandColor = texture2D(sandMap, terrainUV * 0.9);
                vec4 iceColor = texture2D(iceMap, terrainUV);
                vec4 jungleColor = texture2D(jungleMap, terrainUV * 1.1);

                float slope = 1.0 - max(dot(
                    normalize(vTerrainNormal),
                    vec3(0.0, 1.0, 0.0)
                ), 0.0);

                float rockMask = smoothstep(0.28, 0.65, slope);

                vec2 p = vTerrainWorldPosition.xz;

                float desertMask = biomeMask(
                    p,
                    vec2(${this.biomes.desert.x}, ${this.biomes.desert.z}),
                    vec2(${this.biomes.desert.rx}, ${this.biomes.desert.rz})
                );

                float iceMask = biomeMask(
                    p,
                    vec2(${this.biomes.ice.x}, ${this.biomes.ice.z}),
                    vec2(${this.biomes.ice.rx}, ${this.biomes.ice.rz})
                );

                float jungleMask = biomeMask(
                    p,
                    vec2(${this.biomes.jungle.x}, ${this.biomes.jungle.z}),
                    vec2(${this.biomes.jungle.rx}, ${this.biomes.jungle.rz})
                );

                float beachMask = 1.0 - smoothstep(
                    1.0,
                    5.0,
                    vTerrainWorldPosition.y
                );

                vec3 terrainColor = grassColor.rgb;

                terrainColor = mix(
                    terrainColor,
                    sandColor.rgb,
                    desertMask
                );

                terrainColor = mix(
                    terrainColor,
                    iceColor.rgb,
                    iceMask
                );

                terrainColor = mix(
                    terrainColor,
                    jungleColor.rgb,
                    jungleMask
                );

                terrainColor = mix(
                    terrainColor,
                    stoneColor.rgb,
                    rockMask
                );

                terrainColor = mix(
                    terrainColor,
                    sandColor.rgb,
                    beachMask * 0.85
                );

                diffuseColor.rgb *= terrainColor;
                `
            );
        };

        this.terrain = new THREE.Mesh(
            geometry,
            this.material
        );

        this.terrain.name = "CubeWars_Terrain";
        this.terrain.receiveShadow = true;
        this.terrain.castShadow = true;

        this.scene.add(this.terrain);
    }

    // -----------------------------------------
    // OZEAN
    // -----------------------------------------

    createOcean() {
        const geometry = new THREE.PlaneGeometry(
            this.size * 3,
            this.size * 3,
            1,
            1
        );

        geometry.rotateX(-Math.PI / 2);

        const material = new THREE.MeshStandardMaterial({
            color: 0x1688bd,
            roughness: 0.28,
            metalness: 0.05
        });

        this.ocean = new THREE.Mesh(
            geometry,
            material
        );

        this.ocean.name = "CubeWars_Ocean";
        this.ocean.position.y = -12;
        this.ocean.receiveShadow = true;

        this.scene.add(this.ocean);
    }

    // -----------------------------------------
    // ZUGRIFF AUF DAS TERRAIN
    // -----------------------------------------

    getTerrain() {
        return this.terrain;
    }

    // -----------------------------------------
    // AUFRÄUMEN
    // -----------------------------------------

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

        console.log("Welt entfernt.");
    }
}
