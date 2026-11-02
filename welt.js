
import * as THREE from "three";

export class Welt {
  constructor(scene, options = {}) {
    this.scene = scene;

    this.size = options.size ?? 600;
    this.segments = options.segments ?? 320;

    this.textureLoader = new THREE.TextureLoader();

    // Alle fünf Texturen
    this.grassTexture = this.loadTexture("./grass.png");
    this.stoneTexture = this.loadTexture("./stein.png");
    this.sandTexture = this.loadTexture("./sand.png");
    this.iceTexture = this.loadTexture("./eis.png");
    this.jungleTexture = this.loadTexture("./jungle.png");

    this.terrain = null;
    this.material = null;

    // Feste Flussverläufe – noch ohne Wasser
    this.rivers = [
      [
        [-270, -175],
        [-220, -145],
        [-180, -105],
        [-125, -85],
        [-80, -40],
        [-30, -20],
        [20, 15],
        [75, 30],
        [120, 75],
        [170, 110],
        [230, 145],
        [280, 180]
      ],
      [
        [-275, 75],
        [-225, 65],
        [-185, 35],
        [-145, 5],
        [-110, -10],
        [-75, -5],
        [-35, 20]
      ],
      [
        [30, -275],
        [50, -225],
        [75, -185],
        [90, -145],
        [85, -105],
        [65, -65],
        [35, -35]
      ]
    ];

    this.create();
  }

  // ==================================================
  // TEXTUREN
  // ==================================================

  loadTexture(path) {
    const texture = this.textureLoader.load(
      path,
      undefined,
      undefined,
      () => console.warn("Textur nicht gefunden:", path)
    );

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    texture.repeat.set(38, 38);

    return texture;
  }

  // ==================================================
  // HILFSFUNKTIONEN
  // ==================================================

  smooth(a, b, value) {
    const t = THREE.MathUtils.clamp(
      (value - a) / (b - a),
      0,
      1
    );

    return t * t * (3 - 2 * t);
  }

  hill(x, z, cx, cz, rx, rz, height) {
    const dx = (x - cx) / rx;
    const dz = (z - cz) / rz;

    return height * Math.exp(-(dx * dx + dz * dz));
  }

  plateau(x, z, cx, cz, rx, rz, height) {
    const dx = (x - cx) / rx;
    const dz = (z - cz) / rz;

    const distance = Math.sqrt(dx * dx + dz * dz);

    const edge = 1 - this.smooth(
      0.72,
      1.12,
      distance
    );

    return height * edge;
  }

  // ==================================================
  // UNREGELMÄSSIGE QUADRAT-INSEL
  // ==================================================

  getIslandEdge(x, z) {
    const base = Math.max(
      Math.abs(x),
      Math.abs(z)
    );

    const coast =
      Math.sin(x * 0.035) * 7 +
      Math.cos(z * 0.031) * 8 +
      Math.sin((x + z) * 0.022) * 5 +
      Math.cos((x - z) * 0.018) * 4;

    return base + coast;
  }

  // ==================================================
  // FESTES GELÄNDE
  // ==================================================

  getBaseHeight(x, z) {
    let height = 4;

    // Zentrale Hochebene
    height += this.plateau(
      x, z, 0, 0, 155, 145, 10
    );

    // Westliche Berge
    height += this.hill(
      x, z, -125, -45, 65, 85, 35
    );

    height += this.hill(
      x, z, -180, -100, 38, 48, 20
    );

    // Östliche Berge
    height += this.hill(
      x, z, 135, 25, 65, 75, 30
    );

    height += this.hill(
      x, z, 180, 90, 38, 45, 16
    );

    // Nördlicher Bergrücken
    height += this.hill(
      x, z, 5, -165, 115, 38, 24
    );

    // Südliche Hügel
    height += this.hill(
      x, z, -70, 155, 75, 45, 17
    );

    height += this.hill(
      x, z, 105, 175, 65, 38, 13
    );

    // Täler
    height -= this.hill(
      x, z, 0, -85, 45, 95, 7
    );

    height -= this.hill(
      x, z, 30, 105, 95, 35, 6
    );

    height -= this.hill(
      x, z, -150, 75, 35, 70, 5
    );

    // Kleine feste Geländeunebenheiten
    height += Math.sin(x * 0.025) * 0.8;
    height += Math.cos(z * 0.022) * 0.7;
    height += Math.sin((x + z) * 0.018) * 0.5;

    return height;
  }

  // ==================================================
  // FLUSSBETTEN
  // ==================================================

  distanceToRiver(x, z, points) {
    let minDistance = Infinity;

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];

      const abX = b[0] - a[0];
      const abZ = b[1] - a[1];

      const lengthSquared = abX * abX + abZ * abZ;

