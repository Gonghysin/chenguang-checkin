#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

pm2 restart ecosystem.config.js
echo "服务已重启"
pm2 status
