#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== 服务状态 ==="
pm2 status
echo ""
echo "=== 进程详情 ==="
pm2 describe backend 2>/dev/null | head -20
echo ""
pm2 describe frontend 2>/dev/null | head -20
echo ""
echo "=== 最近日志 ==="
pm2 logs --lines 30 --nostream
