// =============================================
// main.js — DEAD SIGNAL v4
// Day/Night + Full Auto-Target
// =============================================

import * as THREE from 'three';
import { CONFIG, loadSettings, saveSettings } from './config.js';
import { FlowField } from './pathfinding.js';

// ==================== STATE ====================
const GameState = { MENU: 'menu', MODE: 'mode', PLAYING: 'playing', GAME_OVER: 'gameover' };
let gameState = GameState.MENU;
const GameStats = { kills: 0, score: 0, wavesSurvived: 0 };
let settings = loadSettings();
let currentLighting = null;
let sunLight, moonLight, hemiLight, ambientLight, rimLight, skyMesh, starsMesh = null;
let flashlight = null;

// ==================== HELPERS ====================
function lpMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: 0.85, metalness: 0.05, ...opts,
  });
}
function addOutline(mesh, t = 1.06, c = 0x000000) {
  const m = new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide });
  const o = new THREE.Mesh(mesh.geometry, m);
  o.scale.multiplyScalar(t);
  o.renderOrder = -1;
  mesh.add(o);
}

// ==================== SCENE ====================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(CONFIG.CAMERA.FOV, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, CONFIG.CAMERA.OFFSET_Y, CONFIG.CAMERA.OFFSET_Z);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: settings.quality !== 'low',
  powerPreference: 'high-performance',
});
renderer.setSize(innerWidth, innerHeight);
const dpr = settings.quality === 'high' ? Math.min(devicePixelRatio, 2)
  : settings.quality === 'medium' ? Math.min(devicePixelRatio, 1.5) : 1;
renderer.setPixelRatio(dpr);
renderer.shadowMap.enabled = settings.quality !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

// ==================== SKY (Shader) ====================
function createSky() {
  const skyGeo = new THREE.SphereGeometry(240, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x4a80c0) },
      midColor: { value: new THREE.Color(0x90b8e0) },
      botColor: { value: new THREE.Color(0xc8dcec) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor, midColor, botColor;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        vec3 c = mix(botColor, midColor, smoothstep(-0.1, 0.25, h));
        c = mix(c, topColor, smoothstep(0.25, 0.7, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const m = new THREE.Mesh(skyGeo, skyMat);
  scene.add(m);
  return m;
}
skyMesh = createSky();

// ==================== STARS ====================
function createStars() {
  const geo = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 400; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.45;
    const r = 200;
    positions.push(
      Math.cos(theta) * Math.cos(phi) * r,
      Math.sin(phi) * r + 30,
      Math.sin(theta) * Math.cos(phi) * r
    );
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false });
  const m = new THREE.Points(geo, mat);
  scene.add(m);
  return m;
}
starsMesh = createStars();
starsMesh.visible = false;

// ==================== LIGHTING (switchable) ====================
hemiLight = new THREE.HemisphereLight(0xffffff, 0x808060, 1.0);
scene.add(hemiLight);

ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);

sunLight = new THREE.DirectionalLight(0xfff2d0, 1.8);
sunLight.position.set(-60, 90, 40);
if (settings.quality !== 'low') {
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 250;
  sunLight.shadow.camera.left = -90;
  sunLight.shadow.camera.right = 90;
  sunLight.shadow.camera.top = 90;
  sunLight.shadow.camera.bottom = -90;
  sunLight.shadow.bias = -0.0003;
}
scene.add(sunLight);

rimLight = new THREE.DirectionalLight(0x6688cc, 0.3);
rimLight.position.set(40, 30, -40);
scene.add(rimLight);

// ==================== APPLY LIGHTING ====================
function applyLighting(mode) {
  const L = mode === 'night' ? CONFIG.LIGHTING.NIGHT : CONFIG.LIGHTING.DAY;
  currentLighting = L;

  // Sky colors
  skyMesh.material.uniforms.topColor.value.setHex(L.skyTop);
  skyMesh.material.uniforms.midColor.value.setHex(L.skyMid);
  skyMesh.material.uniforms.botColor.value.setHex(L.skyBot);

  // Fog
  scene.background = new THREE.Color(L.background);
  scene.fog = new THREE.Fog(L.fogColor, L.fogNear, L.fogFar);

  // Lights
  hemiLight.color.setHex(L.hemiSky);
  hemiLight.groundColor.setHex(L.hemiGround);
  hemiLight.intensity = L.hemiIntensity;

  ambientLight.color.setHex(L.ambientColor);
  ambientLight.intensity = L.ambientIntensity;

  sunLight.color.setHex(L.sunColor);
  sunLight.intensity = L.sunIntensity;
  sunLight.position.set(...L.sunPos);

  rimLight.color.setHex(L.rimColor);
  rimLight.intensity = L.rimIntensity;

  renderer.toneMappingExposure = L.exposure;

  // Stars only at night
  starsMesh.visible = mode === 'night';

  // Mode indicator
  const mi = document.getElementById('mode-indicator');
  if (mi) mi.textContent = mode === 'night' ? '🌙 NIGHT' : '☀ DAY';
}

// ==================== FLOW FIELD ====================
const navGrid = new FlowField(CONFIG.WORLD.ARENA_SIZE, CONFIG.WORLD.GRID_CELL);

// ==================== WORLD ====================
const worldGroup = new THREE.Group();
scene.add(worldGroup);
const obstacles = [];

const COL = {
  road: 0x3a3a45,
  roadLine: 0xe8c840,
  sidewalk: 0x808088,
  crosswalk: 0xe8e8e8,
  grass: 0x4a6a3a,
  building: [0xc89878, 0xb88868, 0xd4a878, 0xa87860, 0xc0a888, 0xa88898, 0x9898a8],
  roof: 0x6a4040,
  tree: [0x2a5030, 0x3a6040, 0x305838],
  trunk: 0x4a3018,
  car: [0xc04040, 0x4060c0, 0x40a060, 0xd0b040, 0x606060, 0xb040a0, 0xa0a0a0, 0xe0e0e0],
};

function buildGround() {
  const size = CONFIG.WORLD.ARENA_SIZE + 60;
  const geo = new THREE.PlaneGeometry(size, size, 60, 60);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cols = [];
  const palette = [new THREE.Color(0x4a4a52), new THREE.Color(0x525258), new THREE.Color(0x464650)];
  for (let i = 0; i < pos.count; i++) {
    const c = palette[Math.floor(Math.random() * palette.length)];
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  const g = new THREE.Mesh(geo, mat);
  g.receiveShadow = true;
  worldGroup.add(g);
}

function createRoad(x, z, w, d, horizontal) {
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COL.road, roughness: 0.9 }));
  road.position.set(x, 0.02, z);
  road.receiveShadow = true;
  worldGroup.add(road);

  const lineMat = new THREE.MeshBasicMaterial({ color: COL.roadLine });
  if (horizontal) {
    for (let lx = x - w / 2 + 2; lx < x + w / 2 - 2; lx += 4) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.15), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(lx, 0.03, z);
      worldGroup.add(dash);
    }
  } else {
    for (let lz = z - d / 2 + 2; lz < z + d / 2 - 2; lz += 4) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1.8), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.03, lz);
      worldGroup.add(dash);
    }
  }
}

function createSidewalk(x, z, w, d) {
  const geo = new THREE.BoxGeometry(w, 0.18, d);
  const s = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COL.sidewalk, roughness: 0.9, flatShading: true }));
  s.position.set(x, 0.09, z);
  s.receiveShadow = true;
  worldGroup.add(s);
}

function createCrosswalk(x, z, horizontal) {
  const mat = new THREE.MeshBasicMaterial({ color: COL.crosswalk });
  for (let i = -2; i <= 2; i++) {
    const stripe = new THREE.Mesh(
      horizontal ? new THREE.PlaneGeometry(0.5, 3) : new THREE.PlaneGeometry(3, 0.5),
      mat
    );
    stripe.rotation.x = -Math.PI / 2;
    if (horizontal) stripe.position.set(x + i * 1.2, 0.04, z);
    else stripe.position.set(x, 0.04, z + i * 1.2);
    worldGroup.add(stripe);
  }
}

