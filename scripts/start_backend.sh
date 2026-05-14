#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=deploy_common.sh
. "$SCRIPT_DIR/deploy_common.sh"
cd "$BACKEND_DIR"
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
