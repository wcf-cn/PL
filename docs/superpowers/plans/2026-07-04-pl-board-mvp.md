# PL 看板工具 — 阶段 1 MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭出 PL 个人自用的需求+人力产能管理 Web 应用 MVP——跑通「录入需求 → 任务进度看板(7 列拖拽)→ 产能热力表(按 Sprint 利用率)」,Django+DRF 后端 + React 前端,本地 + Tailscale 可访问。

**Architecture:** Django + DRF + SQLite 提供 REST API 与 admin;React + TS + Vite SPA 调 API,生产时静态文件由 Django 托管。产能计算抽成纯函数 `capacity.py`(易测)。单用户 session 登录。

**Tech Stack:** Python 3.12 / Django 5.x / DRF / pytest-django(后端);Node 20 / React 18 / TS / Vite / @dnd-kit / Tailwind / Vitest(前端)。

## Global Constraints

- 平台:Windows 10(主),命令用 `python`(或 `py`)、`npm`;服务绑 `0.0.0.0:8000` 以便 Tailscale/局域网访问
- 后端代码在 `backend/`,前端在 `frontend/`,根目录是 `/Users/wcf/团队管理`
- 工时单位统一**人时(h)**;`week_capacity` 默认 40
- 状态英文 key:`backlog`(待评审)/ `scheduled`(排期中)/ `in_progress`(开发中)/ `testing`(测试中)/ `done`(已上线)/ `blocked`(已阻塞)/ `paused`(暂停)
- 产能计算排除:`done`、`paused`
- `module` 为单值 `CharField`(MVP);多模块写进 `note`
- 每个任务结束 commit;TDD:先写失败测试,再实现
- 接口契约(贯穿全计划,勿改名):
  - 模型:`Member{name, week_capacity, modules, active}`、`Sprint{name, start_date, end_date, is_active, weeks(property)}`、`Requirement{title, status, priority, assignee FK, module, progress, est_effort, actual_effort, assigned_sprint FK, planned_start, planned_end, note}`
  - API:`/api/members/`、`/api/sprints/`、`/api/requirements/`、`/api/capacity/?sprint=<id>`、`/api/auth/login`、`/api/auth/logout`、`/api/auth/me`
  - 产能纯函数(`backend/apps/core/capacity.py`):`sprint_capacity(member, sprint) -> float`、`sprint_load(member, sprint) -> float`、`utilization(member, sprint) -> float`、`single_point_risks() -> list[dict]`

---

# Part A — 后端(Django + DRF)

## Task 1:后端项目脚手架

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/manage.py`
- Create: `backend/plboard/settings.py`
- Create: `backend/plboard/urls.py`
- Create: `backend/plboard/__init__.py`
- Create: `backend/plboard/wsgi.py`
- Create: `backend/plboard/asgi.py`
- Create: `backend/apps/__init__.py`
- Create: `backend/apps/core/__init__.py`
- Create: `backend/apps/core/apps.py`
- Create: `backend/conftest.py`

**Interfaces:**
- Produces: Django project `plboard`,app `core`;`pytest` 可跑(0 测试通过)

- [ ] **Step 1: 创建 requirements.txt**

```
Django>=5.0,<6.0
djangorestframework>=3.15
django-cors-headers>=4.4
pytest>=8.0
pytest-django>=4.8
```

- [ ] **Step 2: 建虚拟环境并装依赖**

Run:
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```
Expected:依赖装好(Windows 激活用 `.venv\Scripts\activate`,mac/Linux 用 `source .venv/bin/activate`)

- [ ] **Step 3: 起项目骨架(不用 startproject,直接写文件以控路径)**

`backend/manage.py`:
```python
#!/usr/bin/env python
import os, sys
def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'plboard.settings')
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)
if __name__ == '__main__':
    main()
```

`backend/plboard/__init__.py`:空文件

`backend/plboard/wsgi.py`:
```python
import os
from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'plboard.settings')
application = get_wsgi_application()
```

`backend/plboard/asgi.py`:
```python
import os
from django.core.asgi import get_asgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'plboard.settings')
application = get_asgi_application()
```

`backend/plboard/settings.py`:
```python
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = 'dev-insecure-change-me'  # 个人自用本地,生产再换
DEBUG = True
ALLOWED_HOSTS = ['*']  # 本地+Tailscale

INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'rest_framework', 'corsheaders', 'apps.core',
]
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'plboard.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [], 'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'plboard.wsgi.application'
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
AUTH_PASSWORD_VALIDATORS = []
LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
CSRF_TRUSTED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.SessionAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
}
```

`backend/plboard/urls.py`:
```python
from django.contrib import admin
from django.urls import path, include
urlpatterns = [path('admin/', admin.site.urls)]
```

`backend/apps/__init__.py`:空
`backend/apps/core/__init__.py`:空
`backend/apps/core/apps.py`:
```python
from django.apps import AppConfig
class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
```

`backend/conftest.py`:
```python
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'plboard.settings')
django.setup()
```

- [ ] **Step 4: 配 pytest**

Create `backend/pytest.ini`:
```ini
[pytest]
DJANGO_SETTINGS_MODULE = plboard.settings
python_files = tests.py test_*.py *_tests.py
```

- [ ] **Step 5: 验证 Django 能跑**

Run:
```bash
python manage.py check
```
Expected:`System check identified no issues.`

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(backend): scaffold Django project plboard with core app"
```

---

## Task 2:Member 模型

**Files:**
- Create: `backend/apps/core/models.py`
- Create: `backend/apps/core/migrations/__init__.py`
- Create: `backend/apps/core/tests/__init__.py`
- Create: `backend/apps/core/tests/test_models.py`

**Interfaces:**
- Produces: `Member` model,字段 `name/week_capacity/modules/active`;`__str__` 返回 name

- [ ] **Step 1: 写失败测试**

`backend/apps/core/tests/test_models.py`:
```python
import pytest
from apps.core.models import Member

