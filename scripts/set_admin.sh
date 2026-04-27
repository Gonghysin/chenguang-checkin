#!/bin/bash
set -e

if ! command -v uv >/dev/null 2>&1 && [ -f "$HOME/.local/bin/env" ]; then
    . "$HOME/.local/bin/env"
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

printf "管理员用户名: "
read -r ADMIN_USERNAME_INPUT

if [ -z "$ADMIN_USERNAME_INPUT" ]; then
    echo "错误: 用户名不能为空"
    exit 1
fi

printf "管理员密码: "
stty -echo
read -r ADMIN_PASSWORD_INPUT
stty echo
printf "\n"

if [ -z "$ADMIN_PASSWORD_INPUT" ]; then
    echo "错误: 密码不能为空"
    exit 1
fi

cd "$BACKEND_DIR"
ADMIN_USERNAME="$ADMIN_USERNAME_INPUT" ADMIN_PASSWORD="$ADMIN_PASSWORD_INPUT" uv run python scripts/seed_admin.py
echo "管理员账号已写入数据库"
