#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "================================"
echo " 更新并重启服务"
echo "================================"
echo ""

if [ -z "$BACKEND_URL" ]; then
    echo "错误: 未设置 BACKEND_URL 环境变量"
    echo "用法: make update BACKEND_URL=http://api.example.com"
    exit 1
fi

API_BASE="${BACKEND_URL%/}"
if [ "$API_BASE" = "http://localhost" ] || [ "$API_BASE" = "http://127.0.0.1" ]; then
    API_BASE="$API_BASE:8000"
fi
case "$API_BASE" in
    */api) ;;
    *) API_BASE="$API_BASE/api" ;;
esac

echo "[1/4] 拉取最新代码..."
git pull origin main

echo "[2/4] 构建前端..."
cd frontend
npm install
VITE_API_BASE="$API_BASE" npm run build
cd ..

echo "[3/4] 更新后端依赖..."
cd backend
uv sync
cd ..

echo "[4/4] 重启服务..."
pm2 restart ecosystem.config.js

echo ""
echo "更新完成"
pm2 status
