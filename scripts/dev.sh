#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy_common.sh
. "$SCRIPT_DIR/deploy_common.sh"

cleanup() {
    if [ -n "${BACKEND_PID:-}" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "${FRONTEND_PID:-}" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "错误: backend/.env 不存在"
    echo "请先准备 backend/.env"
    exit 1
fi

echo "================================"
echo " 晨光打卡 - 本地开发启动"
echo "================================"
echo ""

echo "[1/4] 同步后端依赖..."
run_project_step "    uv sync" "$BACKEND_DIR" "uv sync"

echo "[2/4] 初始化数据库和管理员..."
run_project_step "    seed_admin" "$BACKEND_DIR" "uv run python scripts/seed_admin.py"

echo "[3/4] 安装前端依赖..."
if [ -f "$FRONTEND_DIR/package-lock.json" ]; then
    run_project_step "    npm ci" "$FRONTEND_DIR" "npm ci"
else
    run_project_step "    npm install" "$FRONTEND_DIR" "npm install"
fi

echo "[4/4] 启动服务..."
mkdir -p "$PROJECT_DIR/logs"
cd "$BACKEND_DIR"
FRONTEND_URL=http://localhost:5173 uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cd "$FRONTEND_DIR"
VITE_API_BASE=http://localhost:8000/api npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "后端: http://localhost:8000"
echo "API 文档: http://localhost:8000/docs"
echo "前端: http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止前后端"

wait "$BACKEND_PID" "$FRONTEND_PID"
