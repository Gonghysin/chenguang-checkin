#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy_common.sh
. "$SCRIPT_DIR/deploy_common.sh"
cd "$FRONTEND_DIR"
exec npx serve dist -l 5174
