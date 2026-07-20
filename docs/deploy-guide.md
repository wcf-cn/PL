# PL 看板 部署教程(详细)

> 目标:把 PL 看板部署到云服务器,电脑和手机都能通过浏览器访问。
> 适合:零基础,跟着做就行。

---

## 第一步:买服务器(约 10 分钟)

### 1.1 阿里云(推荐,国内快)

1. 打开 https://www.aliyun.com → 注册/登录
2. 产品 → **轻量应用服务器**(**不要买 ECS,贵且复杂**)
3. 配置选择:
   - **地域**:离你近的(如华东1-杭州)
   - **镜像**:**Ubuntu 22.04**(系统镜像,不是应用镜像)
   - **规格**:**2核2G**(约 24 元/月,够用)
   - **带宽**:**3Mbps**(个人够)
4. 付款,等 1-2 分钟创建完成

### 1.2 腾讯云(备选)

同理:https://cloud.tencent.com → **轻量应用服务器** → Ubuntu 22.04 → 2核2G

### 1.3 记下信息

买完后你会看到:
- **公网 IP**:如 `47.96.xx.xx`(**这就是访问地址**)
- **用户名**:`root`
- **密码**:买的时候设的(或短信通知的)

---

## 第二步:把代码推到 GitHub/Gitee(约 5 分钟)

服务器需要从远程拉代码。选一个:

### 方案 A:GitHub(国际)

1. https://github.com → 注册/登录
2. 点 `+` → **New repository**
3. 名字填 `plboard`,选 **Private**(私有),创建
4. 复制仓库地址(如 `https://github.com/你的用户名/plboard.git`)

### 方案 B:Gitee(国内,推荐)

1. https://gitee.com → 注册/登录
2. 右上 `+` → **新建仓库**
3. 名字 `plboard`,私有,创建
4. 复制地址(如 `https://gitee.com/你的用户名/plboard.git`)

### 推送代码

在你的 **Mac 终端**:
```bash
cd /Users/wcf/团队管理

# 关联远程仓库(换成你的地址)
git remote add origin https://gitee.com/你的用户名/plboard.git

# 推送
git push -u origin feat/stage1-mvp
```

> 如果提示要密码:Gitee/GitHub 密码或 Token。

---

## 第三步:SSH 连接服务器(约 2 分钟)

### 3.1 Mac 终端连接

```bash
ssh root@47.96.xx.xx
```
输入密码(你买服务器时设的)。

### 3.2 第一次进服务器,更新系统

```bash
apt update && apt upgrade -y
```

### 3.3 安装 Git(一般已有)

```bash
apt install -y git
```

---

## 第四步:一键部署(约 10 分钟)

### 4.1 拉代码 + 跑部署脚本

```bash
# 克隆代码
git clone https://gitee.com/你的用户名/plboard.git /opt/plboard

# 进入目录
cd /opt/plboard

# 给脚本执行权限
chmod +x deploy/deploy.sh

# 执行部署(把 URL 换成你的仓库地址)
bash deploy/deploy.sh https://gitee.com/你的用户名/plboard.git
```

### 4.2 脚本会自动完成

你会看到:
```
[1/6] 安装系统依赖...
[2/6] 拉取代码...
[3/6] 配置后端...(migrate + collectstatic)
[4/6] 构建前端...(npm install + build)
[5/6] 配置 Gunicorn...(systemd 服务)
[6/6] 配置 Nginx...(反向代理 + 静态)

=== ✅ 部署完成 ===
访问: http://47.96.xx.xx
登录: pl / pw
```

### 4.3 如果报错

**Node 安装失败**:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```
然后重新跑 `bash deploy/deploy.sh`

**Nginx 报错**:
```bash
nginx -t  # 看具体错误
systemctl status nginx
```

---

## 第五步:开放端口(关键!)

服务器默认可能不开 80 端口。

### 阿里云轻量:
1. 控制台 → 你的服务器 → **防火墙**
2. **添加规则** → TCP 端口 `80` → 确认
3. (可选)加 `443`(以后 HTTPS 用)

### 腾讯云轻量:
1. 控制台 → 你的服务器 → **防火墙**
2. 添加 → TCP `80` → 确认

---

## 第六步:访问!

### 电脑
浏览器打开:`http://47.96.xx.xx`

### 手机(iPhone)
Safari 打开:`http://47.96.xx.xx`

> 登录:`pl` / `pw`

**如果打不开**:
1. 确认端口 80 已开放(第五步)
2. 确认服务在跑:`systemctl status plboard`(应该 active running)
3. 确认 Nginx 在跑:`systemctl status nginx`
4. 看日志:`journalctl -u plboard -f`

---

## 第七步:配置 GLM API Key(AI 功能)

AI 助手需要 GLM key。

```bash
# 在服务器上
cd /opt/plboard/backend
cp .env.example .env
nano .env
```

改成:
```
GLM_API_KEY=b4f255c040ac432b9eedd56c7a0a6530.Bt3Am1ngPXWQDFWZ
GLM_MODEL=glm-5.2
```

保存(Ctrl+O → Enter → Ctrl+X),然后重启:
```bash
systemctl restart plboard
```

---

## 日常维护

### 更新代码(改了功能后)
```bash
# 在服务器上
cd /opt/plboard
git pull
bash deploy/deploy.sh https://gitee.com/你的用户名/plboard.git
```
脚本自动:拉代码 → build → collectstatic → 重启服务。

### 绑域名(可选)
1. 买个域名(阿里云/腾讯云买)
2. DNS 解析:域名 → 服务器 IP(A 记录)
3. Nginx 配置改 server_name:
```bash
nano /etc/nginx/sites-available/plboard
# 把 server_name _; 改成 server_name 你的域名.com;
nginx -s reload
```

### 加 HTTPS(可选,绑域名后)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d 你的域名.com
```
自动配 Let's Encrypt 证书,免费,90 天自动续。

---

## 常见问题

| 问题 | 解决 |
|---|---|
| 打不开页面 | 检查防火墙 80 端口 + `systemctl status plboard nginx` |
| 页面打开但样式丢失 | `cd /opt/plboard/backend && .venv/bin/python manage.py collectstatic --noinput` |
| AI 助手报错 | 配 .env GLM_API_KEY(第七步) |
| 手机底部 Tab 看不到 | 检查 build 是否最新(服务器 `git pull` + 重跑 deploy.sh) |
| 数据丢了 | SQLite 在 `/opt/plboard/backend/db.sqlite3`,定期备份:`cp db.sqlite3 db_backup_$(date +%Y%m%d).sqlite3` |

---

## 快速命令汇总

```bash
# 连服务器
ssh root@你的IP

# 看服务状态
systemctl status plboard

# 重启服务
systemctl restart plboard

# 看实时日志
journalctl -u plboard -f

# 更新代码
cd /opt/plboard && git pull && bash deploy/deploy.sh 你的仓库URL

# 备份数据库
cp /opt/plboard/backend/db.sqlite3 /root/db_backup.sqlite3
```
