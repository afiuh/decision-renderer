#!/usr/bin/env bash
# 一键启动：server（7341）+ client（7340）
set -e
cd "$(dirname "$0")"
echo "启动 decision-renderer..."
npm run dev
