#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy_common.sh
. "$SCRIPT_DIR/deploy_common.sh"

run_pm2 logs