function createBuilding(x, z, w, d, h, color) {
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lpMat(color));
  body.position.set(x, h / 2, z);
  body.castShadow = true;
  body.receiveShadow = true;
  addOutline(body, 1.015);
  worldGroup.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.35, d + 0.15), lpMat(COL.roof));
  roof.position.set(x, h + 0.15, z);
  roof.castShadow = true;
  worldGroup.add(roof);

  if (Math.random() < 0.6 && h > 4) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), lpMat(0x888890));
    ac.position.set(x + (Math.random() - 0.5) * (w - 2), h + 0.55, z + (Math.random() - 0.5) * (d - 2));
    ac.castShadow = true;
    worldGroup.add(ac);
  }

  const winColors = [0xffd888, 0xa0d8ff, 0xffaa66];
  const sides = [
    { face: 'z', sign: 1 }, { face: 'z', sign: -1 },
    { face: 'x', sign: 1 }, { face: 'x', sign: -1 },
  ];
  sides.forEach(s => {
    const sideLen = s.face === 'z' ? w : d;
    const cols = Math.floor(sideLen / 1.6);
    const rows = Math.floor(h / 1.5);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.55) continue;
        const winGeo = new THREE.PlaneGeometry(0.55, 0.75);
        const winMat = new THREE.MeshBasicMaterial({
          color: winColors[Math.floor(Math.random() * winColors.length)],
        });
        const win = new THREE.Mesh(winGeo, winMat);
        const u = (c - (cols - 1) / 2) * 1.6;
        const v = 1.0 + r * 1.5;
        if (s.face === 'z') {
          win.position.set(x + u, v, z + s.sign * (d / 2 + 0.02));
          if (s.sign < 0) win.rotation.y = Math.PI;
        } else {
          win.rotation.y = s.sign * Math.PI / 2;
          win.position.set(x + s.sign * (w / 2 + 0.02), v, z + u);
        }
        worldGroup.add(win);
      }
    }
  });

  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), new THREE.MeshBasicMaterial({ color: 0x3a2010 }));
  door.position.set(x, 0.9, z + d / 2 + 0.03);
  worldGroup.add(door);

  obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  navGrid.markBlocked(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
}

function createCar(x, z, rotation, color) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotation;

  const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.75, 1.6), lpMat(color));
  body.position.y = 0.75;
  body.castShadow = true;
  addOutline(body, 1.04);
  g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 1.4), lpMat(0x1a1a22, { metalness: 0.4, roughness: 0.3 }));
  cabin.position.set(-0.2, 1.42, 0);
  cabin.castShadow = true;
  g.add(cabin);

  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.55),
    new THREE.MeshBasicMaterial({ color: 0x88aacc, transparent: true, opacity: 0.6 }));
  ws.position.set(0.75, 1.42, 0);
  ws.rotation.y = Math.PI / 2;
  g.add(ws);

  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 8);
  const wheelMat = lpMat(0x1a1a1a);
  [[-1.1, 0.35, 0.85], [1.1, 0.35, 0.85], [-1.1, 0.35, -0.85], [1.1, 0.35, -0.85]].forEach(([px, py, pz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(px, py, pz);
    wheel.castShadow = true;
    g.add(wheel);
  });

  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
  const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.2), hlMat);
  hl1.position.set(1.8, 0.85, 0.55);
  g.add(hl1);
  const hl2 = hl1.clone();
  hl2.position.z = -0.55;
  g.add(hl2);

  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff4040 });
  const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.2), tlMat);
  tl1.position.set(-1.8, 0.85, 0.55);
  g.add(tl1);
  const tl2 = tl1.clone();
  tl2.position.z = -0.55;
  g.add(tl2);

  worldGroup.add(g);

  const c = Math.abs(Math.cos(rotation));
  const s = Math.abs(Math.sin(rotation));
  const halfW = (3.6 * c + 1.6 * s) / 2;
  const halfD = (3.6 * s + 1.6 * c) / 2;
  obstacles.push({ minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD });
  navGrid.markBlocked(x - halfW, z - halfD, x + halfW, z + halfD);
}

function createTree(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const trunkH = 2.2 + Math.random() * 0.8;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, trunkH, 6), lpMat(COL.trunk));
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const layers = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < layers; i++) {
    const r = 1.3 - i * 0.25;
    const h = 1.5 - i * 0.25;
    const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0),
      lpMat(COL.tree[Math.floor(Math.random() * COL.tree.length)]));
    foliage.position.set((Math.random() - 0.5) * 0.4, trunkH + 0.3 + i * 0.85, (Math.random() - 0.5) * 0.4);
    foliage.scale.y = h / r;
    foliage.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    foliage.castShadow = true;
    g.add(foliage);
  }
  worldGroup.add(g);
  obstacles.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35 });
}

function createBush(x, z) {
  const r = 0.5 + Math.random() * 0.3;
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), lpMat(0x3a5a30));
  bush.position.set(x, r * 0.7, z);
  bush.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  bush.castShadow = true;
  worldGroup.add(bush);
}

function createGrassPatch(x, z, w, d) {
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const grass = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COL.grass, roughness: 1 }));
  grass.position.set(x, 0.04, z);
  grass.receiveShadow = true;
  worldGroup.add(grass);
}

function createStreetlamp(x, z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.5, 6), lpMat(0x3a3a3a));
  pole.position.set(x, 2.25, z);
  pole.castShadow = true;
  worldGroup.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), lpMat(0x3a3a3a));
  arm.position.set(x + 0.6, 4.5, z);
  worldGroup.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.3), lpMat(0x222222));
  head.position.set(x + 1.1, 4.4, z);
  worldGroup.add(head);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
  bulb.position.set(x + 1.1, 4.25, z);
  worldGroup.add(bulb);
}

function createBench(x, z, angle) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), lpMat(0x6a4a2a));
  seat.position.y = 0.5;
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.1), lpMat(0x6a4a2a));
  back.position.set(0, 0.85, -0.2);
  back.castShadow = true;
  g.add(back);
  const legMat = lpMat(0x2a2a2a);
  [[-0.75, 0.25, 0.15], [0.75, 0.25, 0.15], [-0.75, 0.25, -0.15], [0.75, 0.25, -0.15]].forEach(([px, py, pz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), legMat);
    leg.position.set(px, py, pz);
    g.add(leg);
  });
  worldGroup.add(g);
}

function createTrashCan(x, z) {
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.9, 8), lpMat(0x3a5a3a));
  bin.position.set(x, 0.45, z);
  bin.castShadow = true;
  worldGroup.add(bin);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 8), lpMat(0x2a4a2a));
  lid.position.set(x, 0.92, z);
  worldGroup.add(lid);
}

function createHydrant(x, z) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 6), lpMat(0xc02020));
  base.position.set(x, 0.35, z);
  base.castShadow = true;
  worldGroup.add(base);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), lpMat(0xc02020));
  top.position.set(x, 0.72, z);
  worldGroup.add(top);
}

function createTrafficLight(x, z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4, 6), lpMat(0x2a2a2a));
  pole.position.set(x, 2, z);
  pole.castShadow = true;
  worldGroup.add(pole);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.35), lpMat(0x1a1a1a));
  box.position.set(x, 4.2, z);
  worldGroup.add(box);
  const colors = [0xff3030, 0xffc030, 0x30ff30];
  colors.forEach((c, i) => {
    const light = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8),
      new THREE.MeshBasicMaterial({ color: i === 0 ? c : 0x2a2a2a }));
    light.position.set(x, 4.5 - i * 0.28, z + 0.18);
    worldGroup.add(light);
  });
}

const barrels = [];
function createBarrel(x, z) {
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.0, 6), lpMat(0x8a4a2a));
  b.position.set(x, 0.5, z);
  b.castShadow = true;
  addOutline(b, 1.08);
  worldGroup.add(b);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 5),
    new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.95 }));
  fire.position.set(x, 1.35, z);
  worldGroup.add(fire);
  const light = new THREE.PointLight(0xff8833, 2.5, 10, 2);
  light.position.set(x, 1.5, z);
  worldGroup.add(light);
  barrels.push({ light, fire, baseY: 1.35 });
  obstacles.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  navGrid.markBlocked(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
}

