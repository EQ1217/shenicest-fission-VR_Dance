import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import * as THREE from "three";

// ============ DOM ============
const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");
const renderBox = document.getElementById("renderBox");
const statusEl = document.getElementById("status");
const musicInput = document.getElementById("musicFile");
const btnMusic = document.getElementById("btnMusic");
const btnMetro = document.getElementById("btnMetro");
const btnScene = document.getElementById("btnScene");

const setStatus = (s) => (statusEl.textContent = s);

// ============ 1. MediaPipe 姿态识别 ============
const fileset = await FilesetResolver.forVisionTasks("/wasm");
const pose = await PoseLandmarker.createFromOptions(fileset, {
  baseOptions: { modelAssetPath: "/pose_landmarker_lite.task", delegate: "GPU" },
  runningMode: "VIDEO",
});
setStatus("模型就绪，等待摄像头…");

// ============ 2. 摄像头 ============
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: 640, height: 480 },
});
video.srcObject = stream;
video.width = 640;
video.height = 480;
await video.play();
setStatus("摄像头已开启 ✓ 试试按 1/2/3 切景");

// ============ 3. Three.js 渲染 ============
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(640, 480);
renderBox.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 640 / 480, 0.1, 20);
camera.position.set(0, 0, 2.2);
camera.lookAt(0, 0, 0);

// 33 个关键点小球
const spheres = [];
for (let i = 0; i < 33; i++) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 10, 10),
    new THREE.MeshBasicMaterial()
  );
  scene.add(mesh);
  spheres.push(mesh);
}

// 光带连线（骨架）
const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];
const boneLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 })
);
scene.add(boneLine);

// ============ 3.5 场景环境元素 ============
// 星空粒子
const starGeo = new THREE.BufferGeometry();
const STAR_COUNT = 600;
const starPos = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  starPos[i * 3] = (Math.random() - 0.5) * 10;
  starPos[i * 3 + 1] = (Math.random() - 0.5) * 6;
  starPos[i * 3 + 2] = -2 - Math.random() * 6;
}
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.035,
  transparent: true,
  opacity: 0.9,
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// 漂浮环境光点
const envGeo = new THREE.BufferGeometry();
const ENV_COUNT = 400;
const envPos = new Float32Array(ENV_COUNT * 3);
for (let i = 0; i < ENV_COUNT; i++) {
  envPos[i * 3] = (Math.random() - 0.5) * 5;
  envPos[i * 3 + 1] = (Math.random() - 0.5) * 4;
  envPos[i * 3 + 2] = (Math.random() - 0.5) * 4;
}
envGeo.setAttribute("position", new THREE.BufferAttribute(envPos, 3));
const envMat = new THREE.PointsMaterial({
  color: 0x6fd8ff,
  size: 0.05,
  transparent: true,
  opacity: 0.55,
});
const envPoints = new THREE.Points(envGeo, envMat);
scene.add(envPoints);

// 地面（氛围色平面）
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.18 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.1;
scene.add(floor);

// ============ 4. 场景状态机 ============
const SCENES = [
  {
    name: "星空", bg: 0x050518, sphere: 0x6fd8ff, line: 0x9adcff,
    star: 0xdff3ff, env: 0x6fd8ff, floor: 0x274060, envOpacity: 0.55,
  },
  {
    name: "雨林", bg: 0x04140a, sphere: 0x5dff9b, line: 0x8dffb8,
    star: 0xa8ffc8, env: 0x63e69a, floor: 0x0e3a1e, envOpacity: 0.75,
  },
  {
    name: "能量", bg: 0x1a0406, sphere: 0xff6a3d, line: 0xffa07a,
    star: 0xffd0a8, env: 0xff6a3d, floor: 0x4a1010, envOpacity: 0.9,
  },
];
let sceneIdx = 0;
let beatCount = 0;

const curColor = {
  bg: new THREE.Color(SCENES[0].bg),
  sphere: new THREE.Color(SCENES[0].sphere),
  line: new THREE.Color(SCENES[0].line),
  star: new THREE.Color(SCENES[0].star),
  env: new THREE.Color(SCENES[0].env),
  floor: new THREE.Color(SCENES[0].floor),
};
const targetColor = {
  bg: new THREE.Color(SCENES[0].bg),
  sphere: new THREE.Color(SCENES[0].sphere),
  line: new THREE.Color(SCENES[0].line),
  star: new THREE.Color(SCENES[0].star),
  env: new THREE.Color(SCENES[0].env),
  floor: new THREE.Color(SCENES[0].floor),
};
let curEnvOpacity = SCENES[0].envOpacity;
let targetEnvOpacity = SCENES[0].envOpacity;

function switchScene(next) {
  sceneIdx = ((next % SCENES.length) + SCENES.length) % SCENES.length;
  const s = SCENES[sceneIdx];
  targetColor.bg.set(s.bg);
  targetColor.sphere.set(s.sphere);
  targetColor.line.set(s.line);
  targetColor.star.set(s.star);
  targetColor.env.set(s.env);
  targetColor.floor.set(s.floor);
  targetEnvOpacity = s.envOpacity;
  setStatus(`当前场景：${s.name}｜节拍数：${beatCount}`);
}

