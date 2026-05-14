#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy_common.sh
. "$SCRIPT_DIR/deploy_common.sh"

echo "================================"
echo " 晨光打卡 - Ubuntu 空环境初始化"
echo "================================"
echo ""
print_runtime_context
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
if ! project_command_exists uv; then
    echo "安装 uv 到项目用户 $PROJECT_RUN_USER..."
    run_project_step "    下载并安装 uv" "$PROJECT_DIR" "curl -LsSf https://astral.sh/uv/install.sh | sh"
    project_shell "$PROJECT_DIR" "if [ -f \"\$HOME/.bashrc\" ] && ! grep -q 'HOME/.local/bin' \"\$HOME/.bashrc\"; then printf '\\nexport PATH=\"\$HOME/.local/bin:\$PATH\"\\n' >> \"\$HOME/.bashrc\"; fi"
else
    echo "uv 已安装: $(project_shell "$PROJECT_DIR" "uv --version")"
fi

if ! project_command_exists uv; then
    echo "错误: uv 安装后仍不可用，请重新打开终端或检查 PATH"
    exit 1
fi

run_project_step "[4/6] 安装后端依赖..." "$BACKEND_DIR" "uv sync"

if [ -f "$FRONTEND_DIR/package-lock.json" ]; then
    run_project_step "[5/6] 安装前端依赖..." "$FRONTEND_DIR" "npm ci"
else
    run_project_step "[5/6] 安装前端依赖..." "$FRONTEND_DIR" "npm install"
fi

echo "[6/6] 检查 backend/.env..."
cd "$BACKEND_DIR"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "已创建 backend/.env，请填入 Sealos 对象存储配置和管理员初始化变量。"
fi

ensure_log_dir
chown_to_project_user "$BACKEND_DIR/.env" "$PROJECT_DIR/logs"

echo ""
echo "初始化完成。下一步:"
echo "  1. 运行 make configure-oss 配置 Sealos 对象存储"
echo "  2. 运行 make set-admin 设置管理员账号"
echo "  3. 运行 make nohup 并按提示填写 Sealos 公网地址"
