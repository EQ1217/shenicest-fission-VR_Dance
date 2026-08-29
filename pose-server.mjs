import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

// 明文 HTTP：只在本机回环（127.0.0.1）使用，由 Vite 的 HTTPS 对外，
// 所以这里不需要加密，避免代理握手问题。
const server = createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("客户端接入，当前连接数:", wss.clients.size);
  ws.on("message", (msg) => {
    for (const c of wss.clients) {
      if (c !== ws && c.readyState === 1) c.send(msg.toString());
    }
  });
  ws.on("close", () => console.log("客户端断开，当前连接数:", wss.clients.size));
});

server.listen(8787, "127.0.0.1", () => {
  console.log("姿态中继已启动: ws://127.0.0.1:8787");
});
