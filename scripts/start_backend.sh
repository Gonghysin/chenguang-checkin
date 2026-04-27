#!/bin/bash
set -e
cd "$(dirname "$0")/../backend"
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
