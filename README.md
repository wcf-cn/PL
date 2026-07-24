# PL 看板工具

个人自用的需求 + 人力产能管理。详见 `docs/superpowers/specs/2026-07-04-pl-board-design.md`。

## 开发
```bash
# 后端
cd backend && .venv\Scripts\activate && pip install -r requirements.txt
python manage.py migrate && python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000

# 前端(另开终端)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## 生产(单端口)
```bash
cd frontend && npm run build
cd ../backend && python manage.py collectstatic --noinput
python manage.py runserver 0.0.0.0:8000    # http://localhost:8000 全栈
```

## 手机访问(Tailscale)
Win10 与 iPhone 各装 Tailscale 并登录同账号 → 手机浏览器访问 Win10 的 Tailscale IP `http://100.x.x.x:8000`。

## 测试
```bash
cd backend && pytest
cd frontend && npx vitest run
```

## 备份(自动)
```bash
cd backend && python manage.py backup_db          # 立即备份一次, 默认保留最近 30 份到 backend/backups/
```
定时(二选一, 每天 23:55 跑一次):
- Linux(cron): `55 23 * * * cd /path/backend && .venv/bin/python manage.py backup_db`
- Win10: 任务计划程序, 每天触发 `manage.py backup_db`