function buildCity() {
  buildGround();
  const size = CONFIG.WORLD.ARENA_SIZE;
  const half = size / 2;
  const blockSize = 18;
  const streetW = 8;
  const pitch = blockSize + streetW;
  const numBlocks = Math.floor(size / pitch);

  for (let i = 0; i <= numBlocks; i++) {
    const pos = -half + i * pitch - streetW / 2;
    if (Math.abs(pos) < half - streetW / 2) {
      createRoad(0, pos, size, streetW, true);
      createRoad(pos, 0, streetW, size, false);
    }
  }

  for (let i = 0; i <= numBlocks; i++) {
    const pos = -half + i * pitch - streetW / 2;
    if (Math.abs(pos) < half - streetW / 2) {
      createSidewalk(0, pos - streetW / 2 - 1, size, 2);
      createSidewalk(0, pos + streetW / 2 + 1, size, 2);
      createSidewalk(pos - streetW / 2 - 1, 0, 2, size);
      createSidewalk(pos + streetW / 2 + 1, 0, 2, size);
    }
  }

  for (let i = 0; i <= numBlocks; i++) {
    for (let j = 0; j <= numBlocks; j++) {
      const x = -half + i * pitch - streetW / 2;
      const z = -half + j * pitch - streetW / 2;
      if (Math.abs(x) < half - 4 && Math.abs(z) < half - 4) {
        createCrosswalk(x, z + streetW / 2, true);
        createCrosswalk(x, z - streetW / 2, true);
        createCrosswalk(x + streetW / 2, z, false);
        createCrosswalk(x - streetW / 2, z, false);
      }
    }
  }

  for (let bx = 0; bx < numBlocks; bx++) {
    for (let bz = 0; bz < numBlocks; bz++) {
      const cx = -half + bx * pitch + streetW / 2 + blockSize / 2;
      const cz = -half + bz * pitch + streetW / 2 + blockSize / 2;
      if (Math.abs(cx) < pitch && Math.abs(cz) < pitch) {
        createGrassPatch(cx, cz, blockSize - 2, blockSize - 2);
        for (let t = 0; t < 5; t++) {
          createTree(cx + (Math.random() - 0.5) * (blockSize - 4), cz + (Math.random() - 0.5) * (blockSize - 4));
        }
        continue;
      }
      const count = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < count; k++) {
        const bw = 5 + Math.random() * 6;
        const bd = 5 + Math.random() * 6;
        const bh = 5 + Math.random() * 8;
        const ox = (Math.random() - 0.5) * (blockSize - bw - 1);
        const oz = (Math.random() - 0.5) * (blockSize - bd - 1);
        const color = COL.building[Math.floor(Math.random() * COL.building.length)];
        createBuilding(cx + ox, cz + oz, bw, bd, bh, color);
      }
    }
  }

  for (let i = 0; i <= numBlocks; i++) {
    const pos = -half + i * pitch - streetW / 2;
    if (Math.abs(pos) > half - 4) continue;
    for (let j = -half + 6; j < half - 6; j += 7) {
      if (Math.random() < 0.7) createTree(pos - streetW / 2 - 1, j);
      if (Math.random() < 0.7) createTree(pos + streetW / 2 + 1, j);
      if (Math.random() < 0.7) createTree(j, pos - streetW / 2 - 1);
      if (Math.random() < 0.7) createTree(j, pos + streetW / 2 + 1);
    }
  }

  for (let i = 0; i <= numBlocks; i++) {
    const pos = -half + i * pitch - streetW / 2;
    if (Math.abs(pos) > half - 8) continue;
    for (let j = -half + 8; j < half - 8; j += 9) {
      if (Math.random() < 0.5) createCar(j, pos - streetW / 2 + 1.2, 0, COL.car[Math.floor(Math.random() * COL.car.length)]);
      if (Math.random() < 0.5) createCar(pos - streetW / 2 + 1.2, j, Math.PI / 2, COL.car[Math.floor(Math.random() * COL.car.length)]);
      if (Math.random() < 0.5) createCar(j, pos + streetW / 2 - 1.2, Math.PI, COL.car[Math.floor(Math.random() * COL.car.length)]);
      if (Math.random() < 0.5) createCar(pos + streetW / 2 - 1.2, j, -Math.PI / 2, COL.car[Math.floor(Math.random() * COL.car.length)]);
    }
  }

  for (let i = 0; i <= numBlocks; i++) {
    for (let j = 0; j <= numBlocks; j++) {
      const x = -half + i * pitch - streetW / 2;
      const z = -half + j * pitch - streetW / 2;
      if (Math.abs(x) < half - 4 && Math.abs(z) < half - 4) {
        createStreetlamp(x - streetW / 2 - 1.2, z - streetW / 2 - 1.2);
      }
    }
  }

  for (let i = 1; i < numBlocks; i++) {
    for (let j = 1; j < numBlocks; j++) {
      const x = -half + i * pitch - streetW / 2;
      const z = -half + j * pitch - streetW / 2;
      createTrafficLight(x - streetW / 2 - 1.5, z - streetW / 2 - 1.5);
    }
  }

  for (let i = 0; i < 25; i++) {
    const x = (Math.random() - 0.5) * (size - 10);
    const z = (Math.random() - 0.5) * (size - 10);
    let blocked = false;
    for (const o of obstacles) {
      if (x > o.minX - 1 && x < o.maxX + 1 && z > o.minZ - 1 && z < o.maxZ + 1) { blocked = true; break; }
    }
    if (blocked) continue;
    const r = Math.random();
    if (r < 0.3) createBench(x, z, Math.random() * Math.PI * 2);
    else if (r < 0.55) createTrashCan(x, z);
    else if (r < 0.75) createHydrant(x, z);
    else createBush(x, z);
  }

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = half * 0.8;
    createBarrel(Math.cos(a) * r, Math.sin(a) * r);
  }

  const wallH = 15;
  const wallMat = lpMat(0x2a2030);
  [[0, -half, size, 1], [0, half, size, 1], [-half, 0, 1, size], [half, 0, 1, size]].forEach(([x, z, w, d]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    wall.position.set(x, wallH / 2, z);
    worldGroup.add(wall);
  });
}
buildCity();

// ==================== PARTICLES ====================
const particlePool = [];
const particleGeo = new THREE.IcosahedronGeometry(0.09, 0);
for (let i = 0; i < 200; i++) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true });
  const mesh = new THREE.Mesh(particleGeo, mat);
  mesh.visible = false;
  scene.add(mesh);
  particlePool.push({ mesh, active: false, velocity: new THREE.Vector3(), life: 0, maxLife: 0.5, gravity: -14 });
}
function spawnParticle(pos, color, speed = 3, count = 5) {
  let n = 0;
  for (const p of particlePool) {
    if (!p.active && n < count) {
      p.active = true;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(0.6 + Math.random() * 1.2);
      p.velocity.set((Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed);
      p.life = p.maxLife;
      n++;
    }
  }
}

const tracers = [];
function spawnTracer(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, life: 0.07, maxLife: 0.07 });
}

// ==================== INPUT ====================
const keys = {};
const touch = {
  isTouch: false,
  moveJoy: { active: false, id: null, sx: 0, sy: 0, dx: 0, dy: 0 },
};

addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.key.toLowerCase() === 'r' && player) player.reload();
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

const touchControlsEl = document.getElementById('touch-controls');
const mobileButtonsEl = document.getElementById('mobile-buttons');
const moveJoyEl = document.getElementById('move-joy');
const moveKnobEl = moveJoyEl.querySelector('.knob');

function isTouchDevice() { return 'ontouchstart' in window || navigator.maxTouchPoints > 0; }
function shouldUseTouch() {
  if (settings.touchControls === 'on') return true;
  if (settings.touchControls === 'off') return false;
  return isTouchDevice();
}
function updateTouchVisibility() {
  touch.isTouch = shouldUseTouch();
  touchControlsEl.classList.toggle('active', touch.isTouch);
  mobileButtonsEl.classList.toggle('active', touch.isTouch);
}
updateTouchVisibility();

