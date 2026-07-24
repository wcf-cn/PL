# PL 看板 v2 子项目 B — 自动通知/推送 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) tracking.

**Goal:** 每日 09:00 把风险摘要(超期/将至/被阻塞/版本风险/超载)推送到个人微信(Server酱 webhook)+ 可选邮件,经 Django management command + cron 调度。

**Architecture:** 后端新增 `digest.py`(算风险摘要 markdown + 发送 webhook/邮件),`daily_digest` management command 调用它,config 走 `.env`。阈值与 Focus 页一致。纯后端,无前端改动。

**Tech Stack:** Django+DRF+SQLite(pytest-django),`requests`(已装,ai.py 用),Django core mail。

## Global Constraints

- 纯单人自用,严守 YAGNI。
- 后端测试 `cd backend && .venv/bin/python -m pytest`。
- 每个 commit 走 Conventional Commits。
- **Rollup 语义**:leaves-only `.annotate(nc=Count('children')).filter(nc=0)`;超载阈值 `week_capacity × 0.7`。
- **风险阈值(与 Focus 页一致)**:超期 = `planned_end<今天` 且非 done/paused;将至 = `planned_end` 在今天..今天+2 且非 done/paused;被阻塞 = `blocked_by` 非空 或 status=blocked;版本风险 = freeze/test 日期 ≤ 今天+3 且有未完成叶子;超载 = 成员在途叶子 est_effort > `week_capacity×0.7`。
- 配置走 `.env`:`NOTIFY_WEBHOOK_URL`(Server酱 sendkey URL,留空则不发微信)、`NOTIFY_EMAIL_TO`(留空则不发邮件)+ SMTP 变量。
- 在 `feat/stage1-mvp` 分支。`requests` 已是依赖。

---

## Task 1: digest.py 风险摘要计算

**Files:**
- Create: `backend/apps/core/digest.py`
- Create: `backend/apps/core/tests/test_digest.py`

**Interfaces:**
- Produces: `build_digest()` → markdown 字符串(每日风险摘要)。

- [ ] **Step 1: 写失败测试**

Create `backend/apps/core/tests/test_digest.py`:

```python
from datetime import date, timedelta
import pytest
from apps.core.models import Member, Requirement, Version
from apps.core.digest import build_digest


@pytest.mark.django_db
def test_digest_lists_overdue_and_clean_when_none():
    m = Member.objects.create(name='张三', week_capacity=40)
    # 超期需求
    Requirement.objects.create(title='延期A', assignee=m, status='in_progress',
                               planned_end=date.today() - timedelta(days=3), est_effort=8)
    md = build_digest()
    assert '超期' in md and '延期A' in md
    # 无风险时给"今日无风险"
    Requirement.objects.filter(title='延期A').delete()
    md2 = build_digest()
    assert '无风险' in md2


@pytest.mark.django_db
def test_digest_version_risk_and_overload():
    m = Member.objects.create(name='张三', week_capacity=10)  # 可用 7h
    Requirement.objects.create(title='大需求', assignee=m, status='in_progress', est_effort=20)  # 超载
    v = Version.objects.create(name='v2.0', freeze_date=date.today() + timedelta(days=2))
    Requirement.objects.create(title='版本内需求', assignee=m, version=v, status='in_progress', est_effort=5)
    md = build_digest()
    assert '超载' in md and '张三' in md
    assert '版本风险' in md and 'v2.0' in md
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_digest.py -v`
Expected: FAIL(`digest` 模块不存在)

- [ ] **Step 3: 创建 digest.py**

Create `backend/apps/core/digest.py`:

```python
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count
from .models import Requirement, Version, Member

PRODUCTIVITY_FACTOR = 0.7  # 与 Capacity.tsx 一致


def _leaves(qs):
    return qs.annotate(nc=Count('children')).filter(nc=0)


def build_digest():
    """构建每日风险摘要 markdown(与 Focus 页阈值一致)。"""
    today = timezone.now().date()
    leaves = _leaves(Requirement.objects.all())
    active = leaves.exclude(status__in=['done', 'paused'])

    overdue = []
    upcoming = []
    for r in active:
        if r.planned_end:
            days = (r.planned_end - today).days
            if days < 0:
                overdue.append((r, days))
            elif days <= 2:
                upcoming.append((r, days))

    blocked = [r for r in leaves if r.blocked_by.exists() or r.status == 'blocked']

    version_risks = []
    for v in Version.objects.all():
        v_leaves = _leaves(v.requirements.all())
        unfinished = v_leaves.exclude(status__in=['done', 'paused']).count()
        for k, label in (('freeze_date', '封板'), ('test_date', '转测')):
            d = getattr(v, k)
            if d and (d - today).days <= 3:
                version_risks.append((v.name, label, d.isoformat(), unfinished))

    overloaded = []
    for m in Member.objects.filter(active=True):
        load = sum(r.est_effort for r in _leaves(Requirement.objects.filter(assignee=m))
                   .exclude(status__in=['done', 'paused']))
        cap = m.week_capacity * PRODUCTIVITY_FACTOR
        if cap > 0 and load > cap:
            overloaded.append((m.name, int(load), int(cap)))

    lines = [f'# 📋 PL 看板 每日风险摘要({today.isoformat()})', '']
    if not (overdue or upcoming or blocked or version_risks or overloaded):
        return '\n'.join(lines + ['✅ 今日无风险,各指标正常。'])

    def section(icon, title, items):
        if not items:
            return []
        out = [f'## {icon} {title} ({len(items)})']
        out += items
        out.append('')
        return out

    lines += section('🔴', '超期',
                     [f'- {r.title} · {(r.assignee.name if r.assignee else "未分配")} · 应完成 {r.planned_end}'
                      for r, _ in overdue])
    lines += section('🟡', '将至(2天内)',
                     [f'- {r.title} · {(r.assignee.name if r.assignee else "未分配")} · {r.planned_end}'
                      for r, _ in upcoming])
    lines += section('🔒', '被阻塞',
                     [f'- {r.title} · {(r.assignee.name if r.assignee else "未分配")}'
                      + (f' · 被{r.blocked_by.count()}项阻塞' if r.blocked_by.exists() else '')
                      for r in blocked])
    lines += section('🏷️', '版本风险(3天内封板/转测)',
                     [f'- {name} {label} {d}' + (f' · {unf}项未完成' if unf else '')
                      for name, label, d, unf in version_risks])
    lines += section('⚠️', '超载成员',
                     [f'- {name} {load}h > 可用{cap}h' for name, load, cap in overloaded])
    return '\n'.join(lines)
```

