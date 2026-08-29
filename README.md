# VR 沉浸式舞蹈观演 Demo

观众佩戴 Pico 4 Ultra，通过 MR 透视看到真实舞者，并在同一空间叠加实时 3D 场景和特效。电脑摄像头识别舞者姿态，音乐/麦克风识别节拍，共同驱动特效和场景切换。

线上观演端（Vercel）：https://web-ashen-five-28.vercel.app/mr.html

## 线上部署（Vercel + GitHub 联动）

- 仓库 main 分支推送后自动触发 Vercel 构建部署。
- 观演端为纯静态页面，自动演示模式默认开启（无姿态数据时粒子爆发 + 场景循环）。
- 姿态中继（WebSocket）不适用于 Vercel Serverless，实时联动需自建 Node 服务运行 `node relay-server.mjs`。

## 环境要求

- Node.js 18+
- npm
- Pico 4 Ultra，浏览器支持 WebXR immersive-ar
- 电脑与 Pico 在同一局域网

## 一键启动

在 macOS 上双击或运行：

```bash
./start-lan.command
```

它会启动两个服务：

- 姿态中继：`ws://127.0.0.1:8787`
- Vite HTTPS 网页服务：`https://<电脑IP>:5173`

启动后按提示打开：

- 电脑：`https://<电脑IP>:5173/pose.html`
- Pico：`https://<电脑IP>:5173/mr.html`

## 手动启动

```bash
cd /Users/bytedance/vr-dance-demo
npm install
node pose-server.mjs
npm run dev -- --host
```

## 演示流程

1. 电脑浏览器打开 `pose.html`，允许摄像头，把摄像头对准舞者。
2. Pico 浏览器打开 `mr.html`，接受自签名证书。
3. Pico 点「进入 MR 模式」，看向真实舞台上的舞者。
4. 选择音乐来源：
   - 「加载音乐」：上传本地音乐文件。
   - 「麦克风识别」：用电脑麦克风听现场音乐。
   - 「自动节拍」：无音频时用固定 108 BPM 兜底。
5. 舞者开始跳舞，Pico 中会叠加全息骨架、光晕、粒子和光环，音乐重拍触发切景。

## 已实现功能

- 电脑摄像头 MediaPipe 33 关键点识别，GPU 失败自动降级 CPU。
- WebSocket 局域网中继。
- Pico MR 透视 + Three.js 实时渲染。
- 进入 MR 后保留底部控制按钮（WebXR DOM Overlay），头显内可直接切景和切音乐模式。
- 舞者全息骨架、脚下光晕、粒子爆发、手势光环。
- 双手张开触发青色光环，手举过头触发暖色光环。
- 音乐文件 / 麦克风实时节拍识别。
- 音乐能量驱动特效强度。
- 每 4 拍音乐叙事式切景，切景柔光过渡。
- 星空石阵、雨林、能量晶簇、霓虹都市四套场景。
- 霓虹都市使用 Kenney CC0 城市模型与 Poly Haven CC0 城市 HDRI 环境反射，降低“塑料感”。

## 注意事项

- 电脑摄像头和 Pico 是两套视角，特效是近似对齐，不是像素级贴合。
- 电脑摄像头尽量放在观众附近，正对舞者，降低错位感。
- 使用麦克风识别时，电脑麦克风别离音箱太近，避免啸叫。
- Pico 打不开页面时，确认和电脑连同一 Wi-Fi，或改用 Mac 热点共享。
