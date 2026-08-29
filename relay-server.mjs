// 一键公网/局域网部署：静态页面 + 姿态中继（同一端口 4173）
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const distDir = fileURLToPath(new URL("./dist/", import.meta.url));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".ico": "image/x-icon",
};

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let path = decodeURIComponent(url.pathname);
  if (path === "/") path = "/index.html";
  const file = normalize(join(distDir, path));
  if (!file.startsWith(distDir) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: "/relay" });
wss.on("connection", (ws) => {
  console.log("姿态客户端接入，当前连接数:", wss.clients.size);
  ws.on("message", (msg) => {
    for (const c of wss.clients) {
      if (c !== ws && c.readyState === 1) c.send(msg.toString());
    }
  });
  ws.on("close", () => console.log("姿态客户端断开，当前连接数:", wss.clients.size));
});

server.listen(4173, "0.0.0.0", () => {
  console.log("综合服务已启动: http://0.0.0.0:4173 （/relay 为姿态中继）");
});