- [ ] **Step 4: 跑测试**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_digest.py -v`
Expected: 2 passed

- [ ] **Step 5: 跑全量后端**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(digest): daily risk digest builder (v2-B Task 1)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 发送(webhook/邮件)+ daily_digest 命令 + 配置

**Files:**
- Modify: `backend/apps/core/digest.py`
- Modify: `backend/plboard/settings.py`
- Create: `backend/apps/core/management/commands/daily_digest.py`
- Modify: `backend/apps/core/tests/test_digest.py`
- Modify: `README.md`

**Interfaces:**
- Produces: `send_digest()`(读 .env 配置 → POST Server酱 webhook {title,desp} + 发邮件);`manage.py daily_digest` 命令。

- [ ] **Step 1: 写失败测试(发送,mock 网络)**

在 `test_digest.py` 追加:

```python
from unittest.mock import patch, MagicMock


@pytest.mark.django_db
@patch('apps.core.digest.requests.post')
def test_send_digest_posts_to_webhook(mock_post):
    mock_post.return_value = MagicMock(status_code=200)
    with patch('apps.core.digest.build_digest', return_value='# 摘要\n内容'):
        from apps.core.digest import send_digest
        with patch.dict('os.environ', {'NOTIFY_WEBHOOK_URL': 'https://sctapi.ftqq.com/KEY.send'}):
            send_digest()
        assert mock_post.called
        url, kwargs = mock_post.call_args[0][0], mock_post.call_args[1]
        assert 'sctapi.ftqq.com' in url
        assert '摘要' in (kwargs.get('data', {}).get('title') or kwargs.get('json', {}).get('title', ''))


@pytest.mark.django_db
@patch('apps.core.digest.requests.post')
def test_send_digest_noop_without_config(mock_post):
    from apps.core.digest import send_digest
    with patch.dict('os.environ', {}, clear=False):
        # 确保无 webhook 配置时不报错、不发
        import os
        os.environ.pop('NOTIFY_WEBHOOK_URL', None)
        os.environ.pop('NOTIFY_EMAIL_TO', None)
        send_digest()
    assert not mock_post.called
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_digest.py -v`
Expected: FAIL(`send_digest` 不存在)

- [ ] **Step 3: digest.py 加发送函数**

在 `digest.py` 顶部导入加:
```python
import os
import requests
```
文件末尾加:
```python
def _title():
    return f'PL 看板 每日风险摘要({timezone.now().date().isoformat()})'


def send_digest():
    """读 .env 配置,把摘要推到 Server酱 webhook(个人微信)和/或邮件。无配置则静默跳过。"""
    md = build_digest()
    title = _title()
    webhook = os.environ.get('NOTIFY_WEBHOOK_URL', '')
    if webhook:
        try:
            requests.post(webhook, data={'title': title, 'desp': md}, timeout=15)
        except Exception:
            pass  # 推送失败不抛,避免 cron 报错刷屏
    email_to = os.environ.get('NOTIFY_EMAIL_TO', '')
    if email_to:
        try:
            from django.core.mail import send_mail
            send_mail(subject=title, message=md, from_email=os.environ.get('EMAIL_HOST_USER', '') or 'pl-board@local',
                      recipient_list=[email_to], fail_silently=True)
        except Exception:
            pass
```

- [ ] **Step 4: settings.py 加可选 SMTP 配置**

在 settings.py(`REST_FRAMEWORK` 块之后)加:
```python
# 邮件(可选,供每日摘要 NOTIFY_EMAIL_TO 使用;不配则不发邮件)
EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '25'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'False') == 'True'
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False') == 'True'
```

- [ ] **Step 5: 创建 daily_digest management command**

Create `backend/apps/core/management/commands/daily_digest.py`:

```python
from django.core.management.base import BaseCommand
from apps.core.digest import send_digest


class Command(BaseCommand):
    help = '发送每日风险摘要(推送到个人微信 webhook / 邮件)'

    def handle(self, *args, **opts):
        send_digest()
        self.stdout.write(self.style.SUCCESS('每日风险摘要已处理'))
```

- [ ] **Step 6: 跑测试 + 命令冒烟**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_digest.py -v`
Expected: 4 passed(2 build + 2 send)
再跑全量:`cd backend && .venv/bin/python -m pytest -q` → 全绿。
命令冒烟(无配置应静默成功):`cd backend && .venv/bin/python manage.py daily_digest` → 输出"每日风险摘要已处理"。

- [ ] **Step 7: README 加调度说明**

在 README「备份」段之后加:

```markdown
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
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(notify): daily_digest command + ServerChan webhook/email send (v2-B Task 2)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 收尾验证

- [ ] 后端 pytest 全绿;`manage.py daily_digest` 无配置时静默成功。
- [ ] (可选)配 Server酱 sendkey 跑一次 `manage.py daily_digest`,确认微信收到摘要。
- [ ] 备份:`python manage.py backup_db`。
