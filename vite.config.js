import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vite";

// 本地开发才需要 HTTPS 证书；云端构建（Vercel 等）没有 key.pem/cert.pem，跳过 server 配置
const hasLocalCert = existsSync("key.pem") && existsSync("cert.pem");

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        mr: "mr.html",
        pose: "pose.html",
      },
    },
  },
  server: hasLocalCert ? {
    host: true,
    https: {
      key: readFileSync("key.pem"),
      cert: readFileSync("cert.pem"),
    },
    proxy: {
      // 把 /relay 的 WebSocket 转发到姿态中继，页面和中继同源
      "/relay": {
        target: "ws://127.0.0.1:8787",
        ws: true,
      },
    },
  } : {},
});