function onTouchStart(e) {
  if (!touch.isTouch || gameState !== GameState.PLAYING) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (!touch.moveJoy.active) {
      touch.moveJoy.active = true;
      touch.moveJoy.id = t.identifier;
      touch.moveJoy.sx = t.clientX;
      touch.moveJoy.sy = t.clientY;
      touch.moveJoy.dx = 0;
      touch.moveJoy.dy = 0;
      moveJoyEl.style.left = (t.clientX - 70) + 'px';
      moveJoyEl.style.top = (t.clientY - 70) + 'px';
      moveJoyEl.classList.add('active');
      moveKnobEl.style.left = '50%';
      moveKnobEl.style.top = '50%';
    }
  }
}
function onTouchMove(e) {
  if (!touch.isTouch) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (touch.moveJoy.active && t.identifier === touch.moveJoy.id) {
      const dx = t.clientX - touch.moveJoy.sx;
      const dy = t.clientY - touch.moveJoy.sy;
      const max = 60;
      const len = Math.hypot(dx, dy);
      const k = len > max ? max / len : 1;
      const kx = dx * k, ky = dy * k;
      touch.moveJoy.dx = kx / max;
      touch.moveJoy.dy = ky / max;
      moveKnobEl.style.left = `calc(50% + ${kx}px)`;
      moveKnobEl.style.top = `calc(50% + ${ky}px)`;
    }
  }
}
function onTouchEnd(e) {
  if (!touch.isTouch) return;
  for (const t of e.changedTouches) {
    if (touch.moveJoy.active && t.identifier === touch.moveJoy.id) {
      touch.moveJoy.active = false;
      touch.moveJoy.dx = 0;
      touch.moveJoy.dy = 0;
      moveJoyEl.classList.remove('active');
    }
  }
}
addEventListener('touchstart', onTouchStart, { passive: false });
addEventListener('touchmove', onTouchMove, { passive: false });
addEventListener('touchend', onTouchEnd, { passive: false });
addEventListener('touchcancel', onTouchEnd, { passive: false });

const btnReload = document.getElementById('btn-reload');
if (btnReload) btnReload.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (player) player.reload();
});

// ==================== PLAYER ====================
let player = null;

class PlayerClass {
  constructor(character) {
    this.character = character;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.maxHp = Math.round(CONFIG.PLAYER.MAX_HP * character.hpMult);
    this.hp = this.maxHp;
    this.speed = CONFIG.PLAYER.SPEED * character.speedMult;
    this.damage = CONFIG.WEAPON.damage * character.damageMult;

    this.currentAngle = 0;
    this.walkPhase = 0;
    this.isMoving = false;
    this.aimX = 0;
    this.aimZ = 1;
    this.fireCooldown = 0;
    this.recoil = 0;

    this.weapon = { currentAmmo: CONFIG.WEAPON.magSize, reserveAmmo: CONFIG.WEAPON.reserveAmmo };
    this.isReloading = false;
    this.hasFlashlight = false;

    this.buildMesh();
  }

