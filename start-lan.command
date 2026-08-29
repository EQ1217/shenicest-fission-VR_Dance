#!/bin/bash
# VR 舞蹈 demo 局域网一键启动：姿态中继 + 网页服务
cd "$(dirname "$0")"

# 优先取 Mac 热点桥接（共享网络），否则取主网卡，避免 IP 写死导致 Pico 打不开
LAN_IP=$(ipconfig getifaddr bridge100 2>/dev/null || ipconfig getifaddr en0 2>/dev/null)
if [ -z "$LAN_IP" ]; then LAN_IP=192.168.2.1; fi

echo "① 启动姿态中继..."
node pose-server.mjs > /tmp/pose-server.log 2>&1 &
RELAY_PID=$!
trap 'echo ""; echo "已停止（关闭姿态中继）"; kill $RELAY_PID 2>/dev/null' EXIT
sleep 1

echo "② 启动网页服务（HTTPS）..."
echo "   本机局域网 IP：$LAN_IP"
echo "   Pico 打开 https://$LAN_IP:5173/mr.html"
echo "   电脑打开 https://$LAN_IP:5173/pose.html"
echo "   若 Pico 打不开：确认 Pico 与本机连同一热点/同一 Wi-Fi；"
echo "   路由器 AP 隔离时改用 Mac 热点共享（此时 IP 会显示为 192.168.2.1）。"
echo "   按 Ctrl+C 停止"
echo ""
npm run dev
