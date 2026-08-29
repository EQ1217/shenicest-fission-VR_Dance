import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
const defaultEnvironment = scene.environment;
let cityEnvironment = null;
new RGBELoader()
  .loadAsync("models/city/modern_evening_street_1k.hdr")
  .then((tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    cityEnvironment = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
  })
  .catch(() => {});
scene.fog = new THREE.FogExp2(0x080810, 0.028);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 80);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.4, -3);
controls.maxPolarAngle = Math.PI * 0.55;

scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x151018, 0.55));
const keyLight = new THREE.DirectionalLight(0xfff1d8, 1.05);
keyLight.position.set(3, 5, 1);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 30;
keyLight.shadow.camera.left = -9;
keyLight.shadow.camera.right = 9;
keyLight.shadow.camera.top = 9;
keyLight.shadow.camera.bottom = -9;
keyLight.shadow.bias = -0.0002;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x6fd8ff, 0.6);
rimLight.position.set(-3, 2, -3);
scene.add(rimLight);

// 舞台聚光灯：让舞者/舞台成为唯一焦点
const STAGE_Z = -3;
const spot = new THREE.SpotLight(0xffe8c0, 1.75, 25, 0.75, 0.5, 1.5);
spot.position.set(0, 5, 0.5);
spot.target.position.set(0, 0, STAGE_Z);
scene.add(spot);
scene.add(spot.target);

const statusEl = document.getElementById("status");
const setStatus = (s) => (statusEl.textContent = s);
setStatus(`WebXR 检测：${navigator.xr ? "支持 ✓" : "不支持 ✗"}｜等待姿态数据…`);

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const glowTex = makeGlowTexture();

// 场景“呼吸感”和植物摆动：不主动抢戏，只让画面看起来活着。
const breathItems = [];
const floatingDust = [];
const swayItems = [];

function registerSway(object, amp, speed = 0.5 + Math.random() * 0.9, axis = "z") {
  object.userData.sway = {
    phase: Math.random() * Math.PI * 2,
    amp,
    speed,
    axis,
    baseRot: object.rotation.clone(),
  };
  swayItems.push(object);
}

function glowPoints(n, color, size, spreadX, spreadY, spreadZ) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spreadX;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spreadY;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spreadZ;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size,
    map: glowTex,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geo, mat);
  const base = pos.slice();
  const phases = new Float32Array(n);
  const speeds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.35 + Math.random() * 0.8;
  }
  floatingDust.push({ points, base, phases, speeds });
  return points;
}

// 在环绕观众的圆环上放置道具（360° 环境）
function envRing(count, makeProp, radius, yMin, yMax) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.2;
    const r = radius * (0.85 + Math.random() * 0.35);
    const m = makeProp();
    m.position.set(Math.cos(a) * r, yMin + Math.random() * (yMax - yMin), Math.sin(a) * r);
    m.rotation.y = Math.random() * Math.PI * 2;
    g.add(m);
  }
  return g;
}

// ============ 三个场景：焦点舞台布景 + 环绕观众环境 ============
const spinMeshes = [];

function buildStone() {
  const focal = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x96a6c8, roughness: 0.55, metalness: 0.15 });
  const rune = new THREE.MeshStandardMaterial({ color: 0x35507a, emissive: 0x4fc0ff, emissiveIntensity: 0.28, roughness: 0.42 });
  // 舞台后方弧形柱列
  for (let i = 0; i < 5; i++) {
    const x = -1.8 + i * 0.9;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 2.6, 10), stone);
    col.position.set(x, 1.3, -2.0);
    focal.add(col);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), stone);
    cap.position.set(x, 2.68, -2.0);
    focal.add(cap);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), rune);
    r.position.set(x, 2.82, -2.0);
    focal.add(r);
  }
  // 两侧框景柱
  [[-2.2, 0.5], [2.2, 0.5]].forEach(([x, z]) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.0, 10), stone);
    col.position.set(x, 1.5, z);
    focal.add(col);
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 3.0;
  focal.add(ring);
  spinMeshes.push(ring);
  focal.add(glowPoints(160, 0xbfe9ff, 0.06, 5, 3.5, 5));

  const env = new THREE.Group();
  env.add(envRing(12, () => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + Math.random() * 0.3, 0), stone);
    m.scale.y = 0.5 + Math.random() * 0.4;
    return m;
  }, 5, 0.4, 2.4));
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(260 * 3);
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 3;
    starPos[i * 3] = Math.cos(a) * r;
    starPos[i * 3 + 1] = 1.5 + Math.random() * 3.5;
    starPos[i * 3 + 2] = Math.sin(a) * r;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  env.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fd4ff, size: 0.045, map: glowTex, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  return { focal, env };
}