  buildMesh() {
    const c = this.character;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.35), lpMat(c.shirt));
    torso.position.y = 1.15;
    torso.castShadow = true;
    addOutline(torso, 1.08);
    this.group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 0.32), lpMat(c.skin));
    head.position.y = 1.75;
    head.castShadow = true;
    addOutline(head, 1.1);
    this.group.add(head);

    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.35), lpMat(c.hair));
    hair.position.y = 0.21;
    head.add(hair);

    const armGeo = new THREE.BoxGeometry(0.14, 0.65, 0.14);
    const handGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);

    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.35, 1.42, 0);
    this.group.add(this.leftArmPivot);
    const la = new THREE.Mesh(armGeo, lpMat(c.shirt));
    la.position.y = -0.32; la.castShadow = true; addOutline(la, 1.12);
    this.leftArmPivot.add(la);
    const lh = new THREE.Mesh(handGeo, lpMat(c.skin));
    lh.position.y = -0.7;
    this.leftArmPivot.add(lh);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.35, 1.42, 0);
    this.group.add(this.rightArmPivot);
    const ra = new THREE.Mesh(armGeo, lpMat(c.shirt));
    ra.position.y = -0.32; ra.castShadow = true; addOutline(ra, 1.12);
    this.rightArmPivot.add(ra);
    const rh = new THREE.Mesh(handGeo, lpMat(c.skin));
    rh.position.y = -0.7;
    this.rightArmPivot.add(rh);

    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.35), lpMat(0x1a1a1a));
    gun.position.set(0, -0.72, 0.18);
    addOutline(gun, 1.15);
    this.rightArmPivot.add(gun);

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true }));
    muzzle.position.set(0, -0.72, 0.4);
    muzzle.visible = false;
    this.rightArmPivot.add(muzzle);
    this.muzzle = muzzle;

    const legGeo = new THREE.BoxGeometry(0.18, 0.85, 0.18);
    const legMat = lpMat(c.pants);
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.13, 0.85, 0);
    this.group.add(this.leftLegPivot);
    const ll = new THREE.Mesh(legGeo, legMat);
    ll.position.y = -0.42; ll.castShadow = true; addOutline(ll, 1.12);
    this.leftLegPivot.add(ll);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.13, 0.85, 0);
    this.group.add(this.rightLegPivot);
    const rl = new THREE.Mesh(legGeo, legMat);
    rl.position.y = -0.42; rl.castShadow = true; addOutline(rl, 1.12);
    this.rightLegPivot.add(rl);
  }

  enableFlashlight() {
    if (this.hasFlashlight) return;
    this.hasFlashlight = true;

    this.pointLight = new THREE.PointLight(0xffeecc, 1.5, 9, 2);
    this.pointLight.position.set(0, 1.5, 0);
    this.group.add(this.pointLight);

    this.spot = new THREE.SpotLight(0xffeedd, 5.0, 22, Math.PI / 6, 0.6, 1.2);
    this.spot.position.set(0, 1.4, 0);
    this.group.add(this.spot);

    this.spotTarget = new THREE.Object3D();
    this.spotTarget.position.set(0, 0.3, 6);
    this.group.add(this.spotTarget);
    this.spot.target = this.spotTarget;

    const coneGeo = new THREE.CircleGeometry(8, 20, -Math.PI / 2 - Math.PI / 7, Math.PI / 3.5);
    coneGeo.rotateX(-Math.PI / 2);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
      color: 0xffeecc, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide,
    }));
    cone.position.y = 0.05;
    cone.renderOrder = 1;
    this.group.add(cone);
  }

  // Auto-target: نزدیک‌ترین زامبی در مخروط جلو
  findTarget(zombies) {
    const px = this.group.position.x;
    const pz = this.group.position.z;
    let best = null;
    let bestDist = CONFIG.WEAPON.range;

    for (const z of zombies) {
      if (!z.alive) continue;
      const dx = z.group.position.x - px;
      const dz = z.group.position.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > bestDist) continue;

      // اگر نزدیک‌تر از X باشد، فقط فاصله مهمه (بدون شرط مخروط)
      if (dist > 5) {
        const dot = (dx * this.aimX + dz * this.aimZ) / (dist || 1);
        if (dot < CONFIG.WEAPON.aimCone) continue;
      }

      if (dist < bestDist) {
        bestDist = dist;
        best = { zombie: z, dx, dz, dist };
      }
    }
    return best;
  }

  update(dt, zombies) {
    if (this.hp <= 0) return;

    // === Movement ===
    let mx = 0, mz = 0;
    if (touch.isTouch && touch.moveJoy.active) {
      mx = touch.moveJoy.dx;
      mz = touch.moveJoy.dy;
    } else {
      if (keys['w'] || keys['arrowup']) mz -= 1;
      if (keys['s'] || keys['arrowdown']) mz += 1;
      if (keys['a'] || keys['arrowleft']) mx -= 1;
      if (keys['d'] || keys['arrowright']) mx += 1;
    }

    const len = Math.hypot(mx, mz);
    this.isMoving = len > 0.15;

    if (this.isMoving) {
      if (len > 1) { mx /= len; mz /= len; }
      const nx = this.group.position.x + mx * this.speed * dt;
      const nz = this.group.position.z + mz * this.speed * dt;
      if (!this.checkCollision(nx, this.group.position.z)) this.group.position.x = nx;
      if (!this.checkCollision(this.group.position.x, nz)) this.group.position.z = nz;

      this.walkPhase += dt * 10;
      const sw = Math.sin(this.walkPhase) * 0.55;
      this.leftLegPivot.rotation.x = sw;
      this.rightLegPivot.rotation.x = -sw;
    } else {
      this.leftLegPivot.rotation.x *= 0.85;
      this.rightLegPivot.rotation.x *= 0.85;
    }

    // Boundary
    const half = CONFIG.WORLD.ARENA_SIZE / 2 - 1.5;
    const p = this.group.position;
    p.x = Math.max(-half, Math.min(half, p.x));
    p.z = Math.max(-half, Math.min(half, p.z));

    // === AUTO TARGET & ROTATE ===
    const target = this.findTarget(zombies);

    if (target) {
      // Rotate toward target
      const inv = 1 / target.dist;
      this.aimX = target.dx * inv;
      this.aimZ = target.dz * inv;
    } else if (this.isMoving) {
      // اگر هدفی نیست، به سمت حرکت بچرخه
      const inv = 1 / Math.max(0.001, len);
      this.aimX = mx * inv;
      this.aimZ = mz * inv;
    }

    const targetAngle = Math.atan2(this.aimX, this.aimZ);
    let diff = targetAngle - this.currentAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.currentAngle += diff * Math.min(1, dt * CONFIG.PLAYER.ROTATION_SPEED);
    this.group.rotation.y = this.currentAngle;

    // Arms forward
    this.leftArmPivot.rotation.x += (-1.4 - this.leftArmPivot.rotation.x) * Math.min(1, dt * 12);
    this.rightArmPivot.rotation.x += (-1.4 - this.rightArmPivot.rotation.x) * Math.min(1, dt * 12);

    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - dt * 3);
      this.rightArmPivot.rotation.x = -1.4 + this.recoil * 0.8;
    }

    // === AUTO FIRE ===
    this.fireCooldown -= dt;
    if (target && this.fireCooldown <= 0 && !this.isReloading) {
      this.fireAt(target);
      this.fireCooldown = CONFIG.WEAPON.fireCooldown;
    } else if (!target && !this.isReloading &&
               this.weapon.currentAmmo < CONFIG.WEAPON.magSize &&
               this.weapon.reserveAmmo > 0) {
      this.reload();
    }

    // Regen
    if (this.character.regen && this.hp > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.character.regen * dt);
    }
  }

  checkCollision(x, z) {
    const r = CONFIG.PLAYER.RADIUS;
    for (const o of obstacles) {
      if (x + r > o.minX && x - r < o.maxX && z + r > o.minZ && z - r < o.maxZ) return true;
    }
    return false;
  }

  fireAt(target) {
    if (this.weapon.currentAmmo <= 0) { this.reload(); return; }
    this.weapon.currentAmmo--;

    const origin = this.group.position.clone();
    origin.y = 1.2;
    const targetPos = target.zombie.group.position.clone();
    targetPos.y = 1.05;

    const sp = CONFIG.WEAPON.spread;
    targetPos.x += (Math.random() - 0.5) * sp * target.dist * 2;
    targetPos.z += (Math.random() - 0.5) * sp * target.dist * 2;

    const dir = targetPos.clone().sub(origin).normalize();
    const ray = new THREE.Raycaster(origin, dir, 0, CONFIG.WEAPON.range);

    let hitZombie = null;
    let closestDist = Infinity;
    for (const z of zombies) {
      if (!z.alive) continue;
      const box = new THREE.Box3().setFromObject(z.group);
      box.expandByScalar(0.15);
      const hp = new THREE.Vector3();
      if (ray.ray.intersectBox(box, hp)) {
        const d = origin.distanceTo(hp);
        if (d < closestDist) { closestDist = d; hitZombie = { zombie: z, point: hp }; }
      }
    }

    let wallDist = Infinity;
    for (const o of obstacles) {
      const box = new THREE.Box3(new THREE.Vector3(o.minX, 0, o.minZ), new THREE.Vector3(o.maxX, 4, o.maxZ));
      const hp = new THREE.Vector3();
      if (ray.ray.intersectBox(box, hp)) {
        const d = origin.distanceTo(hp);
        if (d < wallDist) wallDist = d;
      }
    }

    if (hitZombie && closestDist < wallDist) {
      hitZombie.zombie.takeDamage(this.damage);
      spawnParticle(hitZombie.point, 0x990000, 3, 5);
      spawnTracer(origin, hitZombie.point);
    } else if (wallDist < Infinity) {
      const pt = origin.clone().add(dir.clone().multiplyScalar(wallDist));
      spawnParticle(pt, 0x888888, 2, 3);
      spawnTracer(origin, pt);
    } else {
      spawnTracer(origin, origin.clone().add(dir.clone().multiplyScalar(CONFIG.WEAPON.range)));
    }

    this.muzzle.visible = true;
    this.muzzle.scale.setScalar(0.9 + Math.random() * 0.8);
    clearTimeout(this._mt);
    this._mt = setTimeout(() => { this.muzzle.visible = false; }, 55);

    this.recoil = CONFIG.WEAPON.recoilKick;
    shakeCamera(0.1);
    playSound('shoot');
    updateHUD();
  }

  reload() {
    if (this.isReloading || this.weapon.reserveAmmo <= 0) return;
    this.isReloading = true;
    const ind = document.getElementById('reload-indicator');
    if (ind) ind.classList.add('active');
    setTimeout(() => {
      const need = CONFIG.WEAPON.magSize - this.weapon.currentAmmo;
      const avail = Math.min(need, this.weapon.reserveAmmo);
      this.weapon.currentAmmo += avail;
      this.weapon.reserveAmmo -= avail;
      this.isReloading = false;
      if (ind) ind.classList.remove('active');
      updateHUD();
    }, CONFIG.WEAPON.reloadTime);
  }

  takeDamage(amount) {
    if (this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    flashDamage();
    updateHUD();
    if (this.hp <= 0) this.die();
  }

  die() {
    gameState = GameState.GAME_OVER;
    const s = document.getElementById('gameover-stats');
    if (s) s.innerHTML = `امتیاز: <strong>${GameStats.score}</strong><br>زامبی‌های کشته: <strong>${GameStats.kills}</strong><br>موج‌ها: <strong>${GameStats.wavesSurvived}</strong>`;
    document.getElementById('gameover-screen')?.classList.remove('hidden');
    document.getElementById('hud').style.display = 'none';
  }
}

// ==================== ZOMBIE ====================
const zombies = [];

class ZombieClass {
  constructor(type, pos) {
    this.type = type;
    this.config = CONFIG.ZOMBIE[type];
    this.hp = this.config.hp;
    this.maxHp = this.config.hp;
    this.alive = true;
    this.speed = this.config.speed;
    this.damage = this.config.damage;
    this.attackCd = Math.random() * 500;
    this.attackRange = this.config.attackRange || 1.3;
    this.attackCdMax = this.config.attackCooldown || 1000;
    this.score = this.config.score || 10;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.radius = type === 'TANK' ? 0.7 : 0.4;
    this.curDX = 0; this.curDZ = 0;

    this.group = new THREE.Group();
    this.group.position.copy(pos);
    scene.add(this.group);
    this.buildMesh();
  }