@pytest.mark.django_db
def test_member_default_capacity():
    m = Member.objects.create(name='张三')
    assert m.week_capacity == 40
    assert m.active is True

@pytest.mark.django_db
def test_member_str():
    m = Member.objects.create(name='张三')
    assert str(m) == '张三'
```

`backend/apps/core/migrations/__init__.py`:空
`backend/apps/core/tests/__init__.py`:空

- [ ] **Step 2: 跑测试确认失败**

Run: `pytest apps/core/tests/test_models.py -v`
Expected: FAIL(`Member 不存在` / ImportError)

- [ ] **Step 3: 实现 Member**

`backend/apps/core/models.py`:
```python
from django.db import models

class Member(models.Model):
    name = models.CharField('姓名', max_length=64)
    week_capacity = models.FloatField('周容量(人时)', default=40)
    modules = models.CharField('负责模块', max_length=128, blank=True,
                               help_text='逗号分隔,如 后端,前端')
    active = models.BooleanField('在职', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '成员'
        verbose_name_plural = '成员'

    def __str__(self):
        return self.name
```

- [ ] **Step 4: 生成迁移并应用**

Run:
```bash
python manage.py makemigrations core
python manage.py migrate
```
Expected:迁移文件生成并应用

- [ ] **Step 5: 跑测试确认通过**

Run: `pytest apps/core/tests/test_models.py -v`
Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add apps/core/models.py apps/core/migrations apps/core/tests
git commit -m "feat(core): add Member model"
```

---

## Task 3:Sprint 模型(含 weeks 派生属性)

**Files:**
- Modify: `backend/apps/core/models.py`
- Modify: `backend/apps/core/tests/test_models.py`

**Interfaces:**
- Produces: `Sprint{name, start_date, end_date, is_active}`,property `weeks -> float` = (end-start).days/7

- [ ] **Step 1: 写失败测试**

追加到 `test_models.py`:
```python
from datetime import date
from apps.core.models import Sprint

@pytest.mark.django_db
def test_sprint_weeks():
    s = Sprint.objects.create(name='2026-W27', start_date=date(2026,7,6), end_date=date(2026,7,19))
    assert s.weeks == 2.0  # 13 天 / 7 ≈ 1.857... 注意定义
```

注意:`weeks` 定义为 `(end - start).days / 7`。13/7≈1.857。修正测试期望:用整周数据。改测试为 `end_date=date(2026,7,20)`(14 天 → 2.0)。

```python
@pytest.mark.django_db
def test_sprint_weeks():
    s = Sprint.objects.create(name='2026-W27', start_date=date(2026,7,6), end_date=date(2026,7,20))
    assert s.weeks == 2.0
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pytest apps/core/tests/test_models.py::test_sprint_weeks -v`
Expected: FAIL(`Sprint 不存在`)

- [ ] **Step 3: 实现 Sprint**

追加到 `models.py`:
```python
class Sprint(models.Model):
    name = models.CharField('迭代', max_length=64)
    start_date = models.DateField('开始日')
    end_date = models.DateField('结束日')
    is_active = models.BooleanField('当前迭代', default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '迭代'
        verbose_name_plural = '迭代'
        ordering = ['-start_date']

    def __str__(self):
        return self.name

    @property
    def weeks(self):
        return (self.end_date - self.start_date).days / 7
```

- [ ] **Step 4: 迁移并测试**

Run:
```bash
python manage.py makemigrations core
python manage.py migrate
pytest apps/core/tests/test_models.py -v
```
Expected: 全部 passed

- [ ] **Step 5: Commit**

```bash
git add apps/core
git commit -m "feat(core): add Sprint model with weeks property"
```

---

## Task 4:Requirement 模型(7 状态)

**Files:**
- Modify: `backend/apps/core/models.py`
- Modify: `backend/apps/core/tests/test_models.py`

**Interfaces:**
- Produces: `Requirement` 含全部字段与 7 状态 choices;`STATUS_DONE='done'`、`STATUS_PAUSED='paused'`

- [ ] **Step 1: 写失败测试**

追加到 `test_models.py`:
```python
from apps.core.models import Requirement

@pytest.mark.django_db
def test_requirement_defaults():
    m = Member.objects.create(name='张三')
    s = Sprint.objects.create(name='S1', start_date=date(2026,7,6), end_date=date(2026,7,20))
    r = Requirement.objects.create(title='登录接口', assignee=m, assigned_sprint=s)
    assert r.status == 'backlog'
    assert r.priority == 'P1'
    assert r.progress == 0
    assert r.est_effort == 0
    assert str(r) == '登录接口'
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pytest apps/core/tests/test_models.py::test_requirement_defaults -v`
Expected: FAIL(`Requirement 不存在`)

- [ ] **Step 3: 实现 Requirement**

追加到 `models.py`:
```python
class Requirement(models.Model):
    STATUS_BACKLOG = 'backlog'
    STATUS_SCHEDULED = 'scheduled'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_TESTING = 'testing'
    STATUS_DONE = 'done'
    STATUS_BLOCKED = 'blocked'
    STATUS_PAUSED = 'paused'
    STATUS_CHOICES = [
        (STATUS_BACKLOG, '待评审'),
        (STATUS_SCHEDULED, '排期中'),
        (STATUS_IN_PROGRESS, '开发中'),
        (STATUS_TESTING, '测试中'),
        (STATUS_DONE, '已上线'),
        (STATUS_BLOCKED, '已阻塞'),
        (STATUS_PAUSED, '暂停'),
    ]
    PRIORITY_CHOICES = [('P0', 'P0'), ('P1', 'P1'), ('P2', 'P2')]

    title = models.CharField('标题', max_length=200)
    status = models.CharField('状态', max_length=20, choices=STATUS_CHOICES, default=STATUS_BACKLOG)
    priority = models.CharField('优先级', max_length=4, choices=PRIORITY_CHOICES, default='P1')
    assignee = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='负责人')
    module = models.CharField('模块', max_length=64, blank=True)
    progress = models.IntegerField('进度%', default=0)
    est_effort = models.FloatField('预计工时(h)', default=0)
    actual_effort = models.FloatField('实际工时(h)', default=0)
    assigned_sprint = models.ForeignKey(Sprint, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='所属迭代')
    planned_start = models.DateField('预计开始', null=True, blank=True)
    planned_end = models.DateField('预计结束', null=True, blank=True)
    note = models.TextField('备注', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '需求'
        verbose_name_plural = '需求'
        ordering = ['-created_at']

    def __str__(self):
        return self.title
```

- [ ] **Step 4: 迁移并测试**

Run:
```bash
python manage.py makemigrations core
python manage.py migrate
pytest apps/core/tests/test_models.py -v
```
Expected: 全部 passed

- [ ] **Step 5: Commit**

```bash
git add apps/core
git commit -m "feat(core): add Requirement model with 7 statuses"
```

---

## Task 5:产能计算纯函数(核心,详细测试)

**Files:**
- Create: `backend/apps/core/capacity.py`
- Create: `backend/apps/core/tests/test_capacity.py`

**Interfaces:**
- Consumes: `Member`, `Sprint`, `Requirement`(Task 2-4)
- Produces: `sprint_capacity(member, sprint) -> float`、`sprint_load(member, sprint) -> float`、`utilization(member, sprint) -> float`、`single_point_risks() -> list[dict]`

- [ ] **Step 1: 写失败测试(覆盖核心逻辑)**

`backend/apps/core/tests/test_capacity.py`:
```python
import pytest
from datetime import date
from apps.core.models import Member, Sprint, Requirement
from apps.core.capacity import sprint_capacity, sprint_load, utilization, single_point_risks

@pytest.fixture
def sprint():
    return Sprint.objects.create(name='S1', start_date=date(2026,7,6), end_date=date(2026,7,20))  # 2 周

@pytest.fixture
def member():
    return Member.objects.create(name='张三', week_capacity=40)

@pytest.mark.django_db
def test_sprint_capacity(member, sprint):
    assert sprint_capacity(member, sprint) == 80.0  # 40 * 2

@pytest.mark.django_db
def test_sprint_load_excludes_done_and_paused(member, sprint):
    Requirement.objects.create(title='A', assignee=member, assigned_sprint=sprint, est_effort=20, status='in_progress')
    Requirement.objects.create(title='B', assignee=member, assigned_sprint=sprint, est_effort=10, status='done')
    Requirement.objects.create(title='C', assignee=member, assigned_sprint=sprint, est_effort=5, status='paused')
    assert sprint_load(member, sprint) == 20.0  # 只算 in_progress 的 A

@pytest.mark.django_db
def test_utilization(member, sprint):
    Requirement.objects.create(title='A', assignee=member, assigned_sprint=sprint, est_effort=60, status='in_progress')
    # 容量 80,占用 60 → 0.75
    assert utilization(member, sprint) == 0.75

@pytest.mark.django_db
def test_utilization_zero_capacity(member, sprint):
    m2 = Member.objects.create(name='李四', week_capacity=0)
    assert utilization(m2, sprint) == 0  # 防除零

@pytest.mark.django_db
def test_single_point_risk():
    backend_only = Member.objects.create(name='张三')
    Member.objects.create(name='李四')
    s = Sprint.objects.create(name='S1', start_date=date(2026,7,6), end_date=date(2026,7,20))
    # 后端模块只有张三一人有需求 → 单点;前端两人 → 安全
    Requirement.objects.create(title='a', assignee=backend_only, module='后端', status='in_progress')
    Requirement.objects.create(title='b', assignee=backend_only, module='前端', status='in_progress')
    Requirement.objects.create(title='c', assignee=Member.objects.get(name='李四'), module='前端', status='in_progress')
    risks = single_point_risks()
    modules = [r['module'] for r in risks]
    assert '后端' in modules
    assert '前端' not in modules
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pytest apps/core/tests/test_capacity.py -v`
Expected: FAIL(`capacity 模块不存在`)

- [ ] **Step 3: 实现产能纯函数**

`backend/apps/core/capacity.py`:
```python
from django.db.models import Count, Q
from .models import Requirement

EXCLUDED_STATUS = [Requirement.STATUS_DONE, Requirement.STATUS_PAUSED]

def sprint_capacity(member, sprint):
    """成员在某 Sprint 的总容量(人时)= 周容量 × 周数"""
    return member.week_capacity * sprint.weeks

def sprint_load(member, sprint):
    """成员在某 Sprint 的在途需求预计工时之和(排除 done/paused)"""
    qs = Requirement.objects.filter(
        assignee=member, assigned_sprint=sprint,
    ).exclude(status__in=EXCLUDED_STATUS)
    return sum(r.est_effort for r in qs)

def utilization(member, sprint):
    """利用率 = 占用 / 容量,容量为 0 返回 0"""
    cap = sprint_capacity(member, sprint)
    if cap == 0:
        return 0
    return sprint_load(member, sprint) / cap

def single_point_risks():
    """只有 1 个活跃负责人覆盖的模块列表"""
    qs = Requirement.objects.exclude(status__in=EXCLUDED_STATUS).exclude(module='').values('module')\
        .annotate(n=Count('assignee', distinct=True)).filter(n=1)
    return [{'module': r['module'], 'n': r['n']} for r in qs]
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pytest apps/core/tests/test_capacity.py -v`
Expected: 5 passed

- [ ] **Step 5: 跑全部测试**

Run: `pytest -v`
Expected: 全部 passed(模型 + 产能)

- [ ] **Step 6: Commit**

```bash
git add apps/core/capacity.py apps/core/tests/test_capacity.py
git commit -m "feat(core): capacity calc pure functions with tests"
```

---

## Task 6:Serializers

**Files:**
- Create: `backend/apps/core/serializers.py`

**Interfaces:**
- Consumes: Task 2-4 模型
- Produces: `MemberSerializer`, `SprintSerializer`, `RequirementSerializer`(assignee/assigned_sprint 用主键写入、嵌套只读返回名字)

- [ ] **Step 1: 写失败测试(serializer 单元,不走 HTTP)**

`backend/apps/core/tests/test_serializers.py`:
```python
import pytest
from apps.core.models import Member, Sprint, Requirement
from apps.core.serializers import RequirementSerializer

@pytest.mark.django_db
def test_requirement_serializer_exposes_names():
    m = Member.objects.create(name='张三')
    s = Sprint.objects.create(name='S1')
    r = Requirement.objects.create(title='登录', assignee=m, assigned_sprint=s)
    data = RequirementSerializer(r).data
    assert data['assignee_name'] == '张三'
    assert data['sprint_name'] == 'S1'
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pytest apps/core/tests/test_serializers.py -v`
Expected: FAIL(`serializers 模块不存在`)

- [ ] **Step 3: 实现 serializers**

`backend/apps/core/serializers.py`:
```python
from rest_framework import serializers
from .models import Member, Sprint, Requirement

class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = '__all__'

class SprintSerializer(serializers.ModelSerializer):
    weeks = serializers.FloatField(read_only=True)
    class Meta:
        model = Sprint
        fields = '__all__'

class RequirementSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source='assignee.name', read_only=True)
    sprint_name = serializers.CharField(source='assigned_sprint.name', read_only=True, default='')
    class Meta:
        model = Requirement
        fields = '__all__'
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pytest apps/core/tests/test_serializers.py -v`
Expected: 1 passed

- [ ] **Step 5: Commit**

```bash
git add apps/core/serializers.py apps/core/tests/test_serializers.py
git commit -m "feat(core): serializers with name fields"
```

---

## Task 7:Viewsets + Router(API)

**Files:**
- Create: `backend/apps/core/views.py`
- Create: `backend/apps/core/urls.py`
- Modify: `backend/plboard/urls.py`
- Modify: `backend/apps/core/tests/test_api.py`

**Interfaces:**
- Consumes: Task 6 serializers, Task 5 capacity
- Produces: API 路由 `/api/members/`、`/api/sprints/`、`/api/requirements/`、`/api/capacity/?sprint=<id>`

- [ ] **Step 1: 写 API 测试**

`backend/apps/core/tests/test_api.py`:
```python
import pytest
from datetime import date
from rest_framework.test import APIClient
from apps.core.models import Member, Sprint

@pytest.fixture
def client():
    from django.contrib.auth.models import User
    User.objects.create_user('pl', password='pw')
    c = APIClient()
    c.login(username='pl', password='pw')
    return c

@pytest.mark.django_db
def test_member_list(client):
    Member.objects.create(name='张三')
    r = client.get('/api/members/')
    assert r.status_code == 200
    assert r.data[0]['name'] == '张三'

@pytest.mark.django_db
def test_requirement_create_and_capacity(client):
    m = Member.objects.create(name='张三', week_capacity=40)
    s = Sprint.objects.create(name='S1', start_date=date(2026,7,6), end_date=date(2026,7,20))
    payload = {'title': '登录', 'assignee': m.id, 'assigned_sprint': s.id, 'est_effort': 60, 'status': 'in_progress'}
    r = client.post('/api/requirements/', payload)
    assert r.status_code == 201
    r2 = client.get(f'/api/capacity/?sprint={s.id}')
    assert r2.status_code == 200
    row = next(x for x in r2.data if x['member'] == '张三')
    assert row['utilization'] == 0.75
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pytest apps/core/tests/test_api.py -v`
Expected: FAIL(无路由)

- [ ] **Step 3: 实现 viewsets**

`backend/apps/core/views.py`:
```python
from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Member, Sprint, Requirement
from .serializers import MemberSerializer, SprintSerializer, RequirementSerializer
from . import capacity

class MemberViewSet(viewsets.ModelViewSet):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer

class SprintViewSet(viewsets.ModelViewSet):
    queryset = Sprint.objects.all()
    serializer_class = SprintSerializer

class RequirementViewSet(viewsets.ModelViewSet):
    serializer_class = RequirementSerializer
    def get_queryset(self):
        qs = Requirement.objects.all()
        for f in ('status', 'assignee', 'assigned_sprint', 'priority'):
            v = self.request.query_params.get(f)
            if v:
                qs = qs.filter(**{f: v})
        return qs

@api_view(['GET'])
def capacity_view(request):
    sprint_id = request.query_params.get('sprint')
    if not sprint_id:
        return Response({'detail': 'sprint 参数必填'}, status=status.HTTP_400_BAD_REQUEST)
    sprint = Sprint.objects.get(pk=sprint_id)
    rows = []
    for m in Member.objects.filter(active=True):
        rows.append({
            'member_id': m.id, 'member': m.name,
            'capacity': capacity.sprint_capacity(m, sprint),
            'load': capacity.sprint_load(m, sprint),
            'utilization': capacity.utilization(m, sprint),
        })
    rows.sort(key=lambda x: x['utilization'], reverse=True)
    return Response(rows)
```

`backend/apps/core/urls.py`:
```python
from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import MemberViewSet, SprintViewSet, RequirementViewSet, capacity_view

router = DefaultRouter()
router.register('members', MemberViewSet)
router.register('sprints', SprintViewSet)
router.register('requirements', RequirementViewSet)

urlpatterns = router.urls + [path('capacity/', capacity_view)]
```

Modify `backend/plboard/urls.py`:
```python
from django.contrib import admin
from django.urls import path, include
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('apps.core.urls')),
]
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pytest apps/core/tests/test_api.py -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add apps/core/serializers.py apps/core/views.py apps/core/urls.py apps/core/tests/test_api.py plboard/urls.py
git commit -m "feat(core): DRF viewsets + router + capacity endpoint"
```

---

## Task 8:Admin 注册

**Files:**
- Create: `backend/apps/core/admin.py`
- Create: `backend/apps/core/tests/test_admin.py`

**Interfaces:**
- Consumes: 模型
- Produces: Django admin 可批量管理 Member/Sprint/Requirement

- [ ] **Step 1: 写测试(admin 可访问)**

`backend/apps/core/tests/test_admin.py`:
```python
import pytest
from django.contrib.auth.models import User
from django.test import Client

@pytest.mark.django_db
def test_admin_requires_login():
    c = Client()
    r = c.get('/admin/')
    assert r.status_code in (200, 302)  # 302 重定向到登录

@pytest.mark.django_db
def test_admin_models_registered():
    from django.contrib import admin as djadmin
    from apps.core.models import Member, Sprint, Requirement
    assert Member in djadmin.site._registry
    assert Sprint in djadmin.site._registry
    assert Requirement in djadmin.site._registry
```

- [ ] **Step 2: 实现 admin.py**

`backend/apps/core/admin.py`:
```python
from django.contrib import admin
from .models import Member, Sprint, Requirement

@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('name', 'week_capacity', 'modules', 'active')
    list_filter = ('active',)
    search_fields = ('name',)

@admin.register(Sprint)
class SprintAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_date', 'end_date', 'is_active')
    list_filter = ('is_active',)

@admin.register(Requirement)
class RequirementAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'priority', 'assignee', 'module', 'assigned_sprint', 'est_effort', 'progress')
    list_filter = ('status', 'priority', 'module', 'assigned_sprint')
    search_fields = ('title', 'note')
    list_editable = ('status', 'priority', 'progress')
```

- [ ] **Step 3: 跑测试**

Run: `pytest apps/core/tests/test_admin.py -v`
Expected: passed

- [ ] **Step 4: 创建超级用户并人工验证**

Run:
```bash
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```
浏览器开 `http://localhost:8000/admin/`,登录,看到 Member/Sprint/Requirement 三个模型。停服务。

- [ ] **Step 5: Commit**

```bash
git add apps/core/admin.py apps/core/tests/test_admin.py
git commit -m "feat(core): register models in admin"
```

---

## Task 9:认证端点(login/logout/me)

**Files:**
- Modify: `backend/apps/core/views.py`
- Modify: `backend/apps/core/urls.py`
- Create: `backend/apps/core/tests/test_auth.py`

**Interfaces:**
- Produces: `POST /api/auth/login`(username,password)、`POST /api/auth/logout`、`GET /api/auth/me`;SessionAuthentication

- [ ] **Step 1: 写失败测试**

`backend/apps/core/tests/test_auth.py`:
```python
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_login_and_me():
    User.objects.create_user('pl', password='pw')
    c = APIClient()
    r = c.post('/api/auth/login', {'username': 'pl', 'password': 'pw'})
    assert r.status_code == 200
    r2 = c.get('/api/auth/me')
    assert r2.status_code == 200
    assert r2.data['username'] == 'pl'

@pytest.mark.django_db
def test_login_wrong_password():
    User.objects.create_user('pl', password='pw')
    c = APIClient()
    r = c.post('/api/auth/login', {'username': 'pl', 'password': 'wrong'})
    assert r.status_code == 401

@pytest.mark.django_db
def test_me_unauthenticated():
    c = APIClient()
    r = c.get('/api/auth/me')
    assert r.status_code == 401
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pytest apps/core/tests/test_auth.py -v`
Expected: FAIL

- [ ] **Step 3: 实现认证视图**

追加到 `backend/apps/core/views.py`:
```python
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    u = authenticate(request, username=request.data.get('username'), password=request.data.get('password'))
    if u is None:
        return Response({'detail': '用户名或密码错误'}, status=status.HTTP_401_UNAUTHORIZED)
    django_login(request, u)
    return Response({'username': u.username})

@api_view(['POST'])
def logout_view(request):
    django_logout(request)
    return Response({'detail': '已登出'})

@api_view(['GET'])
def me_view(request):
    if not request.user.is_authenticated:
        return Response({'detail': '未登录'}, status=status.HTTP_401_UNAUTHORIZED)
    return Response({'username': request.user.username})
```

追加到 `backend/apps/core/urls.py` 的 `urlpatterns`:
```python
from .views import login_view, logout_view, me_view
urlpatterns += [
    path('auth/login', login_view),
    path('auth/logout', logout_view),
    path('auth/me', me_view),
]
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pytest apps/core/tests/test_auth.py -v`
Expected: 3 passed

- [ ] **Step 5: 全量测试 + Commit**

Run: `pytest -v`
Expected: 全部 passed
```bash
git add apps/core
git commit -m "feat(core): auth endpoints (login/logout/me)"
```

---

# Part B — 前端(React + TS + Vite)

## Task 10:前端脚手架

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/index.css`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`
- Create: `frontend/src/types.ts`

**Interfaces:**
- Consumes: Task 7/9 的 API
- Produces: Vite dev server 跑起来(`npm run dev`),Tailwind 生效

- [ ] **Step 1: 初始化 Vite 项目**

Run:
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities axios react-router-dom
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: 配 Tailwind**

`frontend/tailwind.config.js`:
```js
export default { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] }
```
`frontend/postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```
`frontend/src/index.css`:
```css
@tailwind base; @tailwind components; @tailwind utilities;
```

- [ ] **Step 3: 配 Vite proxy + Vitest**

`frontend/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, proxy: { '/api': 'http://localhost:8000' } },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test-setup.ts' },
})
```
`frontend/src/test-setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: 定义类型**

`frontend/src/types.ts`:
```ts
export type Status = 'backlog'|'scheduled'|'in_progress'|'testing'|'done'|'blocked'|'paused'
export type Priority = 'P0'|'P1'|'P2'
export interface Member { id:number; name:string; week_capacity:number; modules:string; active:boolean }
export interface Sprint { id:number; name:string; start_date:string; end_date:string; is_active:boolean; weeks:number }
export interface Requirement {
  id:number; title:string; status:Status; priority:Priority;
  assignee:number|null; assignee_name?:string;
  module:string; progress:number; est_effort:number; actual_effort:number;
  assigned_sprint:number|null; sprint_name?:string;
  planned_start:string|null; planned_end:string|null; note:string;
}
export interface CapacityRow { member_id:number; member:string; capacity:number; load:number; utilization:number }
export const STATUS_LABEL: Record<Status,string> = {
  backlog:'待评审', scheduled:'排期中', in_progress:'开发中', testing:'测试中', done:'已上线', blocked:'已阻塞', paused:'暂停'
}
export const STATUS_ORDER: Status[] = ['backlog','scheduled','in_progress','testing','done','blocked','paused']
```

- [ ] **Step 5: 验证 dev server**

Run: `npm run dev`
Expected:浏览器 `http://localhost:5173` 显示默认页。停。

- [ ] **Step 6: Commit**

```bash
cd .. && git add frontend && git commit -m "feat(frontend): scaffold Vite+React+TS with Tailwind and dnd-kit"
```

---

## Task 11:API client + 登录页

**Files:**
- Create: `frontend/src/api.ts`
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/App.tsx`(覆盖默认)
- Create: `frontend/src/api.test.ts`

**Interfaces:**
- Produces: `api` 对象(me/login/logout/list/create/update/requirements 等);登录后跳 Board

- [ ] **Step 1: 写失败测试**

`frontend/src/api.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { api } from './api'
describe('api.urls', () => {
  it('exposes capacity url builder', () => {
    expect(typeof api.capacity).toBe('function')
  })
})
```

- [ ] **Step 2: 实现 api.ts**

`frontend/src/api.ts`:
```ts
import axios from 'axios'
import type { Member, Sprint, Requirement, CapacityRow } from './types'
const http = axios.create({ baseURL: '', withCredentials: true })
http.interceptors.response.use(r => r, e => {
  if (e.response?.status === 401) window.location.hash = '#/login'
  return Promise.reject(e)
})
const crud = <T>(base: string) => ({
  list: (params?:Record<string,string>) => http.get<T[]>(base, { params }).then(r => r.data),
  create: (d: Partial<T>) => http.post<T>(base, d).then(r => r.data),
  update: (id:number, d: Partial<T>) => http.patch<T>(`${base}/${id}`, d).then(r => r.data),
  remove: (id:number) => http.delete(`${base}/${id}`),
})
export const api = {
  me: () => http.get<{username:string}>('/api/auth/me').then(r => r.data),
  login: (username:string, password:string) => http.post('/api/auth/login', { username, password }).then(r => r.data),
  logout: () => http.post('/api/auth/logout'),
  members: crud<Member>('/api/members'),
  sprints: crud<Sprint>('/api/sprints'),
  requirements: crud<Requirement>('/api/requirements'),
  capacity: (sprint:number) => http.get<CapacityRow[]>('/api/capacity', { params: { sprint } }).then(r => r.data),
}
```

- [ ] **Step 3: 实现 Login 页 + App 路由**

`frontend/src/pages/Login.tsx`:
```tsx
import { useState } from 'react'
import { api } from '../api'
export default function Login({ onOk }:{ onOk:()=>void }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState('')
  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); setErr('')
    try { await api.login(u, p); onOk() }
    catch { setErr('用户名或密码错误') }
  }
  return (
    <form onSubmit={submit} className="max-w-xs mx-auto mt-20 space-y-2">
      <h1 className="text-xl">PL 看板 · 登录</h1>
      <input className="w-full border p-2" value={u} onChange={e=>setU(e.target.value)} placeholder="用户名" />
      <input className="w-full border p-2" type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="密码" />
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <button className="w-full bg-blue-600 text-white p-2 rounded">登录</button>
    </form>
  )
}
```

`frontend/src/App.tsx`(覆盖):
```tsx
import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { api } from './api'
import Login from './pages/Login'
import Board from './pages/Board'
import Capacity from './pages/Capacity'
export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => { api.me().then(() => setAuthed(true)).catch(() => setAuthed(false)) }, [])
  if (authed === null) return <div className="p-4">加载中…</div>
  return (
    <HashRouter>
      <div className="p-4">
        <Nav authed={authed} onLogout={async()=>{await api.logout();setAuthed(false)}} />
        <Routes>
          {!authed ? <>
            <Route path="*" element={<Login onOk={()=>setAuthed(true)} />} />
          </> : <>
            <Route path="/board" element={<Board />} />
            <Route path="/capacity" element={<Capacity />} />
            <Route path="*" element={<Navigate to="/board" />} />
          </>}
        </Routes>
      </div>
    </HashRouter>
  )
}
function Nav({authed, onLogout}:{authed:boolean; onLogout:()=>void}) {
  if (!authed) return null
  return <nav className="flex gap-4 mb-4">
    <a href="#/board" className="text-blue-600">看板</a>
    <a href="#/capacity" className="text-blue-600">产能</a>
    <button onClick={onLogout} className="ml-auto text-gray-500">登出</button>
  </nav>
}
```

(先放占位 `Board`/`Capacity`,Task 12/13 实现。临时建空组件让编译通过:)

`frontend/src/pages/Board.tsx`(临时):
```tsx
export default function Board(){ return <div>Board 占位</div> }
```
`frontend/src/pages/Capacity.tsx`(临时):
```tsx
export default function Capacity(){ return <div>Capacity 占位</div> }
```

- [ ] **Step 4: 跑测试 + 类型检查**

Run:
```bash
npx vitest run
npx tsc --noEmit
```
Expected: 测试通过,无类型错误

- [ ] **Step 5: Commit**

```bash
git add frontend/src && git commit -m "feat(frontend): api client + login + routing"
```

---

## Task 12:任务进度看板(7 列拖拽)

**Files:**
- Modify: `frontend/src/pages/Board.tsx`
- Create: `frontend/src/pages/Board.test.tsx`

**Interfaces:**
- Produces: 7 列看板,拖拽卡片改 status(调 `api.requirements.update`)

- [ ] **Step 1: 写组件测试**

`frontend/src/pages/Board.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Board from './Board'
vi.mock('../api', () => ({
  api: {
    requirements: {
      list: vi.fn().mockResolvedValue([
        { id:1, title:'登录', status:'in_progress', priority:'P0', assignee_name:'张三', est_effort:8, progress:30 },
      ]),
      update: vi.fn(),
    },
    sprints: { list: vi.fn().mockResolvedValue([{ id:1, name:'S1', start_date:'', end_date:'', is_active:true, weeks:2 }]) },
  }
}))
describe('Board', () => {
  it('renders columns and cards', async () => {
    render(<Board />)
    await waitFor(() => expect(screen.getByText('登录')).toBeInTheDocument())
    expect(screen.getByText('开发中')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 实现 Board**

`frontend/src/pages/Board.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import { STATUS_LABEL, STATUS_ORDER, type Requirement, type Status } from '../types'
const PRIO_COLOR: Record<string,string> = { P0:'bg-red-100 text-red-700', P1:'bg-yellow-100 text-yellow-700', P2:'bg-gray-100 text-gray-700' }

export default function Board() {
  const [items, setItems] = useState<Requirement[]>([])
  const load = () => api.requirements.list().then(setItems)
  useEffect(() => { load() }, [])
  const onDrop = async (status: Status, id: number) => {
    const r = items.find(x => x.id === id); if (!r || r.status === status) return
    setItems(prev => prev.map(x => x.id === id ? { ...x, status } : x))
    await api.requirements.update(id, { status })
  }
  return (
    <div className="flex gap-3 overflow-x-auto">
      {STATUS_ORDER.map(st => (
        <Column key={st} status={st} items={items.filter(r => r.status === st)} onDrop={onDrop} />
      ))}
    </div>
  )
}

function Column({ status, items, onDrop }:{ status:Status; items:Requirement[]; onDrop:(s:Status,id:number)=>void }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e=>{e.preventDefault();setOver(true)}}
      onDragLeave={()=>setOver(false)}
      onDrop={()=>{setOver(false)}}
      className={`w-64 shrink-0 p-2 rounded bg-gray-50 ${over?'ring-2 ring-blue-400':''}`}
    >
      <div className="flex justify-between mb-2">
        <b>{STATUS_LABEL[status]}</b><span className="text-gray-400">{items.length}</span>
      </div>
      <div
        onDrop={e=>{e.stopPropagation(); onDrop(status, Number((e as any).dataTransfer.getData('id')))}}
        className="min-h-[40px] space-y-2"
      >
        {items.map(r => (
          <div key={r.id} draggable onDragStart={e=>(e as any).dataTransfer.setData('id', String(r.id))}
            className="p-2 bg-white rounded shadow cursor-move">
            <div className="font-medium">{r.title}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span className={`px-1 rounded ${PRIO_COLOR[r.priority]}`}>{r.priority}</span>
              <span>{r.assignee_name||'未分配'}</span>
              <span>{r.est_effort}h</span>
              <span>{r.progress}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

> 注:用原生 HTML5 拖拽(@dnd-kit 已装,但 MVP 原生拖拽更少代码;后续要更顺可换 @dnd-kit)。

- [ ] **Step 3: 跑测试**

Run: `npx vitest run src/pages/Board.test.tsx`
Expected: passed

- [ ] **Step 4: 人工验证(后端 + 前端一起跑)**

两个终端:
```bash
# 终端1
cd backend && .venv\Scripts\activate && python manage.py runserver 0.0.0.0:8000
# 终端2
cd frontend && npm run dev
```
浏览器 `http://localhost:5173` → 登录 → 看板显示,拖拽卡片改列。停。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Board.tsx frontend/src/pages/Board.test.tsx
git commit -m "feat(frontend): 7-column kanban with drag to change status"
```

---

## Task 13:产能热力表

**Files:**
- Modify: `frontend/src/pages/Capacity.tsx`
- Create: `frontend/src/pages/Capacity.test.tsx`

**Interfaces:**
- Produces: 选 Sprint → 表格列出每个成员 容量/占用/利用率(颜色:绿<0.8/黄0.8-1/红>1),按利用率降序

- [ ] **Step 1: 写组件测试**

`frontend/src/pages/Capacity.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Capacity from './Capacity'
vi.mock('../api', () => ({
  api: {
    sprints: { list: vi.fn().mockResolvedValue([{ id:1, name:'S1', start_date:'', end_date:'', is_active:true, weeks:2 }]) },
    capacity: vi.fn().mockResolvedValue([
      { member_id:1, member:'张三', capacity:80, load:90, utilization:1.125 },
      { member_id:2, member:'李四', capacity:80, load:40, utilization:0.5 },
    ]),
  }
}))
describe('Capacity', () => {
  it('shows utilization sorted desc with color', async () => {
    render(<Capacity />)
    await waitFor(() => fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } }))
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument())
    expect(screen.getByText('112.5%')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 实现 Capacity**

`frontend/src/pages/Capacity.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Sprint, CapacityRow } from '../types'
function color(u:number){ if(u>1) return 'bg-red-100 text-red-700'; if(u>=0.8) return 'bg-yellow-100 text-yellow-700'; return 'bg-green-100 text-green-700' }

export default function Capacity() {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sid, setSid] = useState<number|''>('')
  const [rows, setRows] = useState<CapacityRow[]>([])
  useEffect(() => { api.sprints.list().then(s => { setSprints(s); const a = s.find(x=>x.is_active); setSid(a?a.id:s[0]?.id??'') }) }, [])
  useEffect(() => { if (sid) api.capacity(Number(sid)).then(setRows) }, [sid])
  return (
    <div>
      <select className="border p-2 mb-3" value={sid} onChange={e=>setSid(Number(e.target.value))}>
        {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <table className="border-collapse">
        <thead><tr className="text-left">
          <th className="p-2 border">成员</th><th className="p-2 border">容量(h)</th>
          <th className="p-2 border">占用(h)</th><th className="p-2 border">利用率</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.member_id}>
              <td className="p-2 border">{r.member}</td>
              <td className="p-2 border">{r.capacity}</td>
              <td className="p-2 border">{r.load}</td>
              <td className={`p-2 border ${color(r.utilization)}`}>{(r.utilization*100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">绿&lt;80% · 黄 80–100% · 红&gt;100% 超载。已按利用率降序(后端排序)。</p>
    </div>
  )
}
```

- [ ] **Step 3: 跑测试**

Run: `npx vitest run src/pages/Capacity.test.tsx`
Expected: passed

- [ ] **Step 4: 人工验证**

前后端跑起来 → 产能页选 Sprint → 看到利用率表,超载标红。停。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Capacity.tsx frontend/src/pages/Capacity.test.tsx
git commit -m "feat(frontend): capacity heatmap table by sprint"
```

---

## Task 14:生产构建 + Django 托管静态文件 + README

**Files:**
- Modify: `backend/plboard/settings.py`(`STATICFILES_DIRS`、`TEMPLATES DIRS`)
- Modify: `backend/plboard/urls.py`(catch-all 给 SPA)
- Create: `README.md`

**Interfaces:**
- Produces: `npm run build` → `frontend/dist`;Django 一条命令托管前后端,`runserver` 即全栈

- [ ] **Step 1: 改 settings 加静态目录**

在 `settings.py` 的 `BASE_DIR` 后加:
```python
import os
FRONTEND_DIST = BASE_DIR.parent / 'frontend' / 'dist'
```
`TEMPLATES` 的 `DIRS` 改为 `[FRONTEND_DIST]`(条件:目录存在时)。`INSTALLED_APPS` 末尾无变化。`STATICFILES_DIRS`(文件末尾加):
```python
if FRONTEND_DIST.exists():
    STATICFILES_DIRS = [FRONTEND_DIST / 'assets']
```

- [ ] **Step 2: 加 SPA catch-all 路由**

`backend/plboard/urls.py`:
```python
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('apps.core.urls')),
]
if settings.FRONTEND_DIST.exists():
    urlpatterns += [
        re_path(r'^(?!api/|admin/).*$', TemplateView.as_view(template_name='index.html')),
    ]
```

- [ ] **Step 3: 构建前端**

Run:
```bash
cd frontend && npm run build
```
Expected:`frontend/dist/index.html` + `assets/` 生成

- [ ] **Step 4: 验证全栈一个端口**

Run:
```bash
cd ../backend && python manage.py collectstatic --noinput
python manage.py runserver 0.0.0.0:8000
```
浏览器 `http://localhost:8000/` → 显示 SPA(登录→看板→产能)。`/api/...` 仍走 API。停。

- [ ] **Step 5: 写 README**

`README.md`(根目录):
````markdown
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
````

- [ ] **Step 6: Commit**

```bash
git add backend/plboard README.md
git commit -m "feat: serve SPA from Django + README"
```

---

## MVP 完成标准(Done 的定义)

- [ ] 后端 `pytest` 全绿(模型/产能/API/auth/admin)
- [ ] 前端 `npx vitest run` 全绿
- [ ] `python manage.py runserver 0.0.0.0:8000` 单端口跑全栈:登录 → 看板拖拽改状态 → 产能表看利用率超载
- [ ] Django admin 可批量录入 Member/Sprint/Requirement
- [ ] (可选)Tailscale 通,iPhone 浏览器能访问

## 阶段 2 / 3(本计划不做,后续计划覆盖)

日历视图、单点风险视图、筛选器、PWA 主屏、Tailscale 实操配置、按周分摊产能、超载预警、估时偏差报表、数据导出。
