# 部署 + 手机适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** 部署到云服务器(电脑+手机访问)+ 全量响应式适配手机。

**Architecture:** Gunicorn+Nginx+SQLite 部署;Tailwind 响应式断点适配各页。

---

### Task 1: 全局 viewport + 移动端基础

**Files:**
- Modify: `frontend/index.html`(viewport meta)
- Modify: `frontend/src/index.css`(全局移动端优化)
- Modify: `frontend/src/App.tsx`(导航响应式)

- [ ] **Step 1: index.html 加 viewport**

确保 `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`(禁止缩放,原生 app 体验)。

- [ ] **Step 2: index.css 全局优化**

加:
```css
html { -webkit-text-size-adjust: 100%; }
body { overscroll-behavior: none; }
/* 底部 Tab Bar 高度变量 */
:root { --tab-bar-h: 56px; }
```

- [ ] **Step 3: App.tsx 导航响应式**

电脑(≥md):顶部 Tab(现状 `hidden md:flex`)。
手机(<md):底部 Tab Bar(`fixed bottom-0 md:hidden`,图标+文字)。
内容区加 `pb-14 md:pb-0`(给底部 Tab 留空间)。

```tsx
// 底部 Tab Bar(手机)
function BottomTabBar({ path, navItems }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t flex justify-around items-center md:hidden" style={{ height: 'var(--tab-bar-h)' }}>
      {navItems.map(item => {
        const active = path.includes(item.href.replace('#/', ''))
        return (
          <a key={item.href} href={item.href} className={cn(
            'flex flex-col items-center justify-center flex-1 h-full text-xs',
            active ? 'text-primary font-medium' : 'text-muted-foreground'
          )}>
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}
```

修改 Nav 组件:顶部 `hidden md:flex`;底部 `<BottomTabBar />` 在 authed 时渲染。
主内容区:`<main className="pb-14 md:pb-0">`

- [ ] **Step 4: 验证 build**

Run: `npm --prefix frontend run build`

- [ ] **Step 5: Commit**

`feat(frontend): responsive nav — top tabs desktop + bottom tab bar mobile`

---

### Task 2: 看板 + Dialog 手机适配

**Files:**
- Modify: `frontend/src/pages/Board.tsx`
- Modify: `frontend/src/components/ui/dialog.tsx`

- [ ] **Step 1: Dialog 手机全屏**

`dialog.tsx` 的 DialogContent 加手机全屏:
```tsx
className={cn(
  "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
  "max-w-lg",
  // 手机全屏
  "max-md:inset-0 max-md:translate-x-0 max-md:translate-y-0 max-md:left-0 max-md:top-0 max-md:max-w-none max-md:h-full max-md:rounded-none max-md:overflow-y-auto",
  className
)}
```

- [ ] **Step 2: 看板卡片紧凑(手机)**

RequirementCard 的 CardContent 加手机紧凑:
```tsx
<CardContent className="p-2 md:p-3">
  <div className="font-medium text-sm md:mb-2 mb-1">{requirement.title}</div>
  <div className="flex flex-wrap items-center gap-1 md:gap-2 text-xs text-muted-foreground">
```

- [ ] **Step 3: 看板列宽度(手机单列横滑)**

Column 的宽度保持 w-64(横滑已有 overflow-x-auto)。但手机上缩小 padding:
```tsx
className={cn("w-60 md:w-64 shrink-0 p-2 md:p-4 ...")}
```

- [ ] **Step 4: build + commit**

`feat(frontend): board + dialog mobile responsive`

---

### Task 3: 产能/团队/排期表格→卡片(手机)

**Files:**
- Modify: `frontend/src/pages/Capacity.tsx`
- Modify: `frontend/src/pages/Team.tsx`

- [ ] **Step 1: Capacity 手机卡片版**

Table 包 `hidden md:block`;加一个卡片列表 `md:hidden`:
```tsx
{/* 电脑:Table */}
<div className="hidden md:block">
  <Table>...</Table>
</div>
{/* 手机:卡片 */}
<div className="md:hidden space-y-2">
  {rows.map(r => (
    <Card key={r.member_id} className="p-3">
      <div className="flex justify-between">
        <span className="font-medium">{r.member}</span>
        {badge(r.utilization)}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        容量{r.capacity}h · 本周{r.currentWeekly}h · 峰值{r.peakWeekly}h · 未排期{r.unscheduled}h
      </div>
    </Card>
  ))}
</div>
```

- [ ] **Step 2: Team 同上(Table + 卡片切换)**

- [ ] **Step 3: Schedule 已是卡片(单列堆叠)**

加手机紧凑:`space-y-2 md:space-y-4`。

