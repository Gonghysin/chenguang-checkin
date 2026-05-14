#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy_common.sh
. "$SCRIPT_DIR/deploy_common.sh"
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

echo "[1/5] 拉取最新代码..."
git pull origin main

if [ -f "$FRONTEND_DIR/package-lock.json" ]; then
    run_project_step "[2/5] 安装前端依赖..." "$FRONTEND_DIR" "npm ci"
else
    run_project_step "[2/5] 安装前端依赖..." "$FRONTEND_DIR" "npm install"
fi
run_project_step "[3/5] 构建前端..." "$FRONTEND_DIR" "VITE_API_BASE=$(shell_quote "$API_BASE") npm run build"

run_project_step "[4/5] 更新后端依赖..." "$BACKEND_DIR" "uv sync"

echo "[5/5] 重启服务..."
run_pm2 restart ecosystem.config.js

echo ""
echo "更新完成"
run_pm2 status
