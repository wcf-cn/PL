#!/bin/bash
set -e
# PL Board 一键部署脚本(阿里云/腾讯云 Ubuntu 22.04)
# 用法: bash deploy.sh [仓库URL]
# 例:   bash deploy.sh https://github.com/user/plboard.git

REPO_URL="${1:-请先设置仓库URL}"
APP_DIR=/opt/plboard

echo "=== PL Board 部署 ==="

# 1. 系统依赖
echo "[1/6] 安装系统依赖..."
sudo apt update -qq && sudo apt install -y -qq python3 python3-venv nginx git curl > /dev/null

# Node 20
if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - > /dev/null 2>&1
  sudo apt install -y -qq nodejs > /dev/null
fi

# 2. 拉代码
echo "[2/6] 拉取代码..."
sudo mkdir -p $APP_DIR && sudo chown $USER:$USER $APP_DIR
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" $APP_DIR
else
  cd $APP_DIR && git pull
fi

# 3. 后端
echo "[3/6] 配置后端..."
cd $APP_DIR/backend
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput

# 创建超级用户(如不存在)
.venv/bin/python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='pl').exists():
    User.objects.create_superuser('pl', 'admin@local', 'pw')
    print('Superuser pl created')
" 2>/dev/null || true

# 4. 前端
echo "[4/6] 构建前端..."
cd $APP_DIR/frontend
npm install --silent 2>/dev/null
npm run build

# 5. Gunicorn systemd
echo "[5/6] 配置 Gunicorn..."
sudo tee /etc/systemd/system/plboard.service > /dev/null <<EOF
[Unit]
Description=PL Board (Gunicorn)
After=network.target
[Service]
User=$USER
WorkingDirectory=$APP_DIR/backend
Environment=DJANGO_DEBUG=False
ExecStart=$APP_DIR/backend/.venv/bin/gunicorn plboard.wsgi:application -b 127.0.0.1:8000 --workers 2
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable plboard
sudo systemctl restart plboard

# 6. Nginx
echo "[6/6] 配置 Nginx..."
sudo tee /etc/nginx/sites-available/plboard > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location /static/ {
        alias $APP_DIR/backend/staticfiles/;
        expires 30d;
    }

    location /assets/ {
        alias $APP_DIR/frontend/dist/assets/;
        expires 30d;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/plboard /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

echo ""
echo "=== ✅ 部署完成 ==="
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "服务器IP")
echo "访问: http://$PUBLIC_IP"
echo "登录: pl / pw"
echo ""
echo "后续:"
echo "  - 更新代码: cd $APP_DIR && git pull && bash deploy/deploy.sh"
echo "  - 绑域名: sudo nano /etc/nginx/sites-available/plboard (改 server_name)"
echo "  - HTTPS: sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx"
