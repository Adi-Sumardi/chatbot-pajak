#!/bin/bash
# =============================================================================
# update.sh - Pull latest code and redeploy
# Run this on the VPS whenever you push updates
# Usage: ./update.sh [--backend-only | --frontend-only]
# =============================================================================
set -euo pipefail

APP_DIR="/opt/chatbot-pajak"
BRANCH="main"

echo "============================================"
echo "  Chatbot Pajak - Update Deployment"
echo "============================================"

cd "$APP_DIR"

# --- Pull latest code ---
echo ""
echo "[1/4] Pulling latest code..."
git fetch origin
git reset --hard origin/$BRANCH
echo "Updated to: $(git log --oneline -1)"

SKIP_BACKEND=false
SKIP_FRONTEND=false

if [ "${1:-}" = "--frontend-only" ]; then
  SKIP_BACKEND=true
elif [ "${1:-}" = "--backend-only" ]; then
  SKIP_FRONTEND=true
fi

# --- Update backend ---
if [ "$SKIP_BACKEND" = false ]; then
  echo ""
  echo "[2/4] Updating backend..."
  cd "$APP_DIR/backend"
  source venv/bin/activate

  pip install -r requirements.txt --quiet

  # Run migrations if any
  alembic upgrade head

  deactivate

  echo "Restarting backend..."
  sudo systemctl restart chatbot-backend
  echo "Backend restarted."
else
  echo ""
  echo "[2/4] Skipping backend (--frontend-only)"
fi

# --- Update frontend ---
if [ "$SKIP_FRONTEND" = false ]; then
  echo ""
  echo "[3/4] Updating frontend..."
  cd "$APP_DIR/frontend"

  npm ci --omit=dev
  npm run build

  echo "Restarting frontend..."
  sudo systemctl restart chatbot-frontend
  echo "Frontend restarted."
else
  echo ""
  echo "[3/4] Skipping frontend (--backend-only)"
fi

# --- Health check ---
echo ""
echo "[4/4] Health check..."
sleep 3

BACKEND_OK=false
FRONTEND_OK=false

if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
  BACKEND_OK=true
  echo "  Backend:  OK"
else
  echo "  Backend:  FAILED - check: journalctl -u chatbot-backend -n 50"
fi

if curl -sf http://127.0.0.1:3000 > /dev/null 2>&1; then
  FRONTEND_OK=true
  echo "  Frontend: OK"
else
  echo "  Frontend: FAILED - check: journalctl -u chatbot-frontend -n 50"
fi

echo ""
if [ "$BACKEND_OK" = true ] && [ "$FRONTEND_OK" = true ]; then
  echo "Update complete! All services running."
else
  echo "Update complete with errors. Check logs above."
fi
