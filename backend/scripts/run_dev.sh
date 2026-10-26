#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

exec uvicorn app.main:app --host "${AGENTOS_HOST:-0.0.0.0}" --port "${AGENTOS_PORT:-8765}" --reload
