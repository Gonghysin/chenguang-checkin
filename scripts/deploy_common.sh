#!/bin/bash

COMMON_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$COMMON_SCRIPT_DIR/.." && pwd)}"
BACKEND_DIR="${BACKEND_DIR:-$PROJECT_DIR/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-$PROJECT_DIR/frontend}"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"

UV_DEFAULT_INDEX="${UV_DEFAULT_INDEX:-https://pypi.tuna.tsinghua.edu.cn/simple}"
UV_INDEX_URL="${UV_INDEX_URL:-$UV_DEFAULT_INDEX}"
NPM_CONFIG_REGISTRY="${NPM_CONFIG_REGISTRY:-https://registry.npmmirror.com}"

project_owner() {
    stat -c "%U" "$PROJECT_DIR" 2>/dev/null || stat -f "%Su" "$PROJECT_DIR"
}

PROJECT_RUN_USER="${PROJECT_RUN_USER:-$(project_owner)}"
if [ -z "$PROJECT_RUN_USER" ]; then
    PROJECT_RUN_USER="$(id -un)"
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
fi

shell_quote() {
    printf "%q" "$1"
}

ensure_log_dir() {
    mkdir -p "$LOG_DIR"
    if [ "$(id -u)" -eq 0 ] && [ "$PROJECT_RUN_USER" != "root" ] && command -v chown >/dev/null 2>&1; then
        chown "$PROJECT_RUN_USER":"$(id -gn "$PROJECT_RUN_USER")" "$LOG_DIR" 2>/dev/null || true
    fi
}

chown_to_project_user() {
    if [ "$(id -u)" -eq 0 ] && [ "$PROJECT_RUN_USER" != "root" ] && command -v chown >/dev/null 2>&1; then
        chown "$PROJECT_RUN_USER":"$(id -gn "$PROJECT_RUN_USER")" "$@" 2>/dev/null || true
    fi
}

project_shell() {
    local workdir="$1"
    local command="$2"
    local quoted_dir
    local prelude

    quoted_dir="$(shell_quote "$workdir")"
    prelude='export PATH="$HOME/.local/bin:$PATH"; if ! command -v uv >/dev/null 2>&1 && [ -f "$HOME/.local/bin/env" ]; then . "$HOME/.local/bin/env"; fi; export UV_DEFAULT_INDEX="${UV_DEFAULT_INDEX:-https://pypi.tuna.tsinghua.edu.cn/simple}"; export UV_INDEX_URL="${UV_INDEX_URL:-$UV_DEFAULT_INDEX}"; export NPM_CONFIG_REGISTRY="${NPM_CONFIG_REGISTRY:-https://registry.npmmirror.com}";'

    if [ "$(id -u)" -eq 0 ] && [ "$PROJECT_RUN_USER" != "root" ] && command -v sudo >/dev/null 2>&1; then
        sudo -H -u "$PROJECT_RUN_USER" env \
            UV_DEFAULT_INDEX="$UV_DEFAULT_INDEX" \
            UV_INDEX_URL="$UV_INDEX_URL" \
            NPM_CONFIG_REGISTRY="$NPM_CONFIG_REGISTRY" \
            bash -lc "$prelude cd $quoted_dir && $command"
    else
        env \
            UV_DEFAULT_INDEX="$UV_DEFAULT_INDEX" \
            UV_INDEX_URL="$UV_INDEX_URL" \
            NPM_CONFIG_REGISTRY="$NPM_CONFIG_REGISTRY" \
            bash -lc "$prelude cd $quoted_dir && $command"
    fi
}

project_command_exists() {
    project_shell "$PROJECT_DIR" "command -v $(shell_quote "$1") >/dev/null 2>&1"
}

run_pm2() {
    project_shell "$PROJECT_DIR" "pm2 $*"
}

run_project_step() {
    local label="$1"
    local workdir="$2"
    local command="$3"
    local log_file
    local pid
    local status
    local spinner='|/-\'
    local i=0

    ensure_log_dir
    log_file="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S)-$$.log"

    echo "$label"
    echo "    用户: $PROJECT_RUN_USER"
    echo "    目录: $workdir"
    echo "    日志: $log_file"

    set +e
    project_shell "$workdir" "$command" >"$log_file" 2>&1 &
    pid=$!
    while kill -0 "$pid" >/dev/null 2>&1; do
        printf "\r    运行中 %s" "${spinner:i++%${#spinner}:1}"
        sleep 1
    done
    wait "$pid"
    status=$?
    set -e

    if [ "$status" -ne 0 ]; then
        printf "\r    失败，最近日志如下:\n"
        tail -n 80 "$log_file" || true
        exit "$status"
    fi

    printf "\r    完成\n"
}

start_project_nohup() {
    local label="$1"
    local workdir="$2"
    local command="$3"
    local log_file="$4"
    local pid_file="$5"
    local quoted_log
    local quoted_pid

    ensure_log_dir
    : > "$log_file"
    : > "$pid_file"
    chown_to_project_user "$log_file" "$pid_file"
    quoted_log="$(shell_quote "$log_file")"
    quoted_pid="$(shell_quote "$pid_file")"

    echo "$label"
    project_shell "$workdir" "nohup $command > $quoted_log 2>&1 & echo \$! > $quoted_pid"
}

print_runtime_context() {
    echo "项目目录: $PROJECT_DIR"
    echo "执行用户: $(id -un)"
    echo "项目用户: $PROJECT_RUN_USER"
    echo "uv 镜像: $UV_DEFAULT_INDEX"
    echo "npm 镜像: $NPM_CONFIG_REGISTRY"
    if [ "$(id -u)" -eq 0 ] && [ "$PROJECT_RUN_USER" != "root" ]; then
        echo "提示: 当前是 root，项目命令会切回 $PROJECT_RUN_USER 执行。"
    fi
}