function buildForest() {
  const focal = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 0.82, metalness: 0.02 });
  const barkDark = new THREE.MeshStandardMaterial({ color: 0x35271d, roughness: 0.92, metalness: 0.02 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x2f7d3d, roughness: 0.74, metalness: 0.01 }),
    new THREE.MeshStandardMaterial({ color: 0x3d9a52, roughness: 0.68, metalness: 0.01 }),
    new THREE.MeshStandardMaterial({ color: 0x63b969, roughness: 0.62, metalness: 0.01, emissive: 0x071f0d, emissiveIntensity: 0.35 }),
    new THREE.MeshStandardMaterial({ color: 0x1f5d33, roughness: 0.8, metalness: 0.01 }),
  ];

  const mossCanvas = document.createElement("canvas");
  mossCanvas.width = mossCanvas.height = 256;
  const mossCtx = mossCanvas.getContext("2d");
  mossCtx.fillStyle = "#173d24";
  mossCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 1 + Math.random() * 4;
    const g = 42 + Math.random() * 55;
    mossCtx.fillStyle = `rgba(${12 + Math.random() * 18},${g},${30 + Math.random() * 20},${0.08 + Math.random() * 0.16})`;
    mossCtx.beginPath();
    mossCtx.arc(x, y, r, 0, Math.PI * 2);
    mossCtx.fill();
  }
  const mossTex = new THREE.CanvasTexture(mossCanvas);
  mossTex.wrapS = mossTex.wrapT = THREE.RepeatWrapping;
  mossTex.repeat.set(7, 7);
  mossTex.colorSpace = THREE.SRGBColorSpace;

  const groundMat = new THREE.MeshStandardMaterial({ map: mossTex, color: 0xb7c99a, roughness: 0.95, metalness: 0 });

  const makeCanopy = (group, x, y, z, scale = 1) => {
    const mat = leafMats[Math.floor(Math.random() * leafMats.length)];
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52 * scale, 1), mat);
    blob.position.set(x, y, z);
    blob.scale.y = 0.75 + Math.random() * 0.2;
    blob.rotation.y = Math.random() * Math.PI;
    group.add(blob);
    return blob;
  };

  const makeTree = (x, z, h, group, big = false) => {
    const tree = new THREE.Group();
    const trunkH = h * 0.58;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.11 : 0.07, big ? 0.2 : 0.13, trunkH, 9), big ? trunkMat : barkDark);
    trunk.position.y = trunkH / 2;
    tree.add(trunk);
    const c = tree;
    makeCanopy(c, 0, trunkH + 0.12, 0, big ? 1.25 : 0.85);
    makeCanopy(c, (big ? 0.24 : 0.16), trunkH + 0.45, (big ? 0.05 : 0.02), big ? 0.9 : 0.62);
    makeCanopy(c, -(big ? 0.25 : 0.17), trunkH + 0.48, -(big ? 0.08 : 0.04), big ? 0.88 : 0.6);
    makeCanopy(c, 0, trunkH + 0.78, 0, big ? 0.72 : 0.5);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    group.add(tree);
    registerSway(tree, big ? 0.012 : 0.022, 0.35 + Math.random() * 0.6, "z");
  };

  const makeBush = (x, y, z, s) => {
    const bush = new THREE.Group();
    const mat = leafMats[Math.floor(Math.random() * leafMats.length)];
    for (let b = 0; b < 4; b++) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18 * s + Math.random() * 0.1 * s, 1), mat);
      blob.position.set((Math.random() - 0.5) * 0.35 * s, 0.18 * s + Math.random() * 0.14 * s, (Math.random() - 0.5) * 0.35 * s);
      blob.rotation.y = Math.random() * Math.PI;
      bush.add(blob);
    }
    bush.position.set(x, y, z);
    bush.rotation.y = Math.random() * Math.PI * 2;
    return bush;
  };

  [[-2.25, -1.7], [-1.55, -2.25], [1.65, -2.3], [2.2, -1.65], [0, -2.5], [-0.9, -2.05], [0.9, -2.1]].forEach(([x, z]) => makeTree(x, z, 1.35 + Math.random() * 0.65, focal));
  for (let i = 0; i < 12; i++) {
    const a = Math.PI + (Math.random() - 0.5) * 1.25;
    const r = 1.7 + Math.random() * 1.5;
    const behindZ = -Math.max(0.35, Math.abs(Math.sin(a) * r));
    const bush = makeBush(Math.cos(a) * r, 0, behindZ, 0.55 + Math.random() * 0.35);
    focal.add(bush);
    registerSway(bush, 0.025, 0.5 + Math.random() * 0.8, "z");
  }
  focal.add(glowPoints(190, 0x9dffc0, 0.055, 5.5, 3.2, 5.5));

  const env = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + Math.random() * 0.18;
    const r = 4.2 + Math.random() * 3.3;
    makeTree(Math.cos(a) * r, Math.sin(a) * r, 1.1 + Math.random() * 1.7, env, Math.random() > 0.7);
  }
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 3.0 + Math.random() * 4.6;
    const bush = makeBush(Math.cos(a) * r, 0, Math.sin(a) * r, 0.5 + Math.random() * 0.5);
    env.add(bush);
    registerSway(bush, 0.028, 0.5 + Math.random() * 0.8, "z");
  }
  env.add(glowPoints(120, 0xb4ffce, 0.05, 8, 4, 8));
  return { focal, env };
}

function buildCrystal() {
  const focal = new THREE.Group();
  const crystalColors = [0xff5a3c, 0xff7a4a, 0x9f5cff, 0x4fd8ff, 0xff4f8a];
  const crystalMats = {};
  const crystalMat = (color) => crystalMats[color] ||= new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.08, roughness: 0.48 });

  for (let c = 0; c < 8; c++) {
    const a = Math.PI + (Math.random() - 0.5) * 1.6; // 舞台后方扇形
    const r = 1.5 + Math.random() * 1.2;
    const cluster = new THREE.Group();
    const shardCount = 2 + Math.floor(Math.random() * 3);
    for (let s = 0; s < shardCount; s++) {
      const color = crystalColors[Math.floor(Math.random() * crystalColors.length)];
      const mat = crystalMat(color);
      const h = 0.5 + Math.random() * 0.9;
      const rTop = 0.06 + Math.random() * 0.08;
      const rBottom = 0.12 + Math.random() * 0.16;
      const prism = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 6, 1), mat);
      prism.position.y = h / 2;
      const tipH = h * (0.25 + Math.random() * 0.25);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(rTop * 1.05, tipH, 6), mat);
      tip.position.y = h + tipH / 2;
      const shard = new THREE.Group();
      shard.add(prism, tip);
      shard.position.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
      shard.rotation.set((Math.random() - 0.5) * 0.8, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.8);
      cluster.add(shard);
    }
    cluster.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.6 - 1.2);
    focal.add(cluster);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffc0a0 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  focal.add(ring);
  spinMeshes.push(ring);
  focal.add(glowPoints(140, 0xffb080, 0.07, 5, 3, 5));

  const env = envRing(12, () => new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + Math.random() * 0.3, 0), new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0x40120a, emissiveIntensity: 0.12, roughness: 0.52 })), 5, 0.6, 2.4);
  return { focal, env };
}

function makeCityWindowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#0a0c18";
  g.fillRect(0, 0, 256, 256);

  // 玻璃幕墙：少量冷色窗 + 暖色灯光窗，避免重复感。
  const cols = 16;
  const rows = 24;
  const stepX = 256 / cols;
  const stepY = 256 / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = Math.random();
      if (v < 0.42) continue;
      const lit = v > 0.88;
      g.fillStyle = lit
        ? `rgba(255, ${180 + Math.floor(Math.random() * 55)}, 88, ${0.7 + Math.random() * 0.3})`
        : `rgba(${70 + Math.floor(Math.random() * 45)}, ${90 + Math.floor(Math.random() * 45)}, ${150 + Math.floor(Math.random() * 55)}, 0.42)`;
      const pad = 4 + Math.random() * 5;
      g.fillRect(x * stepX + pad * 0.7, y * stepY + pad * 0.45, stepX - pad, stepY - pad);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeCityBuilding(h, baseColor, windowTex, neonColor = null) {
  const g = new THREE.Group();
  const w = 0.85 + Math.random() * 0.75;
  const d = 0.75 + Math.random() * 0.65;
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    map: windowTex,
    emissiveMap: windowTex,
    emissive: new THREE.Color(0x2b1b4d),
    emissiveIntensity: 0.75,
    roughness: 0.68,
    metalness: 0.14,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  body.position.y = h / 2;
  g.add(body);

  if (neonColor !== null) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.02, 0.06, d * 1.02),
      new THREE.MeshBasicMaterial({ color: neonColor, toneMapped: false })
    );
    strip.position.y = h * 0.78;
    g.add(strip);
  }
  return g;
}

