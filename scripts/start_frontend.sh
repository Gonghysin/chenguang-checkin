#!/bin/bash
set -e
cd "$(dirname "$0")/../frontend"
exec npx serve dist -l 5174
