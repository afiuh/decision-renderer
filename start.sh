#!/usr/bin/env bash
# 决策网络渲染器启动器：服务没跑就启动，然后打开浏览器
set -e
DIR="/mnt/data/AI自由工作区/decision-renderer"
PORT="${DR_PORT:-7341}"
URL="http://127.0.0.1:${PORT}/"

alive() { curl -sf "http://127.0.0.1:${PORT}/api/projects" >/dev/null 2>&1; }

if ! alive; then
  cd "$DIR"
  if [ ! -d packages/client/dist ]; then
    npm run build >/tmp/decision-renderer-build.log 2>&1 || true
  fi
  cd "$DIR/packages/server"
  nohup "$DIR/node_modules/.bin/tsx" src/index.ts >/tmp/decision-renderer.log 2>&1 &
  for _ in $(seq 1 40); do
    alive && break
    sleep 0.25
  done
fi

xdg-open "$URL" >/dev/null 2>&1 &
