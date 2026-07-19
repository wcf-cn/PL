# 部署 + 手机适配 设计文档

> 日期:2026-07-19

## 1. 部署(云服务器)

### 架构
```
用户(电脑/手机浏览器)
    ↓ HTTPS
Nginx (80/443)
    ↓ 反向代理
Gunicorn (127.0.0.1:8000)
    ↓
Django + DRF + SQLite
```

### 服务器配置
- OS: Ubuntu 22.04 LTS
- 规格: 阿里云/腾讯云轻量 2核2G ~24元/月
- Python 3.12, Node 20
- Gunicorn (WSGI), Nginx (静态+反代)
- SQLite (数据持久,单用户够)

### 部署步骤(脚本化 deploy.sh)
1. SSH 登录服务器
2. apt install python3-venv nginx
3. git clone 代码
4. backend: venv + pip install -r requirements.txt(加 gunicorn)
5. frontend: npm install + npm run build
6. collectstatic
7. migrate + createsuperuser
8. Gunicorn systemd service
9. Nginx 配置(反代 + 静态 + SPA fallback)
10. (可选)域名 + Let's Encrypt HTTPS

### requirements.txt 加
```
gunicorn>=21.0
```

### Nginx 配置
```nginx
server {
    listen 80;
    server_name _;  # 或域名

    # 静态文件(Django collectstatic)
    location /static/ {
        alias /opt/plboard/backend/staticfiles/;
    }

    # 前端构建产物(dist/assets)
    location /assets/ {
        alias /opt/plboard/frontend/dist/assets/;
    }

    # Django API + SPA
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### settings.py 调整
- `DEBUG=False`(生产)
- `ALLOWED_HOSTS=['*']` 或具体域名/IP
- `STATIC_ROOT = BASE_DIR / 'staticfiles'`

## 2. 手机适配(响应式)

### 设计原则
- Tailwind 响应式断点:`sm:`(640px)、`md:`(768px)、`lg:`(1024px)
- 手机优先(<768px),电脑增强(≥768px)
- 同一套代码,不分离移动端

### 各组件适配

#### App.tsx 导航
- **电脑**(≥md):顶部 Tab 横排(现状)
- **手机**(<md):底部 Tab Bar(fixed bottom,图标+文字,原生 app 风)
- 判断:`useMediaQuery` 或纯 CSS(hidden md:flex / flex md:hidden)

#### Board.tsx 看板
- **电脑**:多列横排(现状,w-64 每列)
- **手机**:单列占满宽度 + 左右滑动切换状态列(swipe 或 Select 切换)
- 卡片紧凑(字号缩小,padding 减少)
- Dialog:手机全屏(`w-full h-full md:w-auto md:h-auto`)

#### Capacity.tsx 产能
- **电脑**:Table(现状)
- **手机**:卡片列表(每人一个 Card,字段竖排)
- 切换:`hidden md:table` / `md:hidden`(卡片版)

#### Team.tsx 团队
- 同 Capacity(Table → 卡片)

#### Gantt.tsx 甘特
- 保持横向滚动(手机也横滑)
- DAY_W 在手机上缩小(或保持,横滑)

#### Burndown.tsx 燃尽
- ResponsiveContainer 已有(自动缩放)
- 字号调整(text-[10px] on mobile)

#### AssistantWidget.tsx AI 助手
- **电脑**:右下浮窗 360px(现状)
- **手机**:全屏面板(w-full h-full)
- 气泡按钮位置调整(避免和底部 Nav 冲突)

#### Login.tsx
- 全屏居中(已有,max-w-xs)

### 新增依赖
- 无(纯 Tailwind 响应式 class)

## 3. 改动文件

### 前端(响应式)
- `App.tsx`(导航响应式)
- `Board.tsx`(看板紧凑 + Dialog 全屏)
- `Capacity.tsx`(表格→卡片切换)
- `Team.tsx`(同上)
- `AssistantWidget.tsx`(浮窗→全屏)
- `index.css`(全局移动端优化:禁止缩放、viewport)

### 后端(部署)
- `settings.py`(DEBUG/ALLOWED_HOSTS)
- `requirements.txt`(加 gunicorn)
- `deploy.sh`(一键部署脚本)
- `nginx.conf`(Nginx 配置模板)

## 4. 非目标(YAGNI)
- PWA / 离线支持
- 原生 app
- 多用户/权限
- CDN
- 数据库迁移到 Postgres(SQLite 够)