  buildMesh() {
    const cfg = this.config;
    const bodyColor = cfg.color;
    const skinColor = new THREE.Color(bodyColor).lerp(new THREE.Color(0xb8a890), 0.35).getHex();
    const clothColor = new THREE.Color(bodyColor).multiplyScalar(0.75).getHex();
    const hunch = this.type === 'HUNTER' ? 0.35 : 0.12;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.7, 0.32), lpMat(clothColor));
    torso.position.y = 1.12; torso.rotation.x = hunch;
    torso.castShadow = true; addOutline(torso, 1.08);
    this.group.add(torso);
    this.torso = torso;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.33, 0.3), lpMat(skinColor));
    head.position.set(0, 1.68, hunch * 0.3);
    head.rotation.x = hunch + 0.15;
    head.castShadow = true; addOutline(head, 1.1);
    this.group.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: this.type === 'TANK' ? 0xff5500 : 0xff2020 });
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.05, 0.03);
    const le = new THREE.Mesh(eyeGeo, eyeMat); le.position.set(-0.075, 0.04, 0.16); head.add(le);
    const re = new THREE.Mesh(eyeGeo, eyeMat); re.position.set(0.075, 0.04, 0.16); head.add(re);

    const armGeo = new THREE.BoxGeometry(0.13, 0.6, 0.13);
    const handGeo = new THREE.BoxGeometry(0.13, 0.14, 0.13);
    const armMat = lpMat(clothColor);
    const handMat = lpMat(skinColor);

    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.33, 1.38, 0);
    this.leftArmPivot.rotation.x = -1.3;
    this.group.add(this.leftArmPivot);
    const la = new THREE.Mesh(armGeo, armMat); la.position.y = -0.3; la.castShadow = true; addOutline(la, 1.12);
    this.leftArmPivot.add(la);
    const lh = new THREE.Mesh(handGeo, handMat); lh.position.y = -0.65; this.leftArmPivot.add(lh);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.33, 1.38, 0);
    this.rightArmPivot.rotation.x = -1.3;
    this.group.add(this.rightArmPivot);
    const ra = new THREE.Mesh(armGeo, armMat); ra.position.y = -0.3; ra.castShadow = true; addOutline(ra, 1.12);
    this.rightArmPivot.add(ra);
    const rh = new THREE.Mesh(handGeo, handMat); rh.position.y = -0.65; this.rightArmPivot.add(rh);

    const legGeo = new THREE.BoxGeometry(0.17, 0.8, 0.17);
    const legMat = lpMat(new THREE.Color(clothColor).multiplyScalar(0.65).getHex());
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.12, 0.8, 0);
    this.group.add(this.leftLegPivot);
    const ll = new THREE.Mesh(legGeo, legMat); ll.position.y = -0.4; ll.castShadow = true; addOutline(ll, 1.12);
    this.leftLegPivot.add(ll);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.12, 0.8, 0);
    this.group.add(this.rightLegPivot);
    const rl = new THREE.Mesh(legGeo, legMat); rl.position.y = -0.4; rl.castShadow = true; addOutline(rl, 1.12);
    this.rightLegPivot.add(rl);

    if (this.type === 'TANK') this.group.scale.setScalar(1.55);
    else if (this.type === 'HUNTER') this.group.scale.set(0.9, 1.05, 0.9);
    else if (this.type === 'BOOMER') {
      const belly = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.42), lpMat(cfg.color));
      belly.position.set(0, 0.95, 0.08); belly.castShadow = true; addOutline(belly, 1.06);
      this.group.add(belly);
    }

    if (this.maxHp > 100) {
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthTest: false }));
      bg.position.y = 2.4; bg.renderOrder = 999; this.group.add(bg);
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xff3030, side: THREE.DoubleSide, depthTest: false }));
      fill.position.y = 2.4; fill.renderOrder = 1000; this.group.add(fill);
      this.hpFill = fill;
    }
  }

  update(dt, player) {
    if (!this.alive || !player) return;
    const px = player.group.position.x;
    const pz = player.group.position.z;
    const dx = px - this.group.position.x;
    const dz = pz - this.group.position.z;
    const dist = Math.hypot(dx, dz);

    const ta = Math.atan2(dx, dz);
    let diff = ta - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, dt * 8);

    if (dist > this.attackRange) {
      const dirV = { x: 0, z: 0 };
      navGrid.sampleDirection(this.group.position.x, this.group.position.z, dirV);
      let ux, uz;
      if (dirV.x === 0 && dirV.z === 0) { ux = dx / dist; uz = dz / dist; }
      else { ux = dirV.x; uz = dirV.z; }

      this.curDX = this.curDX * 0.7 + ux * 0.3;
      this.curDZ = this.curDZ * 0.7 + uz * 0.3;
      const dl = Math.hypot(this.curDX, this.curDZ) || 1;
      const nux = this.curDX / dl;
      const nuz = this.curDZ / dl;

      const nx = this.group.position.x + nux * this.speed * dt;
      const nz = this.group.position.z + nuz * this.speed * dt;
      let moved = false;
      if (!this.checkCollision(nx, this.group.position.z)) { this.group.position.x = nx; moved = true; }
      if (!this.checkCollision(this.group.position.x, nz)) { this.group.position.z = nz; moved = true; }
      if (!moved) {
        const perpX = -nuz, perpZ = nux;
        const snx = this.group.position.x + perpX * this.speed * dt;
        const snz = this.group.position.z + perpZ * this.speed * dt;
        if (!this.checkCollision(snx, this.group.position.z)) this.group.position.x = snx;
        if (!this.checkCollision(this.group.position.x, snz)) this.group.position.z = snz;
      }

      this.walkPhase += dt * this.speed * 2.5;
      const sw = Math.sin(this.walkPhase) * 0.6;
      this.leftLegPivot.rotation.x = sw;
      this.rightLegPivot.rotation.x = -sw;
      this.leftArmPivot.rotation.x = -1.3 + Math.sin(this.walkPhase * 0.7) * 0.18;
      this.rightArmPivot.rotation.x = -1.3 - Math.sin(this.walkPhase * 0.7) * 0.18;
    } else {
      this.attackCd -= dt * 1000;
      if (this.attackCd <= 0) {
        this.attackCd = this.attackCdMax;
        if (this.damage > 0) player.takeDamage(this.damage);
        this.leftArmPivot.rotation.x = -2.0;
        this.rightArmPivot.rotation.x = -2.0;
      } else {
        this.leftArmPivot.rotation.x += (-1.4 - this.leftArmPivot.rotation.x) * Math.min(1, dt * 10);
        this.rightArmPivot.rotation.x += (-1.4 - this.rightArmPivot.rotation.x) * Math.min(1, dt * 10);
      }
    }

    if (this.hpFill) {
      const r = this.hp / this.maxHp;
      this.hpFill.scale.x = r;
      this.hpFill.position.x = -(1 - r) * 0.45;
    }
  }

  checkCollision(x, z) {
    const r = this.radius;
    for (const o of obstacles) {
      if (x + r > o.minX && x - r < o.maxX && z + r > o.minZ && z - r < o.maxZ) return true;
    }
    return false;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.torso.material.emissive = new THREE.Color(0xff2222);
    this.torso.material.emissiveIntensity = 0.7;
    setTimeout(() => { if (this.torso?.material) this.torso.material.emissiveIntensity = 0; }, 90);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.alive = false;
    spawnParticle(this.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x880000, 5, 12);
    if (this.type === 'BOOMER') {
      spawnParticle(this.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xaaff00, 9, 22);
      Director.onBoomerExplode(this.group.position.clone());
    }
    scene.remove(this.group);
    GameStats.kills++;
    GameStats.score += this.score;
    const i = zombies.indexOf(this);
    if (i > -1) zombies.splice(i, 1);
    Director.onZombieKilled();
    updateHUD();
  }
}

