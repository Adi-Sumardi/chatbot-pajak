#!/bin/bash
# =============================================================================
# prepare-vps.sh - One-time base setup for a fresh Ubuntu/Debian VPS
# Installs: Node.js 20, Nginx, Certbot, UFW firewall rules
# Run this BEFORE deploy.sh. Requires sudo.
# =============================================================================
set -euo pipefail

echo "============================================"
echo "  Chatbot Pajak - VPS Base Setup"
echo "============================================"

# =============================================================================
# 1. System update
# =============================================================================
echo ""
echo "[1/4] Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# =============================================================================
# 2. Install Node.js 20 (NodeSource)
# =============================================================================
echo ""
echo "[2/4] Installing Node.js 20..."
if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "  Node.js: $(node -v)"
echo "  npm: $(npm -v)"

# =============================================================================
# 3. Install Nginx + Certbot
# =============================================================================
echo ""
echo "[3/4] Installing Nginx and Certbot..."
sudo apt-get install -y nginx certbot python3-certbot-nginx

sudo systemctl enable nginx
sudo systemctl start nginx
echo "  Nginx: $(nginx -v 2>&1)"
echo "  Certbot: $(certbot --version)"

# =============================================================================
# 4. Firewall (UFW) - allow SSH, HTTP, HTTPS
# =============================================================================
echo ""
echo "[4/4] Configuring firewall..."
if command -v ufw &>/dev/null; then
  sudo ufw allow OpenSSH
  sudo ufw allow 'Nginx Full'
  sudo ufw --force enable
  sudo ufw status
else
  echo "  ufw not found, skipping firewall setup."
fi

echo ""
echo "============================================"
echo "  Base setup complete!"
echo "  Next: run ./deploy.sh"
echo "============================================"
