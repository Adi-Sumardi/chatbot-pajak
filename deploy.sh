#!/bin/bash
# =============================================================================
# deploy.sh - Initial deployment script for Chatbot Pajak
# Run this ONCE on a fresh Ubuntu VPS (Biznet Gio Cloud)
# Domain: chatbot.adilabs.id
# =============================================================================
set -euo pipefail

# --- Configuration ---
APP_NAME="chatbot-pajak"
DOMAIN="chatbot.adilabs.id"
APP_DIR="/opt/$APP_NAME"
REPO_URL="https://github.com/Adi-Sumardi/chatbot-pajak.git"
BRANCH="main"
DB_NAME="chatbot_pajak"
DB_USER="chatbot_user"
NODE_VERSION="20"
PYTHON_VERSION="3.11"

echo "============================================"
echo "  Chatbot Pajak - Initial Deployment"
echo "  Domain: $DOMAIN"
echo "============================================"

# --- Prompt for secrets ---
read -sp "Enter DB password for '$DB_USER': " DB_PASSWORD
echo
read -sp "Enter JWT secret key: " JWT_SECRET
echo
read -p "Enter OpenAI API key (or leave blank): " OPENAI_KEY
read -p "Enter Anthropic API key (or leave blank): " ANTHROPIC_KEY
read -p "Enter your email for SSL certificate: " SSL_EMAIL

# =============================================================================
# 1. System packages
# =============================================================================
echo ""
echo "[1/9] Installing system packages..."
sudo apt-get update
sudo apt-get install -y \
  curl git build-essential \
  python${PYTHON_VERSION} python${PYTHON_VERSION}-venv python${PYTHON_VERSION}-dev \
  postgresql postgresql-contrib \
  nginx certbot python3-certbot-nginx \
  libpq-dev

# =============================================================================
# 2. Install Node.js via NodeSource
# =============================================================================
echo ""
echo "[2/9] Installing Node.js ${NODE_VERSION}..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node.js $(node -v), npm $(npm -v)"

# =============================================================================
# 3. Setup PostgreSQL
# =============================================================================
echo ""
echo "[3/9] Setting up PostgreSQL..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# =============================================================================
# 4. Clone repository
# =============================================================================
echo ""
echo "[4/9] Cloning repository..."
sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git fetch origin && git reset --hard origin/$BRANCH
else
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# =============================================================================
# 5. Setup backend
# =============================================================================
echo ""
echo "[5/9] Setting up backend..."
cd "$APP_DIR/backend"

python${PYTHON_VERSION} -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# Create .env
cat > "$APP_DIR/backend/.env" <<ENVFILE
DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
JWT_SECRET_KEY=${JWT_SECRET}
OPENAI_API_KEY=${OPENAI_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}
CORS_ORIGINS=["https://${DOMAIN}"]
UPLOAD_DIR=/opt/${APP_NAME}/backend/storage/uploads
EXPORT_DIR=/opt/${APP_NAME}/backend/storage/exports
DEBUG=false
ENVFILE

mkdir -p storage/uploads storage/exports

# Run migrations
source venv/bin/activate
alembic upgrade head
deactivate

# =============================================================================
# 6. Setup frontend
# =============================================================================
echo ""
echo "[6/9] Setting up frontend..."
cd "$APP_DIR/frontend"

# Create .env.local
cat > .env.local <<ENVFILE
NEXT_PUBLIC_API_URL=https://${DOMAIN}
ENVFILE

npm ci
npm run build

# =============================================================================
# 7. Create systemd services
# =============================================================================
echo ""
echo "[7/9] Creating systemd services..."

# Backend service
sudo tee /etc/systemd/system/chatbot-backend.service > /dev/null <<SERVICE
[Unit]
Description=Chatbot Pajak Backend (FastAPI)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR/backend
Environment=PATH=$APP_DIR/backend/venv/bin:/usr/bin
ExecStart=$APP_DIR/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

# Frontend service
sudo tee /etc/systemd/system/chatbot-frontend.service > /dev/null <<SERVICE
[Unit]
Description=Chatbot Pajak Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR/frontend
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node $APP_DIR/frontend/.next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable chatbot-backend chatbot-frontend
sudo systemctl start chatbot-backend chatbot-frontend

# =============================================================================
# 8. Setup Nginx
# =============================================================================
echo ""
echo "[8/9] Configuring Nginx..."

sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null <<'NGINX'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    client_max_body_size 50M;

    # API & backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support for streaming chat
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

# Replace domain placeholder
sudo sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/$APP_NAME

sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# =============================================================================
# 9. SSL Certificate (Let's Encrypt)
# =============================================================================
echo ""
echo "[9/9] Obtaining SSL certificate..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL"

# Certbot auto-renewal timer
sudo systemctl enable certbot.timer

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "  URL: https://$DOMAIN"
echo ""
echo "  Services:"
echo "    sudo systemctl status chatbot-backend"
echo "    sudo systemctl status chatbot-frontend"
echo ""
echo "  Logs:"
echo "    journalctl -u chatbot-backend -f"
echo "    journalctl -u chatbot-frontend -f"
echo "============================================"
