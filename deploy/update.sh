#!/bin/bash
# PL Board 一键更新脚本(服务器上跑)
# 用法: cd /opt/plboard && bash deploy/update.sh
# 前提: 已通过 deploy.sh 完成首次部署
set -e
APP_DIR=$(dirname $(dirname "$0"))
cd "$APP_DIR"

echo "=== 拉取最新代码 ==="
git pull

echo "=== 后端 ==="
cd backend
.venv/bin/pip install -q -r requirements.txt
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput

echo "=== 前端 ==="
cd ../frontend
npm install --silent 2>/dev/null
npm run build

echo "=== 重启服务 ==="
sudo systemctl restart plboard
sudo systemctl restart nginx

echo "=== ✅ 更新完成 ==="