function buildCity() {
  const windowTex = makeCityWindowTexture();

  const focal = new THREE.Group();
  // 舞台后方半圈楼宇：压暗的近景剪影，让舞者仍然最亮。
  const skylineDefs = [
    { x: -4.1, z: -3.1, h: 2.4, c: 0x1c2338, n: 0x36d5ff },
    { x: -3.0, z: -3.7, h: 3.4, c: 0x21263c, n: 0x9f5cff },
    { x: -1.7, z: -4.0, h: 2.8, c: 0x17233b, n: 0x36d5ff },
    { x: -0.2, z: -4.2, h: 4.2, c: 0x111a2e, n: 0xff4f8a },
    { x: 1.4, z: -4.0, h: 3.0, c: 0x1b2138, n: 0x36d5ff },
    { x: 2.8, z: -3.7, h: 3.6, c: 0x20263d, n: 0x9f5cff },
    { x: 4.0, z: -3.1, h: 2.5, c: 0x182236, n: 0x36d5ff },
  ];
  skylineDefs.forEach((s) => {
    const b = makeCityBuilding(s.h, s.c, windowTex, s.n);
    b.position.set(s.x, 0, s.z);
    b.rotation.y = (Math.random() - 0.5) * 0.14;
    focal.add(b);
  });
  focal.add(glowPoints(130, 0x8ecfff, 0.06, 6, 4, 6));

  const env = new THREE.Group();
  // 城市道路环 + 地面标线，环绕观众，不遮挡中央舞台。
  const road = new THREE.Mesh(
    new THREE.RingGeometry(3.55, 4.45, 96),
    new THREE.MeshStandardMaterial({ color: 0x15161d, roughness: 0.86, metalness: 0.04 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.002;
  env.add(road);
  const roadLine = new THREE.Mesh(
    new THREE.RingGeometry(3.98, 4.04, 96),
    new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0.72, toneMapped: false })
  );
  roadLine.rotation.x = -Math.PI / 2;
  roadLine.position.y = 0.008;
  env.add(roadLine);

  const buildingColors = [0x1d2742, 0x151a2d, 0x251f3a, 0x182238, 0x2b1f3c];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + Math.random() * 0.14;
    const r = 5.1 + Math.random() * 2.0;
    const h = 1.8 + Math.random() * 4.0;
    const b = makeCityBuilding(
      h,
      buildingColors[Math.floor(Math.random() * buildingColors.length)],
      windowTex,
      Math.random() > 0.68 ? 0x36d5ff : null
    );
    b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    b.rotation.y = Math.random() * Math.PI * 2;
    env.add(b);
  }

  // 街灯：细小发光头，不抢舞台，只补充城市纵深。
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 4.85;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0x2a2e3c, roughness: 0.7, metalness: 0.35 }));
    pole.position.set(Math.cos(a) * r, 1.25, Math.sin(a) * r);
    env.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
    head.position.set(Math.cos(a) * r + Math.cos(a) * 0.08, 2.55, Math.sin(a) * r + Math.sin(a) * 0.08);
    env.add(head);
  }
  env.add(glowPoints(90, 0xff86c0, 0.055, 8, 4.5, 8));
  return { focal, env };
}

const built = [buildStone(), buildForest(), buildCrystal(), buildCity()];
const scenesFocal = built.map((b) => b.focal);
const scenesEnv = built.map((b) => b.env);
scenesFocal.forEach((g) => {
  g.position.z = STAGE_Z;
  g.userData.breath = { phase: Math.random() * Math.PI * 2, amp: 0.012, speed: 0.7 };
  scene.add(g);
});
scenesEnv.forEach((g, i) => {
  g.userData.breath = { phase: i * 1.8, amp: 0.014, speed: 0.55 };
  scene.add(g);
});
scenesFocal.forEach((g) => breathItems.push(g));
scenesEnv.forEach((g) => breathItems.push(g));

// 给程序化布景开启投影/接收阴影，并用透明 ShadowMaterial 让虚拟物体“落地”
[...scenesFocal, ...scenesEnv].forEach((g) =>
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  })
);
const shadowCatcher = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.ShadowMaterial({ opacity: 0.16 })
);
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = 0;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);

// 舞台地面平台 + 发光环
const stage = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.06, 48), new THREE.MeshStandardMaterial({ color: 0x10101c, roughness: 0.5, metalness: 0.3 }));
stage.position.set(0, -0.04, STAGE_Z);
scene.add(stage);
const stageRing = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.03, 8, 96), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }));
stageRing.rotation.x = -Math.PI / 2;
stageRing.position.set(0, 0.01, STAGE_Z);
scene.add(stageRing);

// 晶簇场景优先使用 Blender PBR 整景模型；加载失败则保留程序化晶簇。
const crystalFull = new THREE.Group();
crystalFull.position.set(0, 0, STAGE_Z);
crystalFull.visible = false;
scene.add(crystalFull);
let crystalFullReady = false;

const SCENE_NAMES = ["星空石阵", "雨林", "能量晶簇", "霓虹都市"];
const SCENE_FLASH_COLORS = [0xbfe9ff, 0x9dffc0, 0xffb080, 0xff8ad4];
let sceneIdx = 0;
let beatCount = 0;
let beatPulse = 0;
let phraseEnergySum = 0;
let phraseBeats = 0;

// 切景用“暗场渐入渐出”过渡：先暗下来，换场景，再慢慢亮回来。
const transitionMat = new THREE.MeshBasicMaterial({
  color: 0x04120a,
  transparent: true,
  opacity: 0,
  depthTest: false,
  depthWrite: false,
  fog: false,
  side: THREE.BackSide,
});
const transitionOverlay = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 32), transitionMat);
transitionOverlay.renderOrder = 999;
transitionOverlay.visible = true;
camera.add(transitionOverlay);
scene.add(camera);

