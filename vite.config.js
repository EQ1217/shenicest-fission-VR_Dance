import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

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
  server: {
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
  },
});
