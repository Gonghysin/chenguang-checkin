#!/bin/bash
set -e
if ! command -v uv >/dev/null 2>&1 && [ -f "$HOME/.local/bin/env" ]; then
    . "$HOME/.local/bin/env"
fi
cd "$(dirname "$0")/../backend"
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
