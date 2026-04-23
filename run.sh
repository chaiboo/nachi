#!/usr/bin/env bash
# Starts Nachi backend (uvicorn) and frontend (vite) together.
# Ctrl+C stops both.

set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Avoid pycache writes — helps on network filesystems (e.g. Google Drive).
export PYTHONDONTWRITEBYTECODE=1

# Default venv location: ~/.nachi/venv. Override with NACHI_VENV.
VENV="${NACHI_VENV:-$HOME/.nachi/venv}"
UVICORN="$VENV/bin/uvicorn"

if [[ ! -x "$UVICORN" ]]; then
  echo "nachi: uvicorn not found at $UVICORN"
  echo "See README for setup. Short version:"
  echo "  python3.11 -m venv \"$VENV\""
  echo "  \"$VENV/bin/pip\" install -r backend/requirements.txt"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "nachi: npm not found. Install Node.js 22.12+ first."
  exit 1
fi

cleanup() {
  echo
  echo "nachi: shutting down…"
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "nachi backend  → http://127.0.0.1:8000"
(cd "$PROJECT_DIR/backend" && "$UVICORN" main:app --host 127.0.0.1 --port 8000 --reload) &
BACKEND_PID=$!

echo "nachi frontend → http://localhost:5173"
(cd "$PROJECT_DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

wait
