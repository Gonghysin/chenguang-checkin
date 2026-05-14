#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy_common.sh
. "$SCRIPT_DIR/deploy_common.sh"

echo "=== 服务状态 ==="
run_pm2 status
echo ""
echo "=== 进程详情 ==="
run_pm2 describe backend 2>/dev/null | head -20
echo ""
run_pm2 describe frontend 2>/dev/null | head -20
echo ""
echo "=== 最近日志 ==="
run_pm2 logs --lines 30 --nostream