// ==================== DIRECTOR ====================
const Director = {
  wave: 0, zombiesToSpawn: 0, zombiesSpawned: 0, zombiesKilledThisWave: 0,
  prepPhase: true, prepTimer: 3, spawnTimer: 0, spawnInterval: 1.0, difficulty: 1.0,
  hordeActive: false, hordeTimer: 0,

  update(dt, player) {
    if (gameState !== GameState.PLAYING) return;
    this.updateDifficulty(dt, player);
    this.updateWaves(dt, player);
    this.spawnZombies(dt);
    this.updateHorde(dt);
  },
  updateDifficulty(dt, player) {
    const hp = player ? player.hp / player.maxHp : 1;
    const p = hp * 0.5 + Math.min(1, GameStats.kills / 100) * 0.5;
    if (p > 0.7) this.difficulty += CONFIG.DIRECTOR.DIFFICULTY.INCREASE_RATE * dt;
    else if (p < 0.3) this.difficulty -= CONFIG.DIRECTOR.DIFFICULTY.DECREASE_RATE * dt;
    this.difficulty = Math.max(CONFIG.DIRECTOR.DIFFICULTY.MIN, Math.min(CONFIG.DIRECTOR.DIFFICULTY.MAX, this.difficulty));
  },
  updateWaves(dt, player) {
    if (this.prepPhase) {
      this.prepTimer -= dt;
      if (this.prepTimer <= 0) this.startWave();
    } else if (this.zombiesKilledThisWave >= this.zombiesToSpawn ||
               (this.zombiesSpawned >= this.zombiesToSpawn && zombies.length === 0)) {
      this.endWave(player);
    }
  },
  startWave() {
    this.wave++;
    GameStats.wavesSurvived = this.wave;
    this.prepPhase = false;
    this.zombiesToSpawn = Math.floor(CONFIG.DIRECTOR.WAVES.BASE_COUNT *
      Math.pow(CONFIG.DIRECTOR.WAVES.COUNT_MULTIPLIER, this.wave - 1) * this.difficulty);
    this.zombiesSpawned = 0;
    this.zombiesKilledThisWave = 0;
    this.spawnTimer = 0;
    this.spawnInterval = Math.max(0.15, 1.4 / (1 + this.wave * 0.12));
    showNotification(`WAVE ${this.wave}`, '#ffaa44');
    if (this.wave > 1 && Math.random() < CONFIG.DIRECTOR.WAVES.HORDE_CHANCE) this.triggerHorde();
    updateHUD();
  },
  endWave(player) {
    this.prepPhase = true;
    this.prepTimer = CONFIG.DIRECTOR.WAVES.PREP_TIME;
    if (player) { player.hp = Math.min(player.maxHp, player.hp + 30); player.weapon.reserveAmmo += 30; }
    showNotification('موج بعدی...', '#66ff66');
    updateHUD();
  },
  spawnZombies(dt) {
    if (this.prepPhase || this.zombiesSpawned >= this.zombiesToSpawn) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval;
      const n = this.hordeActive ? 3 : 1;
      for (let i = 0; i < n; i++) {
        if (this.zombiesSpawned >= this.zombiesToSpawn) break;
        if (zombies.length >= CONFIG.MAX_ZOMBIES) break;
        const pos = this.getSpawnPos();
        if (!pos) continue;
        zombies.push(new ZombieClass(this.pickType(), pos));
        this.zombiesSpawned++;
      }
    }
  },
  pickType() {
    const w = this.wave, r = Math.random();
    if (w <= 2) return r < 0.75 ? 'WALKER' : 'RUNNER';
    if (w <= 5) {
      if (r < 0.45) return 'WALKER';
      if (r < 0.72) return 'RUNNER';
      if (r < 0.86) return 'CRAWLER';
      if (r < 0.94) return 'BOOMER';
      return 'HUNTER';
    }
    if (r < 0.25) return 'WALKER';
    if (r < 0.44) return 'RUNNER';
    if (r < 0.58) return 'CRAWLER';
    if (r < 0.72) return 'BOOMER';
    if (r < 0.92) return 'HUNTER';
    return 'TANK';
  },
  getSpawnPos() {
    const p = player ? player.group.position : new THREE.Vector3();
    const half = CONFIG.WORLD.ARENA_SIZE / 2 - 5;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 25 + Math.random() * 15;
      let x = p.x + Math.cos(a) * d;
      let z = p.z + Math.sin(a) * d;
      x = Math.max(-half, Math.min(half, x));
      z = Math.max(-half, Math.min(half, z));
      const ddx = x - p.x, ddz = z - p.z;
      if (ddx * ddx + ddz * ddz < 20 * 20) continue;
      let blocked = false;
      for (const o of obstacles) {
        if (x > o.minX - 0.5 && x < o.maxX + 0.5 && z > o.minZ - 0.5 && z < o.maxZ + 0.5) { blocked = true; break; }
      }
      if (!blocked) return new THREE.Vector3(x, 0, z);
    }
    return null;
  },
  triggerHorde() {
    this.hordeActive = true;
    this.hordeTimer = CONFIG.DIRECTOR.WAVES.HORDE_DURATION;
    showNotification('⚠ HORDE ⚠', '#ff3030');
    playSound('horde');
  },
  updateHorde(dt) {
    if (this.hordeActive) {
      this.hordeTimer -= dt;
      if (this.hordeTimer <= 0) this.hordeActive = false;
    }
  },
  onBoomerExplode(pos) {
    const r = CONFIG.ZOMBIE.BOOMER.explodeRadius;
    for (const z of zombies) {
      if (!z.alive) continue;
      if (z.group.position.distanceTo(pos) < r) z.speed *= 1.4;
    }
    showNotification('BOOMER!', '#aaff00');
    if (this.zombiesToSpawn - this.zombiesSpawned > 0) this.spawnTimer = 0.1;
  },
  onZombieKilled() { this.zombiesKilledThisWave++; },
};

// ==================== AUDIO ====================
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
}
function playSound(type) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const vol = (settings.sfx / 100) * CONFIG.AUDIO.SFX_VOLUME;
  if (type === 'shoot') {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(230, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
    g.gain.setValueAtTime(vol * 0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.12);
    playNoise(0.05, vol * 0.3);
  } else if (type === 'horde') {
    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now + i * 0.3);
      osc.frequency.linearRampToValueAtTime(200, now + i * 0.3 + 0.2);
      g.gain.setValueAtTime(vol * 0.35, now + i * 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.3 + 0.25);
      osc.connect(g).connect(audioCtx.destination);
      osc.start(now + i * 0.3); osc.stop(now + i * 0.3 + 0.25);
    }
  }
}
function playNoise(dur, vol) {
  if (!audioCtx) return;
  const bufSize = audioCtx.sampleRate * dur;
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  src.connect(g).connect(audioCtx.destination);
  src.start();
}

// ==================== UI ====================
function updateHUD() {
  const hpP = player ? (player.hp / player.maxHp) * 100 : 100;
  const hb = document.getElementById('health-bar');
  if (hb) { hb.style.width = hpP + '%'; hb.classList.toggle('low', hpP < 30); }
  if (player) {
    const a = document.getElementById('ammo-current');
    const r = document.getElementById('ammo-reserve');
    if (a) a.textContent = player.weapon.currentAmmo;
    if (r) r.textContent = ` / ${player.weapon.reserveAmmo}`;
  }
  const w = document.getElementById('wave-number');
  if (w) w.textContent = `WAVE ${Director.wave}`;
  const pp = Director.zombiesToSpawn > 0 ? (Director.zombiesKilledThisWave / Director.zombiesToSpawn) * 100 : 0;
  const pf = document.getElementById('wave-progress-fill');
  if (pf) pf.style.width = pp + '%';
  const k = document.getElementById('kill-count');
  if (k) k.textContent = GameStats.kills;
}

function showNotification(text, color = '#ff4444') {
  const c = document.getElementById('notifications');
  if (!c) return;
  const el = document.createElement('div');
  el.className = 'notif';
  el.textContent = text;
  el.style.color = color;
  el.style.textShadow = `0 0 20px ${color}80`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

let flashT = null;
function flashDamage() {
  const o = document.getElementById('damage-overlay');
  if (!o) return;
  o.style.opacity = '1';
  if (flashT) clearTimeout(flashT);
  flashT = setTimeout(() => { o.style.opacity = '0'; }, 150);
}

let shakeAmt = 0;
function shakeCamera(a) { if (settings.cameraShake) shakeAmt = Math.max(shakeAmt, a); }
function updateShake(dt) {
  if (shakeAmt > 0) {
    camera.position.x += (Math.random() - 0.5) * shakeAmt;
    camera.position.y += (Math.random() - 0.5) * shakeAmt;
    camera.position.z += (Math.random() - 0.5) * shakeAmt;
    shakeAmt -= dt * 2.5;
    if (shakeAmt < 0) shakeAmt = 0;
  }
}

let hintTimer = null;
function showHint(text, duration = 3500) {
  const h = document.getElementById('hint');
  if (!h) return;
  h.textContent = text;
  h.classList.add('show');
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.remove('show'), duration);
}