// ============ 5. 音频：节拍检测 + 自动节拍 ============
let audioCtx = null;
let analyser = null;
let audioEl = null;
let metroTimer = null;
let metroOn = false;
const BPM = 108;

btnMusic.addEventListener("click", async () => {
  const file = musicInput.files[0];
  if (!file) {
    setStatus("请先在上方选择音乐文件");
    return;
  }
  stopMetro();
  if (!audioCtx) {
    audioCtx = new AudioContext();
    audioEl = new Audio();
    audioEl.loop = true;
    const src = audioCtx.createMediaElementSource(audioEl);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
  }
  audioEl.src = URL.createObjectURL(file);
  await audioCtx.resume();
  await audioEl.play();
  setStatus(`音乐播放中：节拍检测开启（当前场景：${SCENES[sceneIdx].name}）`);
});

btnMetro.addEventListener("click", () => {
  if (audioEl && !audioEl.paused) audioEl.pause();
  if (metroOn) {
    stopMetro();
    setStatus("自动节拍已关闭");
    return;
  }
  stopMetro();
  metroOn = true;
  const interval = (60 / BPM) * 1000;
  metroTimer = setInterval(() => emitBeat("自动节拍"), interval);
  setStatus(`自动节拍开启（${BPM} BPM）｜当前场景：${SCENES[sceneIdx].name}`);
});

function stopMetro() {
  metroOn = false;
  if (metroTimer) {
    clearInterval(metroTimer);
    metroTimer = null;
  }
}

// 自适应阈值节拍检测（低频段=鼓点）
let beatEnergy = 0;
let lastBeatAt = 0;
function detectBeat() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  let low = 0;
  for (let i = 1; i < 12; i++) low += data[i];
  beatEnergy = beatEnergy * 0.9 + low * 0.1;
  const now = performance.now();
  if (low > beatEnergy * 1.25 && low > 420 && now - lastBeatAt > 280) {
    lastBeatAt = now;
    emitBeat("音乐强拍");
  }
}

// ============ 6. 节拍事件 → 效果 ============
let burstT = 0;

function emitBeat(source) {
  beatCount++;
  burstT = 1;
  if (beatCount % 4 === 0) {
    switchScene(sceneIdx + 1); // 每 4 拍自动切景
  }
}

// ============ 7. 动作检测：快速挥手 ============
let lastWrist = null;
function checkAction(landmarks) {
  const w = landmarks[15]; // 左手腕
  const wx = (w.x - 0.5) * 2;
  const wy = (0.5 - w.y) * 2;
  if (lastWrist) {
    const d = Math.hypot(wx - lastWrist.x, wy - lastWrist.y);
    if (d > 0.18) burstT = 1; // 手速快 → 粒子爆发
  }
  lastWrist = { x: wx, y: wy };
}

// ============ 8. 键盘 / 按钮切景 ============
window.addEventListener("keydown", (e) => {
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 3) switchScene(n - 1);
});
btnScene.addEventListener("click", () => switchScene(sceneIdx + 1));

// ============ 9. 主循环 ============
const targets = new Array(33).fill(null).map(() => new THREE.Vector3());
let lastDetect = 0;

function tick(now) {
  // 每 ~50ms 做一次识别（约 20fps）
  if (now - lastDetect > 50) {
    lastDetect = now;
    const res = pose.detectForVideo(video, now);
    ctx.clearRect(0, 0, 640, 480);
    ctx.drawImage(video, 0, 0, 640, 480);
    if (res.landmarks[0]) {
      const lm = res.landmarks[0];
      new DrawingUtils(ctx).drawLandmarks(lm);
      lm.forEach((p, i) => {
        targets[i].set((p.x - 0.5) * 2, (0.5 - p.y) * 2, -p.z);
      });
      checkAction(lm);
    }
    detectBeat();
  }

  // 平滑跟随
  spheres.forEach((mesh, i) => {
    mesh.position.lerp(targets[i], 0.35);
    mesh.scale.setScalar(1 + burstT * 1.6);
  });

  // 光带连线
  const pts = BONES.map(([a, b]) =>
    new THREE.Vector3().copy(spheres[a].position).lerp(spheres[b].position, 0.5)
  );
  boneLine.geometry.setFromPoints(pts);

  // 场景颜色渐变过渡
  curColor.bg.lerp(targetColor.bg, 0.06);
  curColor.sphere.lerp(targetColor.sphere, 0.06);
  curColor.line.lerp(targetColor.line, 0.06);
  curColor.star.lerp(targetColor.star, 0.06);
  curColor.env.lerp(targetColor.env, 0.06);
  curColor.floor.lerp(targetColor.floor, 0.06);
  curEnvOpacity += (targetEnvOpacity - curEnvOpacity) * 0.06;
  scene.background = curColor.bg;
  spheres.forEach((m) => m.material.color.copy(curColor.sphere));
  boneLine.material.color.copy(curColor.line);
  starMat.color.copy(curColor.star);
  envMat.color.copy(curColor.env);
  envMat.opacity = curEnvOpacity;
  floor.material.color.copy(curColor.floor);

  // 环境元素缓慢旋转，增加"活着"的感觉
  stars.rotation.y += 0.0004;
  envPoints.rotation.y += 0.0008;

  burstT = Math.max(0, burstT - 0.03);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
