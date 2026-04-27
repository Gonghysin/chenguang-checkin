#!/bin/bash
set -e

if ! command -v uv >/dev/null 2>&1 && [ -f "$HOME/.local/bin/env" ]; then
    . "$HOME/.local/bin/env"
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
NOHUP_ENV="$LOG_DIR/nohup.env"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"

cd "$PROJECT_DIR"

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
    if git remote get-url public-origin >/dev/null 2>&1; then
        REMOTE="public-origin"
    else
        echo "错误: 找不到 Git remote: $REMOTE"
        exit 1
    fi
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "错误: 当前工作区存在未提交的跟踪文件改动，已停止更新。"
    echo "请先提交、暂存或丢弃这些改动后再运行 make rolling-update。"
    exit 1
fi

if [ -f "$NOHUP_ENV" ]; then
    # shellcheck disable=SC1090
    . "$NOHUP_ENV"
fi

if [ -z "${BACKEND_URL:-}" ] || [ -z "${FRONTEND_URL:-}" ]; then
    echo "错误: 未找到上次 nohup 部署的公网地址。"
    echo "请先运行一次 make nohup，或这样传入地址:"
    echo "  BACKEND_URL=https://api.example.com FRONTEND_URL=https://app.example.com make rolling-update"
    exit 1
fi

echo "================================"
echo " 晨光打卡 - 滚动更新"
echo "================================"
echo "remote: $REMOTE"
echo "branch: $BRANCH"
echo "后端公网: ${BACKEND_URL%/}"
echo "前端公网: ${FRONTEND_URL%/}"
echo ""

echo "[1/2] 拉取远程代码..."
git pull --ff-only "$REMOTE" "$BRANCH"

echo "[2/2] 重新构建并重启 nohup 服务..."
BACKEND_URL="${BACKEND_URL%/}" FRONTEND_URL="${FRONTEND_URL%/}" BACKEND_PORT="${BACKEND_PORT:-8000}" FRONTEND_PORT="${FRONTEND_PORT:-5173}" bash "$PROJECT_DIR/scripts/nohup_start.sh"

echo ""
echo "滚动更新完成。"