let transitionState = "idle";
let transitionT = 0;
let transitionNext = 0;
const TRANSITION_COLORS = [0x06121f, 0x04180d, 0x150c1c, 0x120a24];

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function applyScene(i) {
  i = ((i % SCENE_NAMES.length) + SCENE_NAMES.length) % SCENE_NAMES.length;
  const showModelStage = i === 2 && crystalFullReady;
  scenesFocal.forEach((s, idx) => (s.visible = idx === i && !(idx === 2 && showModelStage)));
  scenesEnv.forEach((s, idx) => (s.visible = idx === i));
  stage.visible = false;
  stageRing.visible = !showModelStage;
  crystalFull.visible = showModelStage;
  sceneIdx = i;
  scene.environment = i === 3 && cityEnvironment ? cityEnvironment : defaultEnvironment;
  scene.environmentIntensity = i === 3 ? 0.55 : 0.3;
  setStatus(`场景：${SCENE_NAMES[i]}｜等待姿态…`);
}

function showScene(i) {
  i = ((i % SCENE_NAMES.length) + SCENE_NAMES.length) % SCENE_NAMES.length;
  if (i === sceneIdx || transitionState !== "idle") return;
  transitionNext = i;
  transitionState = "out";
  transitionT = 0;
  transitionMat.color.setHex(TRANSITION_COLORS[i]);
}
applyScene(0);

// ============ 舞者光晕（地面辉光池 + 光环） ============
const auraPool = new THREE.Mesh(
  new THREE.CircleGeometry(1.35, 96),
  new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x7affc8) },
      uOpacity: { value: 0.55 },
      uPulse: { value: 0 },
      uTime: { value: 0 },
      uEnergy: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uPulse;
      uniform float uTime;
      uniform float uEnergy;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);

        float pool = smoothstep(1.0, 0.05, r);
        pool = pow(pool, 2.2);

        float core = 1.0 - smoothstep(0.0, 0.45, r);

        float ringDist = abs(r - 0.56);
        float ring = 1.0 - smoothstep(0.0, 0.24, ringDist);
        ring = pow(ring, 1.6);

        float shimmer = 0.94 + 0.06 * sin(uTime * 0.0022 + r * 10.0);
        float a = uOpacity * shimmer * (pool * 0.48 + core * 0.14 + ring * (0.26 + uPulse * 0.45));
        a = min(a, 1.0);

        vec3 col = uColor * (0.72 + uEnergy * 0.55 + uPulse * 0.18);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: true,
  })
);
auraPool.rotation.x = -Math.PI / 2;
auraPool.position.set(0, 0.02, STAGE_Z);
scene.add(auraPool);

