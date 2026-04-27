#!/bin/bash
set -e

if ! command -v uv >/dev/null 2>&1 && [ -f "$HOME/.local/bin/env" ]; then
    . "$HOME/.local/bin/env"
fi

# 晨光打卡 - Ubuntu 24 一键环境部署脚本
# 用法: ./scripts/deploy.sh

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "================================"
echo " 晨光打卡 - 环境部署脚本"
echo "================================"
echo ""

echo "[1/5] 安装基础环境..."
bash "$PROJECT_DIR/scripts/bootstrap_ubuntu.sh"

echo "[2/5] 确认后端 Python 依赖..."
cd "$BACKEND_DIR"
uv sync

echo "[3/5] 确认前端 Node 依赖..."
cd "$FRONTEND_DIR"
npm install

echo "[4/5] 检查后端配置..."
cd "$BACKEND_DIR"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo ""
    echo "=========================================="
    echo " 警告: .env 文件已自动创建"
    echo " 请运行 make configure-oss，填入真实的 Sealos 对象存储配置"
    echo "=========================================="
    echo ""
fi

echo "[5/5] 初始化数据库和管理员账号..."
cd "$BACKEND_DIR"
uv run python scripts/seed_admin.py

echo ""
echo "================================"
echo " 环境部署完成"
echo "================================"
echo ""
echo "一键启动:"
echo "  make start BACKEND_URL=http://api.example.com"
echo ""
echo "管理员账号不会写入代码。如需设置，运行: make set-admin"
echo ""
