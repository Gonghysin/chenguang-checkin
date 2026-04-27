#!/bin/bash
set -e

# 晨光打卡 - 公网服务启动脚本
# 用法: BACKEND_URL=http://api.example.com ./scripts/start.sh

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "================================"
echo " 晨光打卡 - 公网部署启动"
echo "================================"
echo ""

if [ -z "$BACKEND_URL" ]; then
    echo "错误: 未设置 BACKEND_URL 环境变量"
    echo ""
    echo "用法示例:"
    echo "  make start BACKEND_URL=http://api.example.com"
    echo ""
    echo "说明:"
    echo "  BACKEND_URL 是你的后端域名（公网可访问）"
    echo "  前端域名映射到 5174 端口"
    echo "  后端域名映射到 8000 端口"
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

if [ ! -f backend/.env ]; then
    echo "错误: backend/.env 不存在"
    echo "请先复制 .env.example 并填入 COS 密钥等配置"
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    echo "[1/6] 安装 pm2 进程管理器..."
    if ! command -v npm &> /dev/null; then
        echo "错误: npm 未安装，请先运行 make setup 配置环境"
        exit 1
    fi
    sudo npm install -g pm2
fi

if ! pm2 list | grep -q "pm2-logrotate"; then
    echo "[2/6] 安装 pm2-logrotate 日志轮转..."
    if pm2 install pm2-logrotate; then
        pm2 set pm2-logrotate:max_size 100M
        pm2 set pm2-logrotate:retain 10
    else
        echo "警告: pm2-logrotate 安装失败，跳过日志轮转配置，不影响服务启动"
        echo "如需修复 npm 缓存权限，可执行: sudo chown -R $(id -u):$(id -g) \"$HOME/.npm\""
    fi
fi

echo "[3/6] 构建前端（生产环境）..."
cd frontend
npm install
VITE_API_BASE="$API_BASE" npm run build
cd ..

echo "[4/6] 检查后端依赖..."
cd backend
uv sync
cd ..

echo "[5/6] 初始化数据库..."
cd backend
uv run python scripts/seed_admin.py
cd ..

mkdir -p logs

echo "[6/6] 启动服务..."
pm2 start ecosystem.config.js

echo ""
echo "================================"
echo " 部署完成"
echo "================================"
echo ""
pm2 status
echo ""
echo "访问地址:"
echo "  前端: http://<前端域名>:5174"
echo "  后端: http://<后端域名>:8000"
echo "  API 文档: http://<后端域名>:8000/docs"
echo ""
echo "运维命令:"
echo "  make status   查看服务状态"
echo "  make logs     实时查看日志"
echo "  make stop     停止服务"
echo "  make restart  重启服务"
echo "  make update BACKEND_URL=http://api.example.com"
echo ""
