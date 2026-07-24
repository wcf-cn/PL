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

## 每日风险摘要(可选,推送到个人微信/邮件)
1. 注册 [Server酱](https://sct.ftqq.com/),关注其微信公众号,拿到 sendkey,在 `backend/.env` 配:
   ```
   NOTIFY_WEBHOOK_URL=https://sctapi.ftqq.com/你的sendkey.send
   ```
   (或钉钉/飞书机器人 webhook,改 URL 即可,格式 `{title,desp}`)
2. 邮件(可选):配 `NOTIFY_EMAIL_TO=你@邮箱.com` + SMTP(`EMAIL_HOST`/`EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD`/`EMAIL_USE_TLS`)。
3. 定时每天 09:00 跑 `python manage.py daily_digest`:
   - Linux cron:`3 9 * * * cd /path/backend && .venv/bin/python manage.py daily_digest`
   - Win10:任务计划程序每天触发 `manage.py daily_digest`。
