#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy_common.sh
. "$SCRIPT_DIR/deploy_common.sh"
BACKEND_PID="$LOG_DIR/backend.pid"
FRONTEND_PID="$LOG_DIR/frontend.pid"
NOHUP_ENV="$LOG_DIR/nohup.env"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

stop_service() {
    local name="$1"
    local pid_file="$2"
    if [ -f "$pid_file" ]; then
        local pid
        pid="$(cat "$pid_file")"
        if kill -0 "$pid" >/dev/null 2>&1; then
            echo "停止 $name: $pid"
            kill "$pid"
        fi
        rm -f "$pid_file"
    fi
}

show_status() {
    for item in "backend:$BACKEND_PID" "frontend:$FRONTEND_PID"; do
        local name="${item%%:*}"
        local pid_file="${item#*:}"
        if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
            echo "$name 运行中，PID $(cat "$pid_file")"
        else
            echo "$name 未运行"
        fi
    done
}

case "${1:-start}" in
    stop)
        stop_service frontend "$FRONTEND_PID"
        stop_service backend "$BACKEND_PID"
        exit 0
        ;;
    status)
        show_status
        exit 0
        ;;
    logs)
        mkdir -p "$LOG_DIR"
        touch "$LOG_DIR/backend-nohup.log" "$LOG_DIR/frontend-nohup.log"
        tail -f "$LOG_DIR/backend-nohup.log" "$LOG_DIR/frontend-nohup.log"
        exit 0
        ;;
esac

mkdir -p "$LOG_DIR"
chown_to_project_user "$LOG_DIR"

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "错误: backend/.env 不存在。请先运行 make bootstrap，并配置 Sealos 对象存储。"
    exit 1
fi

if [ -z "${BACKEND_URL:-}" ]; then
    printf "请输入后端公网地址，例如 https://igwodoahyyxt.sealoszh.site: "
    read -r BACKEND_URL
fi

if [ -z "${FRONTEND_URL:-}" ]; then
    printf "请输入前端公网地址，例如 https://lhpwj...sealoszh.site: "
    read -r FRONTEND_URL
fi

if [ -z "$BACKEND_URL" ] || [ -z "$FRONTEND_URL" ]; then
    echo "错误: 后端公网地址和前端公网地址不能为空"
    exit 1
fi

{
    printf 'BACKEND_URL=%q\n' "${BACKEND_URL%/}"
    printf 'FRONTEND_URL=%q\n' "${FRONTEND_URL%/}"
    printf 'BACKEND_PORT=%q\n' "$BACKEND_PORT"
    printf 'FRONTEND_PORT=%q\n' "$FRONTEND_PORT"
} > "$NOHUP_ENV"
chown_to_project_user "$NOHUP_ENV"

API_BASE="${BACKEND_URL%/}"
case "$API_BASE" in
    */api) ;;
    *) API_BASE="$API_BASE/api" ;;
esac

echo "================================"
echo " 晨光打卡 - nohup 部署启动"
echo "================================"
print_runtime_context
echo "后端端口: $BACKEND_PORT"
echo "前端端口: $FRONTEND_PORT"
echo "后端公网: ${BACKEND_URL%/}"
echo "前端公网: ${FRONTEND_URL%/}"
echo "前端 API: $API_BASE"
echo ""

if [ -f "$FRONTEND_DIR/package-lock.json" ]; then
    run_project_step "[1/6] 安装前端依赖..." "$FRONTEND_DIR" "npm ci"
else
    run_project_step "[1/6] 安装前端依赖..." "$FRONTEND_DIR" "npm install"
fi
run_project_step "[2/6] 构建前端..." "$FRONTEND_DIR" "VITE_API_BASE=$(shell_quote "$API_BASE") npm run build"

run_project_step "[3/6] 同步后端依赖..." "$BACKEND_DIR" "uv sync --locked"

run_project_step "[4/6] 初始化数据库..." "$BACKEND_DIR" "uv run python scripts/seed_admin.py"

echo "[5/6] 停止旧 nohup 服务..."
stop_service frontend "$FRONTEND_PID"
stop_service backend "$BACKEND_PID"

echo "[6/6] 启动服务..."
start_project_nohup "    启动后端" "$BACKEND_DIR" "env FRONTEND_URL=$(shell_quote "${FRONTEND_URL%/}") uv run uvicorn app.main:app --host 0.0.0.0 --port $(shell_quote "$BACKEND_PORT")" "$LOG_DIR/backend-nohup.log" "$BACKEND_PID"
start_project_nohup "    启动前端" "$FRONTEND_DIR" "npx --yes serve -s dist -l $(shell_quote "tcp://0.0.0.0:$FRONTEND_PORT")" "$LOG_DIR/frontend-nohup.log" "$FRONTEND_PID"

echo ""
show_status
echo ""
echo "访问地址:"
echo "  前端: ${FRONTEND_URL%/}"
echo "  后端: ${BACKEND_URL%/}"
echo "  API 文档: ${BACKEND_URL%/}/docs"
echo ""
echo "日志:"
echo "  make nohup-logs"
