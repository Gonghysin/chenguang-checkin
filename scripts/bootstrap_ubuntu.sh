#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
SUDO=""

if [ "$(id -u)" -ne 0 ]; then
    SUDO="sudo"
fi

echo "================================"
echo " 晨光打卡 - Ubuntu 空环境初始化"
echo "================================"
echo ""

if command -v apt-get >/dev/null 2>&1; then
    echo "[1/6] 安装系统依赖..."
    $SUDO apt-get update
    $SUDO apt-get install -y ca-certificates curl git gnupg lsof make build-essential
else
    echo "[1/6] 未检测到 apt-get，跳过系统依赖安装"
fi

echo "[2/6] 检查 Node.js..."
NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)"
fi

if [ "$NODE_MAJOR" -lt 20 ]; then
    if ! command -v apt-get >/dev/null 2>&1; then
        echo "错误: Node.js 版本低于 20，请先安装 Node.js 20 或 22"
        exit 1
    fi
    echo "安装 Node.js 22 LTS..."
    if [ -n "$SUDO" ]; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
    else
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    fi
    $SUDO apt-get install -y nodejs
else
    echo "Node.js 已满足要求: $(node -v)"
fi

echo "[3/6] 检查 uv..."
if ! command -v uv >/dev/null 2>&1; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    if [ -f "$HOME/.bashrc" ] && ! grep -q 'HOME/.local/bin' "$HOME/.bashrc"; then
        printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.bashrc"
    fi
else
    echo "uv 已安装: $(uv --version)"
fi

if ! command -v uv >/dev/null 2>&1; then
    echo "错误: uv 安装后仍不可用，请重新打开终端或检查 PATH"
    exit 1
fi

echo "[4/6] 安装后端依赖..."
cd "$BACKEND_DIR"
uv sync

echo "[5/6] 安装前端依赖..."
cd "$FRONTEND_DIR"
npm install

echo "[6/6] 检查 backend/.env..."
cd "$BACKEND_DIR"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "已创建 backend/.env，请填入 Sealos 对象存储配置和管理员初始化变量。"
fi

mkdir -p "$PROJECT_DIR/logs"

echo ""
echo "初始化完成。下一步:"
echo "  1. 运行 make configure-oss 配置 Sealos 对象存储"
echo "  2. 运行 make set-admin 设置管理员账号"
echo "  3. 运行 make nohup 并按提示填写 Sealos 公网地址"
