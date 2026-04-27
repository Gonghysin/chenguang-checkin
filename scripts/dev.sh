#!/bin/bash
set -e

if ! command -v uv >/dev/null 2>&1 && [ -f "$HOME/.local/bin/env" ]; then
    . "$HOME/.local/bin/env"
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

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
cd "$BACKEND_DIR"
uv sync

echo "[2/4] 初始化数据库和管理员..."
uv run python scripts/seed_admin.py

echo "[3/4] 安装前端依赖..."
cd "$FRONTEND_DIR"
npm install

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