// 动作触发：双手张开时从舞者位置向外扩散的光环。
const shockRing = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.025, 8, 80), new THREE.MeshBasicMaterial({ color: 0x7affc8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
shockRing.rotation.x = -Math.PI / 2;
shockRing.position.set(0, 0.06, STAGE_Z);
scene.add(shockRing);
let shockLife = 0;

function triggerShockwave(color = 0x7affc8) {
  shockLife = 1;
  shockRing.material.color.setHex(color);
  shockRing.position.copy(auraPool.position).setY(0.06);
}

const auraTarget = new THREE.Vector3(0, 0.02, STAGE_Z);
let lastLandmarkAt = 0;
let auraOpacity = 0.6;

// ============ 粒子爆发 ============
const BURST_N = 160;
const burstGeo = new THREE.BufferGeometry();
const burstPos = new Float32Array(BURST_N * 3);
burstGeo.setAttribute("position", new THREE.BufferAttribute(burstPos, 3));
const burstVel = new Array(BURST_N).fill(0).map(() => new THREE.Vector3());
const burstMat = new THREE.PointsMaterial({ color: 0x7affc8, size: 0.18, map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const burstPoints = new THREE.Points(burstGeo, burstMat);
scene.add(burstPoints);
let burstLife = 0;

function triggerBurst() {
  burstLife = 1;
  for (let i = 0; i < BURST_N; i++) {
    burstPos[i * 3] = auraPool.position.x;
    burstPos[i * 3 + 1] = auraPool.position.y + 0.9;
    burstPos[i * 3 + 2] = auraPool.position.z;
    burstVel[i].set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(0.8 + Math.random() * 1.3);
  }
}

// ============ 舞者全息骨架（用关键点画一个发光小人） ============
const HOLO_BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
];
const holoJointPos = new Float32Array(33 * 3);
const holoJointGeo = new THREE.BufferGeometry();
holoJointGeo.setAttribute("position", new THREE.BufferAttribute(holoJointPos, 3));
const holoJointMat = new THREE.PointsMaterial({ color: 0x7affff, size: 0.055, map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const holoJoints = new THREE.Points(holoJointGeo, holoJointMat);

const holoBonePos = new Float32Array(HOLO_BONES.length * 2 * 3);
const holoBoneGeo = new THREE.BufferGeometry();
holoBoneGeo.setAttribute("position", new THREE.BufferAttribute(holoBonePos, 3));
const holoBoneMat = new THREE.LineBasicMaterial({ color: 0x7affff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const holoBones = new THREE.LineSegments(holoBoneGeo, holoBoneMat);

const holoGroup = new THREE.Group();
holoGroup.add(holoJoints, holoBones);
holoGroup.position.z = 0;
scene.add(holoGroup);
let holoOpacity = 0;

function updateHologram(lm) {
  const world = (p) => ({ x: (p.x - 0.5) * 2.4, y: (0.5 - p.y) * 2.4 });
  const hipY = (world(lm[23]).y + world(lm[24]).y) / 2;
  const offsetY = 0.85 - hipY;
  for (let i = 0; i < 33; i++) {
    const p = world(lm[i]);
    holoJointPos[i * 3] = p.x;
    holoJointPos[i * 3 + 1] = p.y + offsetY;
    holoJointPos[i * 3 + 2] = STAGE_Z;
  }
  holoJointGeo.attributes.position.needsUpdate = true;

  for (let b = 0; b < HOLO_BONES.length; b++) {
    const a = world(lm[HOLO_BONES[b][0]]);
    const c = world(lm[HOLO_BONES[b][1]]);
    holoBonePos[b * 6] = a.x;
    holoBonePos[b * 6 + 1] = a.y + offsetY;
    holoBonePos[b * 6 + 2] = STAGE_Z;
    holoBonePos[b * 6 + 3] = c.x;
    holoBonePos[b * 6 + 4] = c.y + offsetY;
    holoBonePos[b * 6 + 5] = STAGE_Z;
  }
  holoBoneGeo.attributes.position.needsUpdate = true;
  holoJoints.visible = true;
  holoBones.visible = true;
  holoOpacity = Math.min(0.72, holoOpacity + 0.08);
}

// ============ 外部免费模型（CC0，Poly Pizza；失败静默降级为程序化布景） ============
const gltfLoader = new GLTFLoader();

function makeProp(gltfScene, height) {
  const obj = gltfScene.clone(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) obj.scale.multiplyScalar(height / maxDim);
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const normalized = new THREE.Box3().setFromObject(obj);
  const holder = new THREE.Group();
  obj.position.y -= normalized.min.y;
  holder.add(obj);
  return holder;
}

function placeEnv(sceneIdx, prop, cfg, def) {
  const group = scenesEnv[sceneIdx];
  for (let i = 0; i < cfg.count; i++) {
    const p = prop.clone(true);
    const a = Math.random() * Math.PI * 2;
    const r = cfg.radius * (0.82 + Math.random() * 0.36);
    p.position.set(Math.cos(a) * r, cfg.y + Math.random() * cfg.yRand, Math.sin(a) * r);
    p.rotation.y = Math.random() * Math.PI * 2;
    if (def?.sway) registerSway(p, def.sway, def.swaySpeed ?? 0.55 + Math.random() * 0.7, def.swayAxis ?? "z");
    group.add(p);
  }
}

function placeFocal(sceneIdx, prop, cfg, def) {
  const group = scenesFocal[sceneIdx];
  for (let i = 0; i < cfg.count; i++) {
    const p = prop.clone(true);
    const a = cfg.center + (Math.random() - 0.5) * cfg.spread;
    const r = cfg.radius * (0.78 + Math.random() * 0.44);
    const behindZ = -Math.max(0.35, Math.abs(Math.sin(a) * r));
    p.position.set(Math.cos(a) * r, 0, behindZ);
    p.rotation.y = Math.random() * Math.PI * 2;
    if (def?.sway) registerSway(p, def.sway, def.swaySpeed ?? 0.55 + Math.random() * 0.7, def.swayAxis ?? "z");
    group.add(p);
  }
}

const MODEL_DEFS = [
  // 雨林（场景 1）
  { url: "models/pine_trees.glb", height: 2.6, sway: 0.012, swaySpeed: 0.35, swayAxis: "z", env: { scenes: [1], count: 5, radius: 5.2, y: 0, yRand: 0.3 }, focal: { scenes: [1], count: 2, radius: 2.2, center: Math.PI, spread: 1.0 } },
  { url: "models/birch_trees.glb", height: 2.8, sway: 0.015, swaySpeed: 0.45, swayAxis: "z", env: { scenes: [1], count: 4, radius: 5.2, y: 0, yRand: 0.3 }, focal: { scenes: [1], count: 2, radius: 2.6, center: Math.PI, spread: 0.8 } },
  { url: "models/fern.glb", height: 0.7, sway: 0.035, swaySpeed: 0.7, swayAxis: "z", env: { scenes: [1], count: 12, radius: 3.5, y: 0, yRand: 0.2 } },
  { url: "models/flowers.glb", height: 0.55, sway: 0.03, swaySpeed: 0.65, swayAxis: "z", env: { scenes: [1], count: 12, radius: 3.8, y: 0, yRand: 0.2 } },
  { url: "models/log_moss.glb", height: 0.6, env: { scenes: [1], count: 6, radius: 4.2, y: 0, yRand: 0.2 } },
  // 星空石阵（场景 0）
  { url: "models/rock_large.glb", height: 1.1, env: { scenes: [0], count: 6, radius: 5.0, y: 0, yRand: 0.3 }, focal: { scenes: [0], count: 3, radius: 2.0, center: Math.PI, spread: 1.0 } },
  { url: "models/rocks.glb", height: 0.7, env: { scenes: [0], count: 10, radius: 4.2, y: 0, yRand: 0.2 } },
  // 能量晶簇（场景 2）
  { url: "models/crystal_a.glb", height: 1.5, env: { scenes: [2], count: 8, radius: 5.0, y: 0.1, yRand: 0.5 }, focal: { scenes: [2], count: 4, radius: 1.9, center: Math.PI, spread: 1.1 } },
  { url: "models/crystal_b.glb", height: 1.1, env: { scenes: [2], count: 8, radius: 4.4, y: 0.1, yRand: 0.5 } },
  { url: "models/mineral.glb", height: 1.0, focal: { scenes: [2], count: 5, radius: 2.2, center: Math.PI, spread: 1.2 } },
  // 霓虹都市（场景 3）：Kenney CC0 楼宇，近景和远景都铺，避免塑料感。
  { url: "models/city/building-skyscraper-a.glb", height: 6.2, env: { scenes: [3], count: 2, radius: 5.8, y: 0, yRand: 0.25 }, focal: { scenes: [3], count: 1, radius: 2.9, center: Math.PI, spread: 1.0 } },
  { url: "models/city/building-skyscraper-b.glb", height: 5.5, env: { scenes: [3], count: 2, radius: 5.6, y: 0, yRand: 0.25 }, focal: { scenes: [3], count: 1, radius: 2.7, center: Math.PI, spread: 1.1 } },
  { url: "models/city/building-skyscraper-c.glb", height: 5.0, env: { scenes: [3], count: 2, radius: 5.9, y: 0, yRand: 0.25 } },
  { url: "models/city/building-skyscraper-d.glb", height: 5.8, env: { scenes: [3], count: 2, radius: 5.4, y: 0, yRand: 0.25 } },
  { url: "models/city/building-skyscraper-e.glb", height: 5.3, env: { scenes: [3], count: 2, radius: 5.7, y: 0, yRand: 0.25 } },
  { url: "models/city/building-a.glb", height: 3.2, env: { scenes: [3], count: 2, radius: 4.8, y: 0, yRand: 0.15 } },
  { url: "models/city/building-b.glb", height: 3.6, env: { scenes: [3], count: 2, radius: 5.0, y: 0, yRand: 0.15 } },
  { url: "models/city/building-c.glb", height: 3.0, env: { scenes: [3], count: 2, radius: 4.9, y: 0, yRand: 0.15 } },
  { url: "models/city/building-e.glb", height: 3.8, env: { scenes: [3], count: 1, radius: 5.2, y: 0, yRand: 0.15 } },
  { url: "models/city/building-f.glb", height: 3.4, env: { scenes: [3], count: 2, radius: 5.1, y: 0, yRand: 0.15 } },
  { url: "models/city/building-g.glb", height: 3.7, env: { scenes: [3], count: 1, radius: 4.8, y: 0, yRand: 0.15 } },
  { url: "models/city/building-h.glb", height: 3.5, env: { scenes: [3], count: 1, radius: 5.3, y: 0, yRand: 0.15 } },
  { url: "models/city/low-detail-building-wide-a.glb", height: 2.5, env: { scenes: [3], count: 2, radius: 5.4, y: 0, yRand: 0.15 } },
  { url: "models/city/low-detail-building-wide-b.glb", height: 2.6, env: { scenes: [3], count: 2, radius: 5.0, y: 0, yRand: 0.15 } },
];

let modelsLoaded = 0;
MODEL_DEFS.forEach((def) => {
  gltfLoader.load(
    def.url,
    (gltf) => {
      const prop = makeProp(gltf.scene, def.height);
      if (def.env) def.env.scenes.forEach((si) => placeEnv(si, prop, def.env, def));
      if (def.focal) def.focal.scenes.forEach((si) => placeFocal(si, prop, def.focal, def));
      modelsLoaded++;
      setStatus(`外部模型已加载 ${modelsLoaded}/${MODEL_DEFS.length}｜场景：${SCENE_NAMES[sceneIdx]}`);
    },
    undefined,
    () => setStatus(`外部模型加载失败（已降级程序化）：${def.url}`)
  );
});

gltfLoader.load(
  "models/crystal_stage_v4.glb",
  (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (Array.isArray(o.material)) {
        o.material.forEach(boostCrystalMaterial);
      } else {
        boostCrystalMaterial(o.material);
      }
    });
    crystalFull.add(gltf.scene);
    crystalFullReady = true;
    if (sceneIdx === 2) showScene(2);
    setStatus(`晶簇 PBR 场景已加载｜场景：${SCENE_NAMES[sceneIdx]}`);
  },
  undefined,
  () => setStatus(`晶簇 PBR 加载失败，已降级程序化晶簇｜场景：${SCENE_NAMES[sceneIdx]}`)
);

function boostCrystalMaterial(m) {
  if (!m || typeof m.name !== "string") return;
  if (m.name === "ring") {
    m.toneMapped = true;
    if (m.emissiveIntensity !== undefined) m.emissiveIntensity = 0.08;
    if (m.roughness !== undefined) m.roughness = 0.65;
    if (m.metalness !== undefined) m.metalness = 0;
    return;
  }
  if (m.name.startsWith("crystal")) {
    m.toneMapped = true;
    if (m.emissiveIntensity !== undefined) m.emissiveIntensity = 0.04;
    if (m.roughness !== undefined) m.roughness = 0.55;
    if (m.metalness !== undefined) m.metalness = 0;
    if (m.emissive) m.emissive.multiplyScalar(0.45);
  }
}

// ============ 姿态数据 ============
let ws;
let relayReconnectTimer = null;
let lastWrist = null;
let burstT = 0;
let lastShockAt = 0;
let lastRaiseAt = 0;
let poseReceived = false;

function relayMessage(e) {
  try {
    const msg = JSON.parse(e.data);
    if (msg.type !== "landmarks" || !msg.lm) return;
    lastLandmarkAt = performance.now();
    if (!poseReceived) {
      poseReceived = true;
      setStatus(`姿态数据接收中 ✓｜场景：${SCENE_NAMES[sceneIdx]}`);
    }
    const lm = msg.lm;
    const cx = (lm[11].x + lm[12].x + lm[23].x + lm[24].x) / 4;
    const cz = (lm[11].z + lm[12].z + lm[23].z + lm[24].z) / 4;
    auraTarget.set((cx - 0.5) * 2.4, 0.02, STAGE_Z - cz * 1.2);
    updateHologram(lm);

    const left = lm[15];
    const right = lm[16];
    const leftWorld = { x: (left.x - 0.5) * 2.4, y: (0.5 - left.y) * 2.4 };
    const rightWorld = { x: (right.x - 0.5) * 2.4, y: (0.5 - right.y) * 2.4 };
    const shoulderMidY = (0.5 - (lm[11].y + lm[12].y) / 2) * 2.4;
    const handMidY = (leftWorld.y + rightWorld.y) / 2;
    const handSpread = Math.hypot(leftWorld.x - rightWorld.x, leftWorld.y - rightWorld.y);
    const now = performance.now();

    // 双手张开并抬到肩膀以上：向外扩散光环 + 粒子爆发。
    if (handSpread > 1.15 && handMidY > shoulderMidY + 0.35 && now - lastShockAt > 900) {
      lastShockAt = now;
      triggerShockwave(0x7affc8);
      triggerBurst();
    }

    // 任意一只手举过头顶：额外触发一次高亮光环。
    if (Math.max(leftWorld.y, rightWorld.y) > shoulderMidY + 0.9 && now - lastRaiseAt > 900) {
      lastRaiseAt = now;
      triggerShockwave(0xffd27a);
    }

    const w = left;
    const wx = (w.x - 0.5) * 2.4;
    const wy = (0.5 - w.y) * 2.4;
    if (lastWrist) {
      const d = Math.hypot(wx - lastWrist.x, wy - lastWrist.y);
      if (d > 0.18) triggerBurst();
    }
    lastWrist = { x: wx, y: wy };
  } catch {
    /* ignore */
  }
}

function connectRelay() {
  ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/relay`);
  ws.onopen = () => setStatus(`已连接姿态中继 ✓｜场景：${SCENE_NAMES[sceneIdx]}`);
  ws.onclose = () => {
    setStatus("姿态中继断开，1.5 秒后重连…");
    if (relayReconnectTimer) clearTimeout(relayReconnectTimer);
    relayReconnectTimer = setTimeout(connectRelay, 1500);
  };
  ws.onmessage = relayMessage;
}
connectRelay();

// ============ 音乐 / 节拍 ============
let audioCtx = null, analyser = null, audioEl = null, metroTimer = null, metroOn = false;
let micStream = null, micSource = null, micActive = false;
const BPM = 108;

const musicInput = document.getElementById("musicFile");
document.getElementById("btnMusic").addEventListener("click", () => musicInput.click());

function stopMic() {
  micActive = false;
  if (micSource) {
    try { micSource.disconnect(); } catch {}
    micSource = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
}

async function startMic() {
  stopMetro();
  if (audioEl && !audioEl.paused) audioEl.pause();
  if (!audioCtx) {
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  micSource = audioCtx.createMediaStreamSource(stream);
  analyser.disconnect();
  micSource.connect(analyser);
  micStream = stream;
  micActive = true;
  await audioCtx.resume();
  setStatus(`麦克风识别中，请播放音乐｜场景：${SCENE_NAMES[sceneIdx]}`);
}

document.getElementById("btnMic").addEventListener("click", async () => {
  if (micActive) {
    stopMic();
    setStatus(`麦克风识别已关闭｜场景：${SCENE_NAMES[sceneIdx]}`);
    return;
  }
  try {
    await startMic();
  } catch (err) {
    setStatus("麦克风不可用：" + err.message);
  }
});

musicInput.addEventListener("change", async () => {
  const file = musicInput.files[0];
  if (!file) return;
  stopMic();
  stopMetro();
  if (!audioCtx) {
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
  }
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.loop = true;
    const src = audioCtx.createMediaElementSource(audioEl);
    src.connect(analyser);
  }
  analyser.disconnect();
  analyser.connect(audioCtx.destination);
  audioEl.src = URL.createObjectURL(file);
  try {
    await audioCtx.resume();
    await audioEl.play();
    setStatus(`音乐播放中，节拍跟随｜场景：${SCENE_NAMES[sceneIdx]}`);
  } catch (err) {
    setStatus("音乐播放失败：" + err.message);
  }
});

document.getElementById("btnMetro").addEventListener("click", () => {
  if (audioEl && !audioEl.paused) audioEl.pause();
  if (metroOn) { stopMetro(); setStatus(`自动节拍已关闭｜场景：${SCENE_NAMES[sceneIdx]}`); return; }
  stopMic();
  stopMetro();
  metroOn = true;
  metroTimer = setInterval(() => emitBeat(), (60 / BPM) * 1000);
  setStatus(`自动节拍开启（${BPM} BPM）｜场景：${SCENE_NAMES[sceneIdx]}`);
});

function stopMetro() {
  metroOn = false;
  if (metroTimer) { clearInterval(metroTimer); metroTimer = null; }
}

let prevSpectrum = null;
let fluxHistory = 42;
let lastAnalysisAt = 0;
let lastBeatAt = 0;
let musicEnergy = 0;

function detectBeat() {
  if (!analyser) return;
  if (audioEl && audioEl.paused) return;
  const now = performance.now();
  if (now - lastAnalysisAt < 30) return;
  lastAnalysisAt = now;

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  let energySum = 0;
  for (let i = 1; i < data.length; i++) energySum += data[i];
  musicEnergy = musicEnergy * 0.92 + (energySum / Math.max(1, data.length - 1)) * 0.08;
  if (!prevSpectrum) {
    prevSpectrum = data;
    return;
  }

  // 频谱通量：每个频段能量突然上升的量，比单纯低频能量更接近“鼓点/重拍”。
  let flux = 0;
  for (let i = 0; i < data.length; i++) {
    const diff = data[i] - prevSpectrum[i];
    if (diff > 0) flux += diff;
  }
  fluxHistory = fluxHistory * 0.9 + flux * 0.1;
  prevSpectrum = data;

  if (flux > fluxHistory * 1.35 && flux > 42 && now - lastBeatAt > 250) {
    lastBeatAt = now;
    emitBeat();
  }
}

function emitBeat() {
  beatCount++;
  beatPulse = 1;
  burstT = 1;
  triggerBurst();
  phraseEnergySum += musicEnergy;
  phraseBeats++;
  if (beatCount % 4 === 0) {
    let next;
    if (analyser && (micActive || (audioEl && !audioEl.paused)) && phraseBeats > 0) {
      const avgEnergy = phraseEnergySum / phraseBeats;
      next = avgEnergy > 110 ? 2 : avgEnergy > 70 ? 1 : 0;
    } else {
      next = sceneIdx + 1;
    }
    phraseEnergySum = 0;
    phraseBeats = 0;
    showScene(next);
  }
}

document.getElementById("btnScene").addEventListener("click", () => {
  stopMetro();
  showScene(sceneIdx + 1);
  setStatus(`切景中…`);
});

// ============ 自动演示模式（兜底：无姿态 / 无音乐也能完整展示） ============
let demoMode = false, demoTimer = null, demoCount = 0;
function startDemo() {
  demoMode = true;
  setStatus(`自动演出进行中：粒子爆发 + 场景循环｜场景：${SCENE_NAMES[sceneIdx]}`);
  demoTimer = setInterval(() => {
    burstT = 1;
    triggerBurst();
    demoCount++;
    if (demoCount % 4 === 0) showScene(sceneIdx + 1);
  }, 3000);
}
function stopDemo() {
  demoMode = false;
  if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
  setStatus(`自动演出已关闭｜场景：${SCENE_NAMES[sceneIdx]}`);
}
document.getElementById("btnDemo").addEventListener("click", () => {
  if (demoMode) stopDemo();
  else startDemo();
});
startDemo();

let depthOcclusionMesh = null;
let depthSensingActive = false;
let depthCheckAt = 0;

function removeDepthOcclusion() {
  if (!depthOcclusionMesh) return;
  scene.remove(depthOcclusionMesh);
  depthOcclusionMesh = null;
}

function ensureDepthOcclusion() {
  if (!renderer.xr.isPresenting || depthOcclusionMesh || !renderer.xr.hasDepthSensing()) return;
  const mesh = renderer.xr.getDepthSensingMesh();
  if (!mesh) return;
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  if (mesh.material) {
    mesh.material.colorWrite = false;
    mesh.material.depthWrite = true;
    mesh.material.depthTest = true;
  }
  depthOcclusionMesh = mesh;
  scene.add(mesh);
  setStatus(`深度遮挡已启用 ✓｜场景：${SCENE_NAMES[sceneIdx]}`);
}

document.getElementById("btnEnter").addEventListener("click", async () => {
  let session = null;
  try {
    session = await navigator.xr.requestSession("immersive-ar", {
      optionalFeatures: ["local-floor", "bounded-floor", "dom-overlay", "depth-sensing"],
      depthSensing: { usagePreference: ["gpu-optimized"], dataFormatPreference: [] },
      domOverlay: { root: document.getElementById("ui") },
    });
    depthSensingActive = true;
  } catch (depthErr) {
    try {
      session = await navigator.xr.requestSession("immersive-ar", {
        optionalFeatures: ["local-floor", "bounded-floor", "dom-overlay"],
        domOverlay: { root: document.getElementById("ui") },
      });
      depthSensingActive = false;
    } catch (err) {
      setStatus("MR 模式不可用：" + err.message + "（请确认用 Pico 浏览器打开，并已授权摄像头）");
      return;
    }
  }
  try {
    await renderer.xr.setSession(session);
    controls.enabled = false;
    depthCheckAt = performance.now() + 2500;
    session.addEventListener("end", () => {
      removeDepthOcclusion();
      depthSensingActive = false;
      depthCheckAt = 0;
      controls.enabled = true;
      camera.near = 0.05;
      camera.far = 80;
      camera.updateProjectionMatrix();
    });
    setStatus(depthSensingActive ? `MR 透视已开启，深度遮挡尝试中…｜场景：${SCENE_NAMES[sceneIdx]}` : `MR 透视已开启（深度遮挡不可用）｜场景：${SCENE_NAMES[sceneIdx]}`);
  } catch (err) {
    setStatus("MR 会话启动失败：" + err.message);
  }
});

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.38, 0.45, 0.82));

const FOG_COLORS = [0x0a1420, 0x07170e, 0x150c1c, 0x0b0d18];
const FOG_DENSITY = [0.027, 0.036, 0.028, 0.024];
let lastFrameAt = performance.now();

function update(now) {
  const dt = Math.min(100, now - lastFrameAt);
  lastFrameAt = now;
  const energyBoost = Math.min(1, musicEnergy / 255);
  if (renderer.xr.isPresenting) {
    ensureDepthOcclusion();
    if (depthSensingActive && !depthOcclusionMesh && depthCheckAt > 0 && now > depthCheckAt) {
      depthCheckAt = 0;
      setStatus(`深度遮挡不可用，已回退表演区清空方案｜场景：${SCENE_NAMES[sceneIdx]}`);
    }
  }

  // 切景过渡：先压暗，换景后再亮回。
  if (transitionState === "out") {
    transitionT += dt / 460;
    transitionMat.opacity = Math.min(1, easeInOut(transitionT));
    if (transitionT >= 1) {
      applyScene(transitionNext);
      transitionState = "in";
      transitionT = 0;
    }
  } else if (transitionState === "in") {
    transitionT += dt / 720;
    transitionMat.opacity = Math.max(0, 1 - easeInOut(transitionT));
    if (transitionT >= 1) {
      transitionState = "idle";
      transitionMat.opacity = 0;
    }
  }

  if (now - lastLandmarkAt > 2000) {
    auraOpacity = Math.min(0.5, auraOpacity + 0.01);
    holoOpacity = Math.max(0, holoOpacity - 0.025);
  } else {
    auraOpacity = Math.min(0.75, auraOpacity + 0.02);
  }
  holoJointMat.opacity = holoOpacity;
  holoBoneMat.opacity = holoOpacity * 0.9;
  auraPool.position.lerp(auraTarget, 0.25);
  const pulse = (1 + burstT * (0.8 + energyBoost * 0.5)) * (1 + Math.sin(now / 500) * 0.06);
  auraPool.material.uniforms.uOpacity.value = Math.min(1, auraOpacity + energyBoost * 0.15) * 0.72;
  auraPool.material.uniforms.uTime.value = now;
  auraPool.material.uniforms.uEnergy.value = energyBoost;
  auraPool.material.uniforms.uPulse.value = Math.max(0, pulse - 1);
  auraPool.scale.setScalar(pulse);
  burstMat.size = 0.12 + energyBoost * 0.12;
  if (burstLife > 0) {
    burstLife -= 0.02;
    for (let i = 0; i < BURST_N; i++) {
      burstPos[i * 3] += burstVel[i].x * 0.02;
      burstPos[i * 3 + 1] += burstVel[i].y * 0.02;
      burstPos[i * 3 + 2] += burstVel[i].z * 0.02;
    }
    burstGeo.attributes.position.needsUpdate = true;
    burstMat.opacity = burstLife;
  } else burstMat.opacity = 0;
  spinMeshes.forEach((m) => (m.rotation.y += 0.004));

  // 整体呼吸：远景和近景都用慢周期轻微缩放，画面不僵。
  breathItems.forEach((g) => {
    if (!g.visible) return;
    const b = g.userData.breath;
    if (!b) return;
    const beatLift = g === scenesFocal[sceneIdx] ? burstT * (0.06 + energyBoost * 0.04) : 0;
    const scale = 1 + Math.sin(now / 2400 + b.phase) * b.amp + Math.sin(now / 820 + b.phase * 0.7) * b.amp * 0.35 + beatLift;
    g.scale.setScalar(scale);
  });

  // 环境环极慢漂移，制造“被环境轻轻包围”的感觉。
  scenesEnv.forEach((g) => {
    if (g.visible) g.rotation.y += dt * 0.000018;
  });

  // 植物只在原地轻轻摇，不旋转树干位置。
  swayItems.forEach((item) => {
    const cfg = item.userData.sway;
    if (!cfg) return;
    const angle = Math.sin(now * cfg.speed * 0.001 + cfg.phase) * cfg.amp;
    item.rotation[cfg.axis] = cfg.baseRot[cfg.axis] + angle;
  });

  // 漂浮光尘：萤火虫/星光/晶尘做独立缓慢游动。
  floatingDust.forEach((item) => {
    const arr = item.points.geometry.attributes.position.array;
    for (let i = 0; i < item.phases.length; i++) {
      const t = now * 0.00045 * item.speeds[i] + item.phases[i];
      arr[i * 3] = item.base[i * 3] + Math.sin(t) * 0.06;
      arr[i * 3 + 1] = item.base[i * 3 + 1] + Math.sin(t * 1.6 + item.phases[i]) * 0.08;
      arr[i * 3 + 2] = item.base[i * 3 + 2] + Math.cos(t * 0.8) * 0.06;
    }
    item.points.geometry.attributes.position.needsUpdate = true;
  });

  // 雾随场景缓慢过渡，并带轻微呼吸。
  scene.fog.color.lerp(new THREE.Color(FOG_COLORS[sceneIdx]), 0.025);
  scene.fog.density += (FOG_DENSITY[sceneIdx] + Math.sin(now / 3600) * 0.0011 - scene.fog.density) * 0.025;

  burstT = Math.max(0, burstT - 0.02);
  if (shockLife > 0) {
    shockLife -= 0.04;
    shockRing.scale.setScalar(1 + (1 - shockLife) * 2.6);
    shockRing.material.opacity = Math.max(0, shockLife * 0.85);
  } else {
    shockRing.material.opacity = 0;
  }
  beatPulse = Math.max(0, beatPulse - 0.08);
  stageRing.material.opacity = 0.45 + beatPulse * 0.55;
  stageRing.scale.setScalar(1 + beatPulse * (0.08 + energyBoost * 0.05));
  detectBeat();
}

renderer.setAnimationLoop(() => {
  const now = performance.now();
  if (!renderer.xr.isPresenting) controls.update();
  update(now);
  if (renderer.xr.isPresenting) renderer.render(scene, camera);
  else composer.render();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
