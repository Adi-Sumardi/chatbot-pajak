#!/bin/bash
# =============================================================================
# deploy.sh - Deploy Chatbot Pajak to a fresh VPS
# Assumes: Node.js 20, Nginx, Certbot already installed
# Will install: PostgreSQL + Python 3.11, then deploy the app end-to-end
# =============================================================================
set -euo pipefail

# --- Configuration ---
APP_NAME="chatbot-pajak"
REPO_URL="https://github.com/Adi-Sumardi/chatbot-pajak.git"
BRANCH="main"
DB_NAME="chatbot_pajak"
DB_USER="chatbot_user"

# --- Prompt for deployment-specific settings ---
read -p "Enter domain (e.g. chatbot.example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
  echo "Domain is required." >&2
  exit 1
fi
read -p "Enter install directory [/var/www/$APP_NAME]: " APP_DIR_INPUT
APP_DIR="${APP_DIR_INPUT:-/var/www/$APP_NAME}"

echo "============================================"
echo "  Chatbot Pajak - Deployment"
echo "  Domain: $DOMAIN"
echo "  Directory: $APP_DIR"
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
# 1. Install missing packages (PostgreSQL, Python 3.11)
# =============================================================================
echo ""
echo "[1/8] Installing required packages..."
sudo apt-get update
sudo apt-get install -y \
  software-properties-common \
  postgresql postgresql-contrib \
  libpq-dev

# Install Python 3.11 from deadsnakes PPA
if ! command -v python3.11 &>/dev/null; then
  sudo add-apt-repository -y ppa:deadsnakes/ppa
  sudo apt-get update
  sudo apt-get install -y python3.11 python3.11-venv python3.11-dev
fi

echo "  Python: $(python3.11 --version)"
echo "  Node.js: $(node -v)"
echo "  PostgreSQL: $(psql --version)"

# =============================================================================
# 2. Setup PostgreSQL
# =============================================================================
echo ""
echo "[2/8] Setting up PostgreSQL..."

# Ensure PostgreSQL is running
sudo systemctl enable postgresql
sudo systemctl start postgresql

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
echo "  Database '$DB_NAME' ready."

# =============================================================================
# 3. Clone repository
# =============================================================================
echo ""
echo "[3/8] Cloning repository..."
sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git fetch origin && git reset --hard origin/$BRANCH
else
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# =============================================================================
# 4. Setup backend
# =============================================================================
echo ""
echo "[4/8] Setting up backend..."
cd "$APP_DIR/backend"

python3.11 -m venv venv
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
UPLOAD_DIR=${APP_DIR}/backend/storage/uploads
EXPORT_DIR=${APP_DIR}/backend/storage/exports
DEBUG=false
ENVFILE

mkdir -p storage/uploads storage/exports

# Run migrations
source venv/bin/activate
alembic upgrade head
deactivate

# =============================================================================
# 5. Setup frontend
# =============================================================================
echo ""
echo "[5/8] Setting up frontend..."
cd "$APP_DIR/frontend"

cat > .env.local <<ENVFILE
NEXT_PUBLIC_API_URL=https://${DOMAIN}
ENVFILE

npm ci
npm run build

# Standalone output doesn't include static assets — copy them in like update.sh does,
# otherwise the frontend serves with no CSS/JS until the first update.sh run.
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# =============================================================================
# 6. Create systemd services
# =============================================================================
echo ""
echo "[6/8] Creating systemd services..."

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
EnvironmentFile=$APP_DIR/backend/.env
Environment=PATH=$APP_DIR/backend/venv/bin:/usr/local/bin:/usr/bin
ExecStart=$APP_DIR/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

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
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable chatbot-backend chatbot-frontend
sudo systemctl start chatbot-backend chatbot-frontend

# =============================================================================
# 7. Setup Nginx
# =============================================================================
echo ""
echo "[7/8] Configuring Nginx..."

sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null <<'NGINX'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    client_max_body_size 50M;

    # Certbot verification
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

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

    # Frontend (Next.js)
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
# 8. SSL Certificate (Let's Encrypt)
# =============================================================================
echo ""
echo "[8/8] Obtaining SSL certificate..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL"

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
echo ""
echo "  Update:"
echo "    cd $APP_DIR && ./update.sh"
echo "============================================"