// ==================== CHARACTER CARDS ====================
const charGridEl = document.getElementById('char-grid');
function renderCharacterCards() {
  if (!charGridEl) return;
  charGridEl.innerHTML = '';
  CONFIG.CHARACTERS.forEach(c => {
    const card = document.createElement('div');
    card.className = 'char-card' + (settings.characterId === c.id ? ' selected' : '');
    const canvas = document.createElement('canvas');
    canvas.className = 'char-canvas';
    canvas.width = 80; canvas.height = 100;
    drawCharPreview(canvas, c);
    card.appendChild(canvas);
    const n = document.createElement('div');
    n.className = 'char-name';
    n.textContent = c.name;
    card.appendChild(n);
    const d = document.createElement('div');
    d.className = 'char-desc';
    d.textContent = c.desc;
    card.appendChild(d);
    const s = document.createElement('div');
    s.className = 'char-stats';
    s.innerHTML = `<span>HP ${Math.round(c.hpMult * 100)}%</span><span>SPD ${Math.round(c.speedMult * 100)}%</span>`;
    card.appendChild(s);
    card.addEventListener('click', () => {
      settings.characterId = c.id;
      saveSettings(settings);
      renderCharacterCards();
    });
    charGridEl.appendChild(card);
  });
}
function drawCharPreview(canvas, c) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#' + c.skin.toString(16).padStart(6, '0');
  ctx.beginPath(); ctx.arc(w / 2, 22, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#' + c.hair.toString(16).padStart(6, '0');
  ctx.beginPath(); ctx.arc(w / 2, 18, 13, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#' + c.shirt.toString(16).padStart(6, '0');
  ctx.fillRect(w / 2 - 14, 36, 28, 32);
  ctx.fillRect(w / 2 - 20, 38, 6, 28);
  ctx.fillRect(w / 2 + 14, 38, 6, 28);
  ctx.fillStyle = '#' + c.pants.toString(16).padStart(6, '0');
  ctx.fillRect(w / 2 - 12, 68, 10, 26);
  ctx.fillRect(w / 2 + 2, 68, 10, 26);
}

// ==================== SCREENS ====================
function showScreen(id) {
  ['start-screen', 'mode-screen', 'chars-screen', 'settings-screen', 'gameover-screen'].forEach(sid => {
    const el = document.getElementById(sid);
    if (el) el.classList.toggle('hidden', sid !== id);
  });
}
function showHUD(show) {
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = show ? 'block' : 'none';
}

function bindSettings() {
  const q = document.getElementById('set-quality');
  const sfx = document.getElementById('set-sfx');
  const sh = document.getElementById('set-shake');
  const tc = document.getElementById('set-touch');
  if (q) { q.value = settings.quality; q.addEventListener('change', () => { settings.quality = q.value; saveSettings(settings); showNotification('صفحه را رفرش کنید', '#ffaa00'); }); }
  if (sfx) { sfx.value = settings.sfx; sfx.addEventListener('input', () => { settings.sfx = +sfx.value; saveSettings(settings); }); }
  if (sh) { sh.classList.toggle('on', settings.cameraShake); sh.addEventListener('click', () => { settings.cameraShake = !settings.cameraShake; sh.classList.toggle('on', settings.cameraShake); saveSettings(settings); }); }
  if (tc) { tc.value = settings.touchControls; tc.addEventListener('change', () => { settings.touchControls = tc.value; saveSettings(settings); updateTouchVisibility(); }); }
}
bindSettings();

// Mode selection
document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode;
    settings.gameMode = mode;
    saveSettings(settings);
    applyLighting(mode);
    startGame();
  });
});

document.getElementById('play-btn')?.addEventListener('click', () => {
  showScreen('mode-screen');
});
document.getElementById('mode-back-btn')?.addEventListener('click', () => showScreen('start-screen'));
document.getElementById('restart-btn')?.addEventListener('click', () => {
  showScreen('mode-screen');
  document.getElementById('gameover-screen')?.classList.add('hidden');
});
document.getElementById('menu-btn')?.addEventListener('click', () => { gameState = GameState.MENU; showScreen('start-screen'); showHUD(false); });
document.getElementById('chars-btn')?.addEventListener('click', () => { renderCharacterCards(); showScreen('chars-screen'); });
document.getElementById('chars-back-btn')?.addEventListener('click', () => showScreen('start-screen'));
document.getElementById('settings-btn')?.addEventListener('click', () => showScreen('settings-screen'));
document.getElementById('settings-back-btn')?.addEventListener('click', () => showScreen('start-screen'));

// ==================== GAME LOOP ====================
const clock = new THREE.Clock();
const camOffset = new THREE.Vector3(0, CONFIG.CAMERA.OFFSET_Y, CONFIG.CAMERA.OFFSET_Z);
const camPos = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameState === GameState.PLAYING && player) {
    navGrid.updateTarget(player.group.position.x, player.group.position.z);
    player.update(dt, zombies);
    Director.update(dt, player);

    for (let i = zombies.length - 1; i >= 0; i--) zombies[i].update(dt, player);

    for (const p of particlePool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; p.mesh.visible = false; continue; }
      p.velocity.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.material.opacity = p.life / p.maxLife;
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 4;
    }

    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        tracers.splice(i, 1);
        continue;
      }
      t.line.material.opacity = (t.life / t.maxLife) * 0.95;
    }

    for (const b of barrels) {
      const f = 0.75 + Math.sin(performance.now() * 0.01 + Math.random() * 0.5) * 0.25;
      b.light.intensity = 2.5 * f;
      b.fire.scale.setScalar(0.8 + Math.random() * 0.5);
      b.fire.position.y = b.baseY + Math.random() * 0.12;
    }

    camPos.copy(player.group.position).add(camOffset);
    camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
    camera.lookAt(player.group.position.x, 1.2, player.group.position.z);

    updateShake(dt);
    if (Math.floor(performance.now() / 100) % 2 === 0) updateHUD();
  }

  renderer.render(scene, camera);
}

// ==================== START ====================
function startGame() {
  gameState = GameState.PLAYING;
  showHUD(true);
  showScreen('');

  zombies.forEach(z => scene.remove(z.group));
  zombies.length = 0;
  if (player) scene.remove(player.group);

  const char = CONFIG.CHARACTERS.find(c => c.id === settings.characterId) || CONFIG.CHARACTERS[0];
  player = new PlayerClass(char);
  player.group.position.set(0, 0, 0);

  // Flashlight only at night
  if (settings.gameMode === 'night') player.enableFlashlight();

  GameStats.kills = 0;
  GameStats.score = 0;
  GameStats.wavesSurvived = 0;

  Director.wave = 0;
  Director.difficulty = 1.0;
  Director.prepPhase = true;
  Director.prepTimer = 3;
  Director.zombiesToSpawn = 0;
  Director.zombiesSpawned = 0;
  Director.zombiesKilledThisWave = 0;
  Director.hordeActive = false;

  navGrid.compute(player.group.position.x, player.group.position.z);

  camera.position.copy(player.group.position).add(camOffset);
  camera.lookAt(player.group.position.x, 1.2, player.group.position.z);

  initAudio();
  updateHUD();

  // Hint
  const hintText = touch.isTouch
    ? 'انگشتت رو هرجای صفحه بذار و بکش تا حرکت کنی — خودکار شلیک می‌شه'
    : 'WASD یا جهت‌دار برای حرکت — شلیک خودکاره';
  showHint(hintText, 5000);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Initial lighting (day by default, just for menu preview)
applyLighting('day');

document.getElementById('loading')?.classList.add('hidden');
animate();

console.log('%c🧟 DEAD SIGNAL v4 — Day/Night + Auto-Fire', 'color: #ff4444; font-size: 18px; font-weight: bold;');
console.log('%cMove only. Character aims and shoots automatically.', 'color: #888; font-size: 12px;');