- [ ] **Step 4: build + commit**

`feat(frontend): capacity/team mobile card layout`

---

### Task 4: AI 助手 + 燃尽手机适配

**Files:**
- Modify: `frontend/src/components/AssistantWidget.tsx`
- Modify: `frontend/src/pages/Burndown.tsx`

- [ ] **Step 1: AssistantWidget 手机全屏**

展开面板时,手机全屏:
```tsx
// 展开面板
<div className="fixed bottom-0 right-0 z-50 w-full h-full md:w-96 md:max-h-[80vh] md:bottom-6 md:right-6 md:h-auto flex flex-col shadow-xl">
```

气泡按钮手机位置避开底部 Tab:
```tsx
<button className="fixed bottom-16 md:bottom-6 right-4 ...">
```

- [ ] **Step 2: Burndown 字号 + 高度响应**

```tsx
<ResponsiveContainer width="100%" height={250} className="md:!h-[350px]">
```

- [ ] **Step 3: build + commit**

`feat(frontend): AI widget fullscreen + burndown mobile`

---

### Task 5: 甘特图手机适配

**Files:**
- Modify: `frontend/src/pages/Gantt.tsx`

- [ ] **Step 1: 甘特保持横滑,紧凑化**

- DAY_W 手机缩小(已有 adaptive,确认 containerWidth 在手机上也测对)
- 卡片/条文字 `text-[10px]`
- 整体容器 `overflow-x-auto`(已有)
- 按钮区域 `flex-wrap`(已有)

- [ ] **Step 2: build + commit**

`style(gantt): mobile compact`

---

### Task 6: 后端部署配置 + 脚本

**Files:**
- Modify: `backend/requirements.txt`(加 gunicorn)
- Modify: `backend/plboard/settings.py`(生产配置)
- Create: `deploy/deploy.sh`
- Create: `deploy/nginx.conf`
- Create: `deploy/gunicorn.service`

- [ ] **Step 1: requirements.txt 加 gunicorn**

```
gunicorn>=21.0
```

- [ ] **Step 2: settings.py 生产适配**

```python
import os
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(',')
# CSRF/TRUSTED origins 从 env 读(生产配域名)
CSRF_TRUSTED_ORIGINS = os.environ.get('DJANGO_CSRF_TRUSTED', 'http://localhost*').split(',')
```

- [ ] **Step 3: deploy.sh 一键部署脚本**

```bash
#!/bin/bash
set -e
APP_DIR=/opt/plboard
echo "=== PL Board 部署 ==="

# 1. 系统依赖
sudo apt update && sudo apt install -y python3 python3-venv nginx git

# 2. 拉代码
sudo mkdir -p $APP_DIR && sudo chown $USER $APP_DIR
if [ ! -d "$APP_DIR/.git" ]; then
  git clone <你的仓库URL> $APP_DIR
else
  cd $APP_DIR && git pull
fi

# 3. 后端
cd $APP_DIR/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --noinput

# 4. 前端
cd $APP_DIR/frontend
npm install && npm run build

# 5. Gunicorn
sudo tee /etc/systemd/system/plboard.service > /dev/null <<SVCEOF
[Unit]
Description=PL Board Gunicorn
After=network.target
[Service]
User=$USER
WorkingDirectory=$APP_DIR/backend
ExecStart=$APP_DIR/backend/.venv/bin/gunicorn plboard.wsgi:application -b 127.0.0.1:8000 --workers 2
Restart=always
[Install]
WantedBy=multi-user.target
SVCEOF
sudo systemctl daemon-reload
sudo systemctl enable plboard
sudo systemctl restart plboard

# 6. Nginx
sudo tee /etc/nginx/sites-available/plboard > /dev/null <<NGXEOF
server {
    listen 80;
    server_name _;
    location /static/ { alias $APP_DIR/backend/staticfiles/; }
    location /assets/ { alias $APP_DIR/frontend/dist/assets/; }
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
NGXEOF
sudo ln -sf /etc/nginx/sites-available/plboard /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

echo "=== 部署完成 ==="
echo "访问: http://$(curl -s ifconfig.me)"
```

- [ ] **Step 4: Commit**

`feat: deploy scripts (gunicorn+nginx) + production settings`

---

## Self-Review

- Task 1: viewport + 导航响应式 ✓
- Task 2: 看板 + Dialog 全屏 ✓
- Task 3: 产能/团队表格→卡片 ✓
- Task 4: AI 全屏 + 燃尽 ✓
- Task 5: 甘特紧凑 ✓
- Task 6: 部署脚本 + 配置 ✓
- 无后端数据模型改动
- 全部纯 Tailwind CSS + 部署配置
