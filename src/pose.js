import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

// 与 MR 观演端连接（同源中继：本地或公网隧道均可）
let ws;
let relayReconnectTimer = null;

function connectRelay() {
  ws = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/relay`
  );
  ws.onopen = () => (statusEl.textContent = "已连接中继 ✓ 开始跳舞吧");
  ws.onclose = () => {
    statusEl.textContent = "中继断开，1.5 秒后重连…";
    if (relayReconnectTimer) clearTimeout(relayReconnectTimer);
    relayReconnectTimer = setTimeout(connectRelay, 1500);
  };
}
connectRelay();

const fileset = await FilesetResolver.forVisionTasks("/wasm");
let pose;
try {
  pose = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/pose_landmarker_lite.task", delegate: "GPU" },
    runningMode: "VIDEO",
  });
} catch {
  try {
    pose = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/pose_landmarker_lite.task", delegate: "CPU" },
      runningMode: "VIDEO",
    });
  } catch {
    statusEl.textContent = "姿态模型加载失败，请刷新重试";
  }
}

if (pose) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
  });
  video.srcObject = stream;
  await video.play();

  let last = 0;
  function tick(now) {
    if (now - last > 50) {
      last = now;
      const res = pose.detectForVideo(video, now);
      ctx.clearRect(0, 0, 640, 480);
      ctx.drawImage(video, 0, 0, 640, 480);
      if (res.landmarks[0]) {
        new DrawingUtils(ctx).drawLandmarks(res.landmarks[0]);
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "landmarks", t: now, lm: res.landmarks[0] }));
        }
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