      const t = THREE.MathUtils.clamp(
        ((x - a[0]) * abX + (z - a[1]) * abZ) /
          lengthSquared,
        0,
        1
      );

      const closestX = a[0] + abX * t;
      const closestZ = a[1] + abZ * t;

      const dx = x - closestX;
      const dz = z - closestZ;

      minDistance = Math.min(
        minDistance,
        Math.sqrt(dx * dx + dz * dz)
      );
    }

    return minDistance;
  }

  getRiverDepression(x, z) {
    let depression = 0;

    for (let i = 0; i < this.rivers.length; i++) {
      const distance = this.distanceToRiver(
        x,
        z,
        this.rivers[i]
      );

      const width = i === 0 ? 9 : 6;
      const bank = i === 0 ? 17 : 13;
      const depth = i === 0 ? 7 : 5;

      const channel = 1 - this.smooth(
        width,
        bank,
        distance
      );

      depression = Math.max(
        depression,
        channel * depth
      );
    }

    return depression;
  }

  getHeightAt(x, z) {
    let height = this.getBaseHeight(x, z);

    height -= this.getRiverDepression(x, z);

    const coast = this.smooth(
      255,
      278,
      this.getIslandEdge(x, z)
    );

    height = THREE.MathUtils.lerp(
      height,
      -18,
      coast
    );

    return height;
  }

  // ==================================================
  // NATÜRLICHE BIOME-FORMEN
  // ==================================================

  // Verzerrt die Koordinaten mit festen Wellen.
  // Dadurch entstehen unregelmäßige Küsten der Biome.

  warpBiomePosition(x, z) {
    const warpedX =
      x +
      Math.sin(z * 0.035) * 7 +
      Math.sin(z * 0.091) * 2.5 +
      Math.cos((x + z) * 0.025) * 3;

    const warpedZ =
      z +
      Math.cos(x * 0.031) * 6 +
      Math.sin(x * 0.073) * 2 +
      Math.cos((x - z) * 0.027) * 3;

    return [warpedX, warpedZ];
  }

  getBiomeMask(x, z, cx, cz, rx, rz) {
    const [wx, wz] = this.warpBiomePosition(x, z);

    const dx = (wx - cx) / rx;
    const dz = (wz - cz) / rz;

    let distance = Math.sqrt(dx * dx + dz * dz);

    const angle = Math.atan2(dz, dx);

    // Weitere feste Verzerrungen an der Grenze
    distance +=
      Math.sin(angle * 5 + distance * 3) * 0.045 +
      Math.sin(angle * 9 - distance * 4) * 0.022;

    // Breiter, weicher Übergang
    return 1 - this.smooth(
      0.82,
      1.12,
      distance
    );
  }

  getBiomeWeights(x, z) {
    return {
      grass: 1,
      desert: this.getBiomeMask(
        x, z, 155, 105, 88, 75
      ),
      ice: this.getBiomeMask(
        x, z, -125, -175, 80, 67
      ),
      jungle: this.getBiomeMask(
        x, z, -190, 125, 58, 48
      )
    };
  }

  getBiomeAt(x, z) {
    const weights = this.getBiomeWeights(x, z);

    let strongest = "grass";
    let highest = 0.5;

    for (const biome of ["desert", "ice", "jungle"]) {
      if (weights[biome] > highest) {
        highest = weights[biome];
        strongest = biome;
      }
    }

    return strongest;
  }

  // ==================================================
  // GELÄNDE ERSTELLEN
  // ==================================================

  create() {
    const geometry = this.createTerrainGeometry();

    this.material = this.createTerrainMaterial();

    this.terrain = new THREE.Mesh(
      geometry,
      this.material
    );

    this.terrain.name = "CUBE_WARS_ISLAND";
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = true;

    this.scene.add(this.terrain);

    this.createLighting();

    this.scene.background = new THREE.Color(0x9cc9e8);

    this.scene.fog = new THREE.Fog(
      0x9cc9e8,
      300,
      850
    );
  }

  createTerrainGeometry() {
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
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
  }

  // ==================================================
  // TEXTUR-SHADER
  // ==================================================

  createTerrainMaterial() {
    const material = new THREE.MeshStandardMaterial({
      map: this.grassTexture,
      roughness: 1,
      metalness: 0
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms.rockMap = {
        value: this.stoneTexture
      };

      shader.uniforms.sandMap = {
        value: this.sandTexture
      };

      shader.uniforms.iceMap = {
        value: this.iceTexture
      };

      shader.uniforms.jungleMap = {
        value: this.jungleTexture
      };

      shader.uniforms.biomeRepeat = {
        value: 38
      };

      // Vertex Shader
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `
        #include <common>

        varying float vTerrainSlope;
        varying vec3 vTerrainPosition;
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        `
        #include <beginnormal_vertex>

        vTerrainSlope = 1.0 - abs(normal.y);
        vTerrainPosition = position;
        `
      );

      // Fragment Shader
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `
        #include <common>

        uniform sampler2D rockMap;
        uniform sampler2D sandMap;
        uniform sampler2D iceMap;
        uniform sampler2D jungleMap;
        uniform float biomeRepeat;

        varying float vTerrainSlope;
        varying vec3 vTerrainPosition;

        vec2 warpBiome(vec2 p) {
          vec2 result;

          result.x =
            p.x +
            sin(p.y * 0.035) * 7.0 +
            sin(p.y * 0.091) * 2.5 +
            cos((p.x + p.y) * 0.025) * 3.0;

          result.y =
            p.y +
            cos(p.x * 0.031) * 6.0 +
            sin(p.x * 0.073) * 2.0 +
            cos((p.x - p.y) * 0.027) * 3.0;

          return result;
        }

        float biomeMask(
          vec2 position,
          vec2 center,
          vec2 radius
        ) {
          vec2 p = warpBiome(position);

          vec2 d = (p - center) / radius;

          float distance = length(d);
          float angle = atan(d.y, d.x);

          distance +=
            sin(angle * 5.0 + distance * 3.0) * 0.045 +
            sin(angle * 9.0 - distance * 4.0) * 0.022;

          return 1.0 - smoothstep(
            0.82,
            1.12,
            distance
          );
        }
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        #include <map_fragment>

        vec2 worldPosition = vTerrainPosition.xz;

        // Festgelegte Biomflächen
        float desertMask = biomeMask(
          worldPosition,
          vec2(155.0, 105.0),
          vec2(88.0, 75.0)
        );

        float iceMask = biomeMask(
          worldPosition,
          vec2(-125.0, -175.0),
          vec2(80.0, 67.0)
        );

        float jungleMask = biomeMask(
          worldPosition,
          vec2(-190.0, 125.0),
          vec2(58.0, 48.0)
        );

        // Texturen
        vec2 terrainUV = vMapUv * biomeRepeat;

        vec3 grassColor = diffuseColor.rgb;

        vec3 sandColor = texture2D(
          sandMap,
          terrainUV
        ).rgb;

        vec3 iceColor = texture2D(
          iceMap,
          terrainUV
        ).rgb;

        vec3 jungleColor = texture2D(
          jungleMap,
          terrainUV
        ).rgb;

        vec3 rockColor = texture2D(
          rockMap,
          terrainUV
        ).rgb;

        // Weiche Übergänge zwischen den Biomen
        vec3 biomeColor = grassColor;

        biomeColor = mix(
          biomeColor,
          sandColor,
          desertMask
        );

        biomeColor = mix(
          biomeColor,
          iceColor,
          iceMask
        );

        biomeColor = mix(
          biomeColor,
          jungleColor,
          jungleMask
        );

        // Felsen nur auf steilen Hängen
        float rockBlend = smoothstep(
          0.24,
          0.62,
          vTerrainSlope
        );

        diffuseColor.rgb = mix(
          biomeColor,
          rockColor,
          rockBlend
        );
        `
      );
    };

    material.customProgramCacheKey = () => {
      return "cube-wars-natural-biomes-v4";
    };

    return material;
  }

  // ==================================================
  // BELEUCHTUNG
  // ==================================================

  createLighting() {
    const ambient = new THREE.HemisphereLight(
      0xd9edff,
      0x64734c,
      2.0
    );

    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(
      0xfff2d6,
      3.0
    );

    sun.position.set(-180, 260, -120);
    sun.castShadow = true;

    sun.shadow.mapSize.set(2048, 2048);

    sun.shadow.camera.left = -350;
    sun.shadow.camera.right = 350;
    sun.shadow.camera.top = 350;
    sun.shadow.camera.bottom = -350;

    sun.shadow.bias = -0.0002;

    this.scene.add(sun);
  }

  // ==================================================
  // ÖFFENTLICHE FUNKTIONEN
  // ==================================================

  getGroundHeight(x, z) {
    return this.getHeightAt(x, z);
  }

  getBiome(x, z) {
    return this.getBiomeAt(x, z);
  }

  isInsideWorld(x, z) {
    return this.getIslandEdge(x, z) < 270;
  }

  getTerrain() {
    return this.terrain;
  }

  destroy() {
    if (this.terrain) {
      this.scene.remove(this.terrain);
      this.terrain.geometry.dispose();
    }

    if (this.material) {
      this.material.dispose();
    }

    this.grassTexture.dispose();
    this.stoneTexture.dispose();
    this.sandTexture.dispose();
    this.iceTexture.dispose();
    this.jungleTexture.dispose();
  }
}

export default Welt;
