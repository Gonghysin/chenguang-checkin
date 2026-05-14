#!/bin/bash
set -e

# 晨光打卡 - Ubuntu 24 一键环境部署脚本
# 用法: ./scripts/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy_common.sh
. "$SCRIPT_DIR/deploy_common.sh"

echo "================================"
echo " 晨光打卡 - 环境部署脚本"
echo "================================"
echo ""
print_runtime_context
echo ""

echo "[1/4] 安装基础环境..."
bash "$PROJECT_DIR/scripts/bootstrap_ubuntu.sh"

echo "[2/4] 检查后端配置..."
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
chown_to_project_user "$BACKEND_DIR/.env"

run_project_step "[3/4] 初始化数据库和管理员账号..." "$BACKEND_DIR" "uv run python scripts/seed_admin.py"

echo "[4/4] 部署环境检查完成。"

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
