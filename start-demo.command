#!/bin/bash
# VR 舞蹈 demo 一键启动：本地服务 + 公网隧道
cd "$(dirname "$0")"

echo "① 启动本地服务（端口 4173）..."
node relay-server.mjs > /tmp/relay.log 2>&1 &
RELAY_PID=$!
trap 'echo ""; echo "已停止（关闭本地服务）"; kill $RELAY_PID 2>/dev/null' EXIT
sleep 1

echo "② 建立公网隧道，正在连接..."
echo "   看到 https://xxx.trycloudflare.com 就是你的公网地址，请勿关闭本窗口"
echo ""
./tools/cloudflared tunnel --url http://localhost:4173 --no-autoupdate
