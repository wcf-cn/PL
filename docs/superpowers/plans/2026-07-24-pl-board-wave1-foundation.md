# PL 看板 Wave 1 — 地基(数字可信 + Sprint 大扫除)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让产能/燃尽的数字可信(修 double-count / 假落后 / 漏天 / 假 progress),并彻底清除已废弃的 Sprint 维度与孤儿后端代码。

**Architecture:** 5 个原子任务,每个任务结束都让全栈测试 green。先做后端 Sprint+死代码清除(含数据 migration),再做前端清除,再做三处计算修正(后端快照、燃尽、产能)。备份已在 Wave 0 就位,可放心 migrate。

**Tech Stack:** Django + DRF + SQLite(后端,pytest-django),React + TypeScript + Vite(前端,vitest),recharts。

## Global Constraints

- 纯单人自用,严守 YAGNI。
- 后端测试:`cd backend && .venv/bin/python -m pytest`(或 `python manage.py test`)。
- 前端测试:`cd frontend && npx vitest run`。
- 每个 commit 走 Conventional Commits(`feat/fix/refactor/docs/chore(scope): ...`)。
- 数据库备份命令已存在:`python manage.py backup_db`。Task 1 跑 migration 前先备份一次。
- 工时单位统一人时(h)。
- **Rollup 语义(全局)**:汇总某人剩余工时/负载时,只算**叶子需求**(没有子需求的需求)。父需求的工时视为其子任务的总和(分解),不计入,避免 double-count。判定叶子:后端 `qs.annotate(nc=Count('children')).filter(nc=0)`;前端 `reqs.filter(r => !reqs.some(c => c.parent === r.id))`。

---

## File Structure

后端(`backend/apps/core/`):
- `models.py` — 删除 `Sprint`、`BurndownSnapshot`、`Requirement.assigned_sprint`。
- `views.py` — 删除 `SprintViewSet`/`capacity_view`/`burndown_view`;`snapshots_view` 改叶子+update_or_create;`ai_chat` 去掉 sprint。
- `urls.py` — 删 `sprints`/`capacity`/`burndown` 路由。
- `capacity.py` — **整文件删除**(含 `single_point_risks`,Wave 5 项提前完成)。
- `serializers.py` — 删 `SprintSerializer`、`RequirementSerializer.sprint_name`。
- `admin.py` — 删 `SprintAdmin`、`assigned_sprint` 列。
- `ai.py` — `build_system_prompt(members, modules)` 去 sprint。
- `ai_actions.py` — 删 `_resolve_sprint`/`create_sprint`/`update_sprint`/`assigned_sprint` 处理。
- `migrations/0008_remove_sprint.py` — 新增(RemoveField + 2× DeleteModel)。
- `tests/` — 删 `test_capacity.py`/`test_burndown.py`;改 `test_api.py`/`test_models.py`/`test_serializers.py`/`test_admin.py`/`test_ai_actions.py`/`test_ai.py`;新增 `test_cleanup.py`、`test_snapshots.py` 扩展。

前端(`frontend/src/`):
- `types.ts` — 删 `Sprint`/`BurndownSprint`/`BurndownData`/`CapacityRow`/`calcProgress`;`Requirement` 去 `assigned_sprint`/`sprint_name`;`Draft` 去 `assigned_sprint`。
- `api.ts` — 删 `sprints`/`capacity`/`burndown`。
- `pages/Board.tsx` — 去 Sprint/calcProgress;`progress` 改手动五档选择。
- `pages/Burndown.tsx` — 叶子 rollup + actual/ideal 同口径。
- `pages/Capacity.tsx` — 叶子 rollup + productivity 折算。

---

## Task 1: 后端清除 Sprint + 孤儿代码

**Files:**
- Modify: `backend/apps/core/models.py`
- Modify: `backend/apps/core/views.py`
- Modify: `backend/apps/core/urls.py`
- Modify: `backend/apps/core/serializers.py`
- Modify: `backend/apps/core/admin.py`
- Modify: `backend/apps/core/ai.py`
- Modify: `backend/apps/core/ai_actions.py`
- Delete: `backend/apps/core/capacity.py`
- Create: `backend/apps/core/migrations/0008_remove_sprint.py`
- Create: `backend/apps/core/tests/test_cleanup.py`
- Delete: `backend/apps/core/tests/test_capacity.py`, `backend/apps/core/tests/test_burndown.py`
- Modify: `backend/apps/core/tests/test_api.py`, `test_models.py`, `test_serializers.py`, `test_admin.py`, `test_ai_actions.py`, `test_ai.py`

**Interfaces:**
- Produces: `build_system_prompt(members, modules)`(去掉 sprint 参数);`MemberDailySnapshot.objects.update_or_create(...)`;models 不再有 `Sprint`/`BurndownSnapshot`/`assigned_sprint`。

- [ ] **Step 1: 先备份 DB(migration 前的安全网)**

Run: `backend/.venv/bin/python backend/manage.py backup_db`
Expected: `备份完成: ...db-...sqlite3`

- [ ] **Step 2: 写失败测试 `test_cleanup.py`**

Create `backend/apps/core/tests/test_cleanup.py`:

```python
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.fixture
def client():
    User.objects.create_user('pl', password='pw')
    c = APIClient(); c.login(username='pl', password='pw')
    return c


def test_sprint_and_burndown_snapshot_models_removed():
    from apps.core import models
    assert not hasattr(models, 'Sprint')
    assert not hasattr(models, 'BurndownSnapshot')


def test_capacity_module_removed():
    import importlib
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module('apps.core.capacity')


@pytest.mark.django_db
def test_dead_endpoints_gone(client):
    # 路由已删 → 404
    assert client.get('/api/sprints/').status_code == 404
    assert client.get('/api/capacity/?sprint=1').status_code == 404
    assert client.get('/api/burndown/?sprint=1').status_code == 404
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_cleanup.py -v`
Expected: FAIL(`hasattr(models,'Sprint')` 仍为 True;`capacity` 仍可导入;路由仍 200/400)

- [ ] **Step 4: 改 `models.py` — 删 Sprint / BurndownSnapshot / assigned_sprint**

把 `models.py` 替换为(只保留 Member / Requirement / Milestone / MemberDailySnapshot):

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
    planned_start = models.DateField('预计开始', null=True, blank=True)
    planned_end = models.DateField('预计结束', null=True, blank=True)
    note = models.TextField('备注', blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='children', verbose_name='父需求')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '需求'
        verbose_name_plural = '需求'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Milestone(models.Model):
    requirement = models.ForeignKey(Requirement, on_delete=models.CASCADE, verbose_name='需求')
    title = models.CharField('标题', max_length=200)
    date = models.DateField('日期')
    note = models.TextField('备注', blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '里程碑'
        verbose_name_plural = '里程碑'
        ordering = ['-date']

    def __str__(self):
        return self.title


class MemberDailySnapshot(models.Model):
    date = models.DateField('日期')
    member = models.ForeignKey(Member, on_delete=models.CASCADE, verbose_name='成员')
    remaining_effort = models.FloatField('剩余工时(h)', default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('date', 'member')
        ordering = ['-date']
        verbose_name = '每日工时快照'
        verbose_name_plural = '每日工时快照'

    def __str__(self):
        return f'{self.member.name} {self.date} 剩余{self.remaining_effort}h'
```

- [ ] **Step 5: 生成 migration**

Run: `cd backend && .venv/bin/python manage.py makemigrations core`
Expected: 生成 `0008_remove_sprint.py`。打开核对应包含 `migrations.RemoveField('assigned_sprint')`、`migrations.DeleteModel('Sprint')`、`migrations.DeleteModel('BurndownSnapshot')`。

若 makemigrations 未自动生成或想手写,用以下内容创建 `backend/apps/core/migrations/0008_remove_sprint.py`:

```python
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_memberdailysnapshot'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='requirement',
            name='assigned_sprint',
        ),
        migrations.DeleteModel(
            name='Sprint',
        ),
        migrations.DeleteModel(
            name='BurndownSnapshot',
        ),
    ]
```

- [ ] **Step 6: 执行 migration**

Run: `cd backend && .venv/bin/python manage.py migrate`
Expected: `Applying core.0008_remove_sprint... OK`

- [ ] **Step 7: 改 `views.py` — 删 SprintViewSet / capacity_view / burndown_view,修 ai_chat**

替换 `views.py` 头部导入区(注意:`status` 仍被 login_view/me_view/ai_chat 使用,**必须保留**;删掉的是 `get_object_or_404`、`django.db.models`、`Sprint`/`BurndownSnapshot`/`SprintSerializer`、`capacity`):

old:
```python
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import models
from .models import Member, Sprint, Requirement, Milestone, BurndownSnapshot, MemberDailySnapshot
from .serializers import MemberSerializer, SprintSerializer, RequirementSerializer, MilestoneSerializer
from . import capacity
from .ai import chat_with_glm, parse_drafts, strip_json_block, build_system_prompt, parse_actions, strip_actions_block
from .ai_actions import execute_action
```
new:
```python
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.utils import timezone
from .models import Member, Requirement, Milestone, MemberDailySnapshot
from .serializers import MemberSerializer, RequirementSerializer, MilestoneSerializer
from .ai import chat_with_glm, parse_drafts, strip_json_block, build_system_prompt, parse_actions, strip_actions_block
from .ai_actions import execute_action
```

删掉 `SprintViewSet` 类(第 19-21 行)。

改 `RequirementViewSet.get_queryset`,从 filter 列表去掉 `assigned_sprint`:

old:
```python
    def get_queryset(self):
        qs = Requirement.objects.all()
        for f in ('status', 'assignee', 'assigned_sprint', 'priority'):
            v = self.request.query_params.get(f)
            if v:
                qs = qs.filter(**{f: v})
        return qs
```
new:
```python
    def get_queryset(self):
        qs = Requirement.objects.all()
        for f in ('status', 'assignee', 'priority'):
            v = self.request.query_params.get(f)
            if v:
                qs = qs.filter(**{f: v})
        return qs
```

删掉整个 `capacity_view`(第 44-59 行)和 `burndown_view`(第 82-128 行)。

改 `ai_chat`,去掉 sprints 查询与传参:

old:
```python
    members = list(Member.objects.values("id", "name"))
    sprints = list(Sprint.objects.values("id", "name", "is_active"))
    modules = list(Requirement.objects.exclude(module="").values_list("module", flat=True).distinct())
    system = build_system_prompt(members, sprints, modules)
```
new:
```python
    members = list(Member.objects.values("id", "name"))
    modules = list(Requirement.objects.exclude(module="").values_list("module", flat=True).distinct())
    system = build_system_prompt(members, modules)
```

- [ ] **Step 8: 改 `urls.py` — 删路由**

old:
```python
from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import MemberViewSet, SprintViewSet, RequirementViewSet, MilestoneViewSet, capacity_view, login_view, logout_view, me_view, burndown_view, ai_chat, ai_execute, snapshots_view

router = DefaultRouter()
router.register('members', MemberViewSet)
router.register('sprints', SprintViewSet)
router.register('requirements', RequirementViewSet)
router.register('milestones', MilestoneViewSet)

urlpatterns = router.urls + [path('capacity/', capacity_view)]
urlpatterns += [
    path('auth/login', login_view),
    path('auth/logout', logout_view),
    path('auth/me', me_view),
    path('burndown/', burndown_view),
    path('ai/chat/', ai_chat),
    path('ai/execute/', ai_execute),
    path('snapshots/', snapshots_view),
]
```
new:
```python
from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import MemberViewSet, RequirementViewSet, MilestoneViewSet, login_view, logout_view, me_view, ai_chat, ai_execute, snapshots_view

router = DefaultRouter()
router.register('members', MemberViewSet)
router.register('requirements', RequirementViewSet)
router.register('milestones', MilestoneViewSet)

urlpatterns = router.urls + [
    path('auth/login', login_view),
    path('auth/logout', logout_view),
    path('auth/me', me_view),
    path('ai/chat/', ai_chat),
    path('ai/execute/', ai_execute),
    path('snapshots/', snapshots_view),
]
```

- [ ] **Step 9: 删 `capacity.py`**

Run: `rm backend/apps/core/capacity.py`

- [ ] **Step 10: 改 `serializers.py` — 删 SprintSerializer / sprint_name**

old:
```python
from rest_framework import serializers
from .models import Member, Sprint, Requirement, Milestone

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

class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = '__all__'
```
new:
```python
from rest_framework import serializers
from .models import Member, Requirement, Milestone

class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = '__all__'

class RequirementSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source='assignee.name', read_only=True)
    class Meta:
        model = Requirement
        fields = '__all__'

class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = '__all__'
```

- [ ] **Step 11: 改 `admin.py` — 删 SprintAdmin / assigned_sprint**

old:
```python
from django.contrib import admin
from .models import Member, Sprint, Requirement, Milestone

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

@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ('title', 'date', 'requirement', 'note')
    list_filter = ('requirement',)
    search_fields = ('title',)
```
new:
```python
from django.contrib import admin
from .models import Member, Requirement, Milestone

@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('name', 'week_capacity', 'modules', 'active')
    list_filter = ('active',)
    search_fields = ('name',)

@admin.register(Requirement)
class RequirementAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'priority', 'assignee', 'module', 'est_effort', 'progress')
    list_filter = ('status', 'priority', 'module')
    search_fields = ('title', 'note')
    list_editable = ('status', 'priority', 'progress')

@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ('title', 'date', 'requirement', 'note')
    list_filter = ('requirement',)
    search_fields = ('title',)
```

- [ ] **Step 12: 改 `ai.py` — build_system_prompt 去 sprint**

old:
```python
def build_system_prompt(members, sprints, modules):
    m_list = ", ".join(f'{x["name"]}(id:{x["id"]})' for x in members) or "无"
    s_list = ", ".join(f'{x["name"]}(id:{x["id"]}{"活跃" if x.get("is_active") else ""})' for x in sprints) or "无"
    mod_list = ", ".join(modules) if modules else "无"
    return f"""你是 PL(技术主管)的分析助手。用户描述一个问题/需求,你帮深度拆解。
现有团队成员:{m_list};迭代:{s_list};模块:{mod_list}。
分析框架:
1. 先理解问题(现象+根因方向)
2. 列出决策点(模型/算法/逻辑/数据/测试/前端/后端——哪些要改)
3. 每个决策点给 2-3 候选方案+取舍,问用户选哪个
4. 多轮确认后,产出 1 个父需求+N 个子任务
子任务类型:模型/逻辑/数据/测试/文档/前端/后端/其他
产出格式(分析充分后在回复末尾):
```json
{{"parent":{{"title":"..."}}, "children":[{{"title":"...","type":"模型","analysis":"..."}}]}}
```
不要急于产出,先分析、追问、确认。
你也可以帮用户操作看板数据。用户说自然语言指令(如"把登录接口分配给张三"),你在回复末尾用 ```actions 返回操作建议。
可用操作:
- update_requirement: {{"type":"update_requirement","match":{{"title":"xxx"}},"fields":{{"status":"in_progress","assignee":"张三","priority":"P0"}},"description":"人话描述"}}
- create_requirement: {{"type":"create_requirement","params":{{"title":"xxx","assignee":"张三","assigned_sprint":"S1"}},"description":"..."}}
- delete_requirement: {{"type":"delete_requirement","match":{{"title":"xxx"}},"description":"..."}}
- update_member: {{"type":"update_member","match":{{"name":"张三"}},"fields":{{"week_capacity":35}},"description":"..."}}
- create_member: {{"type":"create_member","params":{{"name":"李四","week_capacity":40,"modules":"前端"}},"description":"添加成员李四"}}
- create_sprint: {{"type":"create_sprint","params":{{"name":"2026-W28","start_date":"2026-07-20","end_date":"2026-08-03"}},"description":"创建迭代"}}
返回的是建议(未执行),用户确认后才执行。"""
```
new:
```python
def build_system_prompt(members, modules):
    m_list = ", ".join(f'{x["name"]}(id:{x["id"]})' for x in members) or "无"
    mod_list = ", ".join(modules) if modules else "无"
    return f"""你是 PL(技术主管)的分析助手。用户描述一个问题/需求,你帮深度拆解。
现有团队成员:{m_list};模块:{mod_list}。
分析框架:
1. 先理解问题(现象+根因方向)
2. 列出决策点(模型/算法/逻辑/数据/测试/前端/后端——哪些要改)
3. 每个决策点给 2-3 候选方案+取舍,问用户选哪个
4. 多轮确认后,产出 1 个父需求+N 个子任务
子任务类型:模型/逻辑/数据/测试/文档/前端/后端/其他
产出格式(分析充分后在回复末尾):
```json
{{"parent":{{"title":"..."}}, "children":[{{"title":"...","type":"模型","analysis":"..."}}]}}
```
不要急于产出,先分析、追问、确认。
你也可以帮用户操作看板数据。用户说自然语言指令(如"把登录接口分配给张三"),你在回复末尾用 ```actions 返回操作建议。
可用操作:
- update_requirement: {{"type":"update_requirement","match":{{"title":"xxx"}},"fields":{{"status":"in_progress","assignee":"张三","priority":"P0"}},"description":"人话描述"}}
- create_requirement: {{"type":"create_requirement","params":{{"title":"xxx","assignee":"张三"}},"description":"..."}}
- delete_requirement: {{"type":"delete_requirement","match":{{"title":"xxx"}},"description":"..."}}
- update_member: {{"type":"update_member","match":{{"name":"张三"}},"fields":{{"week_capacity":35}},"description":"..."}}
- create_member: {{"type":"create_member","params":{{"name":"李四","week_capacity":40,"modules":"前端"}},"description":"添加成员李四"}}
返回的是建议(未执行),用户确认后才执行。"""
```

- [ ] **Step 13: 改 `ai_actions.py` — 删 sprint 相关**

old(第 1 行导入):
```python
from .models import Member, Sprint, Requirement
```
new:
```python
from .models import Member, Requirement
```

删除整个 `_resolve_sprint` 函数(第 17-22 行)。

在 `update_requirement` 分支删 assigned_sprint 处理:

old:
```python
            if "assignee" in fields:
                m = _resolve_member(fields["assignee"])
                if m: r.assignee = m
            if "assigned_sprint" in fields:
                s = _resolve_sprint(fields["assigned_sprint"])
                if s: r.assigned_sprint = s
            r.save()
```
new:
```python
            if "assignee" in fields:
                m = _resolve_member(fields["assignee"])
                if m: r.assignee = m
            r.save()
```

在 `create_requirement` 分支删 assigned_sprint 处理:

old:
```python
            if params.get("assignee"):
                m = _resolve_member(params["assignee"])
                if m: r.assignee = m
            if params.get("assigned_sprint"):
                s = _resolve_sprint(params["assigned_sprint"])
                if s: r.assigned_sprint = s
            if params.get("est_effort"): r.est_effort = params["est_effort"]
```
new:
```python
            if params.get("assignee"):
                m = _resolve_member(params["assignee"])
                if m: r.assignee = m
            if params.get("est_effort"): r.est_effort = params["est_effort"]
```

删除整个 `update_sprint` 分支(`elif atype == "update_sprint":` 整块,第 88-99 行)和 `create_sprint` 分支(`elif atype == "create_sprint":` 整块,第 101-111 行)。

- [ ] **Step 14: 删过时测试文件**

Run: `rm backend/apps/core/tests/test_capacity.py backend/apps/core/tests/test_burndown.py`

- [ ] **Step 15: 修 `test_api.py` — 删 capacity 测试**

删掉 `test_requirement_create_and_capacity` 和 `test_capacity_view_404_on_invalid_sprint` 两个函数;`test_member_list` 保留。最终文件:

```python
import pytest
from rest_framework.test import APIClient
from apps.core.models import Member


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
```

- [ ] **Step 16: 修 `test_models.py` — 删 sprint 测试**

old:
```python
import pytest
from datetime import date
from apps.core.models import Member, Sprint, Requirement
```
new:
```python
import pytest
from apps.core.models import Member, Requirement
```

删掉 `test_sprint_weeks` 整个函数。改 `test_requirement_defaults`:

old:
```python
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
new:
```python
@pytest.mark.django_db
def test_requirement_defaults():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='登录接口', assignee=m)
    assert r.status == 'backlog'
    assert r.priority == 'P1'
    assert r.progress == 0
    assert r.est_effort == 0
    assert str(r) == '登录接口'
```

- [ ] **Step 17: 修 `test_serializers.py` — 删 sprint_name 断言**

```python
import pytest
from apps.core.models import Member, Requirement
from apps.core.serializers import RequirementSerializer


@pytest.mark.django_db
def test_requirement_serializer_exposes_names():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='登录', assignee=m)
    data = RequirementSerializer(r).data
    assert data['assignee_name'] == '张三'
    assert 'sprint_name' not in data
```

- [ ] **Step 18: 修 `test_admin.py` — 删 Sprint 断言**

old:
```python
@pytest.mark.django_db
def test_admin_models_registered():
    from django.contrib import admin as djadmin
    from apps.core.models import Member, Sprint, Requirement
    assert Member in djadmin.site._registry
    assert Sprint in djadmin.site._registry
    assert Requirement in djadmin.site._registry
```
new:
```python
@pytest.mark.django_db
def test_admin_models_registered():
    from django.contrib import admin as djadmin
    from apps.core.models import Member, Requirement, Milestone
    assert Member in djadmin.site._registry
    assert Requirement in djadmin.site._registry
    assert Milestone in djadmin.site._registry
```

- [ ] **Step 19: 修 `test_ai_actions.py` — 去 sprint**

old(第 1-11 行):
```python
import pytest
from apps.core.models import Member, Sprint, Requirement
from apps.core.ai_actions import execute_action
from datetime import date

@pytest.fixture
def setup_data():
    m = Member.objects.create(name="张三", week_capacity=40)
    s = Sprint.objects.create(name="S1", start_date=date(2026,7,6), end_date=date(2026,7,20))
    r = Requirement.objects.create(title="登录接口", assignee=m, assigned_sprint=s, status="backlog")
    return m, s, r
```
new:
```python
import pytest
from apps.core.models import Member, Requirement
from apps.core.ai_actions import execute_action


@pytest.fixture
def setup_data():
    m = Member.objects.create(name="张三", week_capacity=40)
    r = Requirement.objects.create(title="登录接口", assignee=m, status="backlog")
    return m, r
```

改 `test_update_requirement_by_title`(解包去掉 s):

old:
```python
def test_update_requirement_by_title(setup_data):
    m, s, r = setup_data
```
new:
```python
def test_update_requirement_by_title(setup_data):
    m, r = setup_data
```

改 `test_create_requirement`(去掉 assigned_sprint 入参):

old:
```python
def test_create_requirement(setup_data):
    result = execute_action({"type": "create_requirement", "params": {"title": "支付接口", "assignee": "张三", "assigned_sprint": "S1"}})
    assert result["success"] is True
    assert Requirement.objects.filter(title="支付接口").exists()
```
new:
```python
def test_create_requirement(setup_data):
    result = execute_action({"type": "create_requirement", "params": {"title": "支付接口", "assignee": "张三"}})
    assert result["success"] is True
    assert Requirement.objects.filter(title="支付接口").exists()
```

- [ ] **Step 20: 修 `test_ai.py` — build_system_prompt 新签名**

old:
```python
def test_build_system_prompt_has_analysis_framework():
    prompt = build_system_prompt(
        [{"id":1,"name":"张三"}],
        [{"id":1,"name":"S1","is_active":True}],
        ["后端","前端"]
    )
    assert "张三" in prompt and "S1" in prompt and "后端" in prompt
    assert "决策点" in prompt
    assert "parent" in prompt and "children" in prompt
```
new:
```python
def test_build_system_prompt_has_analysis_framework():
    prompt = build_system_prompt(
        [{"id":1,"name":"张三"}],
        ["后端","前端"]
    )
    assert "张三" in prompt and "后端" in prompt
    assert "决策点" in prompt
    assert "parent" in prompt and "children" in prompt
```

- [ ] **Step 21: 跑全量后端测试**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: 全绿(含新增 `test_cleanup.py`)。(`snapshots_view` 在本任务仍用 get_or_create,故 `test_snapshots.py` 的 `test_snapshot_idempotent` 仍通过;Task 3 才改为 update_or_create 并替换该用例。)

- [ ] **Step 22: Commit**

```bash
git add -A
git commit -m "refactor(core): remove Sprint dimension + orphaned capacity/burndown backend (Wave 1 Task 1)

- delete Sprint/BurndownSnapshot models + assigned_sprint (migration 0008)
- delete capacity.py, capacity_view, burndown_view, SprintViewSet
- drop sprint from ai prompt/actions/serializers/admin
- update tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 前端清除 Sprint / calcProgress,progress 改手动五档

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/pages/Board.tsx`
- Modify: `frontend/src/api.test.ts`, `pages/Board.test.tsx`, `pages/Schedule.test.tsx`, `pages/Gantt.test.tsx`

**Interfaces:**
- Produces: `Requirement` 无 `assigned_sprint`/`sprint_name`;`progress` 由表单五档选择写入(0/25/50/75/100);无 `calcProgress` 导出。

- [ ] **Step 1: 写失败测试 — 验证 calcProgress 已删、progress 手动**

在 `frontend/src/pages/Board.test.tsx` 顶部已有 mock。补充一个断言(若文件已有 create mock,在其后加用例;若不便加,新建 `frontend/src/types.test.ts`):

Create `frontend/src/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { STATUS_LABEL } from './types'

describe('types after Wave 1 cleanup', () => {
  it('status labels intact', () => {
    expect(STATUS_LABEL.in_progress).toBe('开发中')
  })
  it('calcProgress is removed (no longer exported)', async () => {
    const mod = await import('./types')
    expect((mod as any).calcProgress).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/types.test.ts`
Expected: FAIL(`calcProgress` 仍导出)

- [ ] **Step 3: 改 `types.ts`**

删掉 `Sprint` interface(第 12-19 行)、`CapacityRow`(40-46)、`BurndownSnapshot`(57-60)、`BurndownSprint`(62-67)、`BurndownData`(69-73)、`calcProgress`(87)。`Requirement` 去掉 `assigned_sprint` 与 `sprint_name` 两行。`Draft` 去掉 `assigned_sprint`(第 96 行)。

最终 `types.ts`(保留其余不变):

```ts
export type Status = 'backlog'|'scheduled'|'in_progress'|'testing'|'done'|'blocked'|'paused'
export type Priority = 'P0'|'P1'|'P2'

export interface Member {
  id:number;
  name:string;
  week_capacity:number;
  modules:string;
  active:boolean
}

export interface Requirement {
  id:number;
  title:string;
  status:Status;
  priority:Priority;
  assignee:number|null;
  assignee_name?:string;
  module:string;
  progress:number;
  est_effort:number;
  actual_effort:number;
  planned_start:string|null;
  planned_end:string|null;
  note:string;
  parent: number | null;
}

export interface Milestone {
  id:number;
  requirement:number;
  title:string;
  date:string;
  note:string;
  created_at:string;
}

export const STATUS_LABEL: Record<Status,string> = {
  backlog:'待评审',
  scheduled:'排期中',
  in_progress:'开发中',
  testing:'测试中',
  done:'已上线',
  blocked:'已阻塞',
  paused:'暂停'
}

export const STATUS_ORDER: Status[] = ['backlog','scheduled','in_progress','testing','done','blocked','paused']

export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string }
export interface Draft {
  title: string
  status?: string
  priority?: string
  module?: string
  est_effort?: number
  assignee?: number | null
  parent?: number | null
}

export interface DraftResult {
  parent: { title: string }
  children: Array<{ title: string; type?: string; analysis?: string }>
}

export interface MemberSnapshot {
  date: string
  member_id: number
  member: string
  remaining_effort: number
}

export interface AIAction {
  type: string
  match?: Record<string, any>
  fields?: Record<string, any>
  params?: Record<string, any>
  description?: string
}
```

- [ ] **Step 4: 改 `api.ts`**

old(第 1-2 行):
```ts
import axios from 'axios'
import type { Member, Sprint, Requirement, CapacityRow, Milestone, BurndownData, ChatMessage, DraftResult, AIAction, MemberSnapshot } from './types'
```
new:
```ts
import axios from 'axios'
import type { Member, Requirement, Milestone, ChatMessage, DraftResult, AIAction, MemberSnapshot } from './types'
```

old(api 对象,第 29-34 行):
```ts
  members: crud<Member>('/api/members/'),
  sprints: crud<Sprint>('/api/sprints/'),
  requirements: crud<Requirement>('/api/requirements/'),
  milestones: crud<Milestone>('/api/milestones/'),
  capacity: (sprint:number) => http.get<CapacityRow[]>('/api/capacity/', { params: { sprint } }).then(r => r.data),
  burndown: (sprint:number) => http.get<BurndownData>('/api/burndown/', { params: { sprint } }).then(r => r.data),
```
new:
```ts
  members: crud<Member>('/api/members/'),
  requirements: crud<Requirement>('/api/requirements/'),
  milestones: crud<Milestone>('/api/milestones/'),
```

- [ ] **Step 5: 改 `Board.tsx` — 去 Sprint/calcProgress,加 progress 五档选择**

第 3 行导入去 `calcProgress` 和 `Sprint`:

old:
```ts
import { STATUS_LABEL, STATUS_ORDER, calcProgress, type Requirement, type Status, type Member, type Sprint, type Priority } from '../types'
```
new:
```ts
import { STATUS_LABEL, STATUS_ORDER, type Requirement, type Status, type Member, type Priority } from '../types'
```

删 `setSprints` state 与 `api.sprints.list`(第 23、38 行):

old:
```ts
  const [, setSprints] = useState<Sprint[]>([])
```
new:(删除该行)

old:
```ts
  useEffect(() => {
    load()
    api.members.list().then(setMembers)
    api.sprints.list().then(setSprints)
  }, [])
```
new:
```ts
  useEffect(() => {
    load()
    api.members.list().then(setMembers)
  }, [])
```

`onDrop` 不再重算 progress(只改 status):

old:
```ts
  const onDrop = async (status: Status, id: number) => {
    const r = items.find(x => x.id === id); if (!r || r.status === status) return
    const newProgress = calcProgress(r.est_effort, r.actual_effort)
    setItems(prev => prev.map(x => x.id === id ? { ...x, status, progress: newProgress } : x))
    await api.requirements.update(id, { status, progress: newProgress })
  }
```
new:
```ts
  const onDrop = async (status: Status, id: number) => {
    const r = items.find(x => x.id === id); if (!r || r.status === status) return
    setItems(prev => prev.map(x => x.id === id ? { ...x, status } : x))
    await api.requirements.update(id, { status })
  }
```

form state 加 `progress`(去掉 `assigned_sprint`):

old(第 124-135 行):
```ts
  const [form, setForm] = useState({
    title: '',
    status: 'backlog' as Status,
    priority: 'P1' as Priority,
    assignee: null as number | null,
    module: '',
    est_effort: '',
    actual_effort: '',
    planned_start: '',
    planned_end: '',
    assigned_sprint: null as number | null
  })
```
new:
```ts
  const [form, setForm] = useState({
    title: '',
    status: 'backlog' as Status,
    priority: 'P1' as Priority,
    assignee: null as number | null,
    module: '',
    est_effort: '',
    actual_effort: '',
    progress: 0 as number,
    planned_start: '',
    planned_end: '',
  })
```

`startEdit` 设 progress、去 assigned_sprint:

old:
```ts
    setForm({
      title: item.title,
      status: item.status,
      priority: item.priority,
      assignee: item.assignee,
      module: item.module,
      est_effort: String(item.est_effort),
      actual_effort: String(item.actual_effort || 0),
      planned_start: item.planned_start || '',
      planned_end: item.planned_end || '',
      assigned_sprint: item.assigned_sprint
    })
```
new:
```ts
    setForm({
      title: item.title,
      status: item.status,
      priority: item.priority,
      assignee: item.assignee,
      module: item.module,
      est_effort: String(item.est_effort),
      actual_effort: String(item.actual_effort || 0),
      progress: item.progress,
      planned_start: item.planned_start || '',
      planned_end: item.planned_end || '',
    })
```

两处 `closeForm`/`openCreate` 的 setForm 初值(第 79、118 行)统一改:

old(两处都是):
```ts
    setForm({ title: '', status: 'backlog', priority: 'P1', assignee: null, module: '', est_effort: '', actual_effort: '', planned_start: '', planned_end: '', assigned_sprint: null })
```
new(两处都改):
```ts
    setForm({ title: '', status: 'backlog', priority: 'P1', assignee: null, module: '', est_effort: '', actual_effort: '', progress: 0, planned_start: '', planned_end: '' })
```

`createReq` 的 payload 用 form.progress、去 assigned_sprint:

old:
```ts
      const payload = {
        title: form.title,
        status: form.status,
        priority: form.priority,
        assignee: form.assignee,
        module: form.module || '',
        est_effort: est,
        actual_effort: actual,
        progress: calcProgress(est, actual),
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
        assigned_sprint: form.assigned_sprint
      }
```
new:
```ts
      const payload = {
        title: form.title,
        status: form.status,
        priority: form.priority,
        assignee: form.assignee,
        module: form.module || '',
        est_effort: est,
        actual_effort: actual,
        progress: form.progress,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
      }
```

卡片显示用 `requirement.progress` 替代 calcProgress:

old(第 431 行):
```tsx
          <span>{calcProgress(requirement.est_effort, requirement.actual_effort)}%</span>
```
new:
```tsx
          <span>{requirement.progress}%</span>
```

在表单里"已投入时间h"那个 `</div>` 之后(第 282 行 `</div>` 之后),"计划开始"之前,插入 progress 五档选择:

```tsx
                <div className="space-y-2">
                  <Label htmlFor="progress">进度</Label>
                  <Select value={String(form.progress)} onValueChange={(v) => setForm({...form, progress: Number(v)})}>
                    <SelectTrigger id="progress">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0,25,50,75,100].map(p => <SelectItem key={p} value={String(p)}>{p}%</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
```

- [ ] **Step 6: 重写过时的前端测试**

> 现状:`Burndown.test.tsx`/`Capacity.test.tsx` 还在 mock 旧的 `api.sprints`/`api.burndown`/`api.capacity` 形状,且 `Capacity.test` 依赖一个已不存在的 sprint `<select>`(`combobox`)——这些用例在当前仓库**本来就是红的**。本步把它们改成新的 api 形状,让前端套件转绿。`Schedule.test.tsx`/`Gantt.test.tsx` 的 mock 数据里残留的 `assigned_sprint` 字段是无害的多余字段(组件不读、vitest 不做严格类型检查),**可不动**。

整文件替换 `frontend/src/api.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { api } from './api'

describe('api', () => {
  it('exposes requirements crud', () => {
    expect(typeof api.requirements.list).toBe('function')
  })
})
```

整文件替换 `frontend/src/pages/Burndown.test.tsx`(Task 4 会再往里加用例):

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Burndown from './Burndown'

vi.mock('../api', () => ({
  api: {
    requirements: { list: vi.fn().mockResolvedValue([]) },
    members: { list: vi.fn().mockResolvedValue([{ id:1, name:'张三', week_capacity:40, modules:'', active:true }]) },
    snapshots: vi.fn().mockResolvedValue([]),
  },
}))

describe('Burndown', () => {
  it('无需求时显示提示', async () => {
    render(<Burndown />)
    await waitFor(() => expect(screen.getByText('暂无需求数据')).toBeInTheDocument())
  })
})
```

整文件替换 `frontend/src/pages/Capacity.test.tsx`(Task 5 会再往里加用例):

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Capacity from './Capacity'

vi.mock('../api', () => ({
  api: {
    requirements: { list: vi.fn().mockResolvedValue([]) },
    members: { list: vi.fn().mockResolvedValue([{ id:1, name:'张三', week_capacity:40, modules:'', active:true }]) },
  },
}))

describe('Capacity', () => {
  it('渲染成员行', async () => {
    render(<Capacity />)
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument())
  })
})
```

整文件替换 `frontend/src/pages/Board.test.tsx`(去掉 mock 里的 `sprints`/`assigned_sprint`,create 断言改新 payload):

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Board from './Board'

vi.mock('../api', () => ({
  api: {
    requirements: {
      list: vi.fn().mockResolvedValue([
        { id:1, title:'登录', status:'in_progress', priority:'P0', assignee:1, assignee_name:'张三', module:'', est_effort:8, actual_effort:4, progress:50, planned_start:'2026-01-01', planned_end:'2026-01-15', parent:null, note:'' },
      ]),
      update: vi.fn().mockResolvedValue({ id:1, title:'登录', status:'in_progress', priority:'P0', assignee:1, assignee_name:'张三', module:'', est_effort:8, actual_effort:4, progress:50, planned_start:'2026-01-01', planned_end:'2026-01-15', parent:null, note:'' }),
      create: vi.fn().mockResolvedValue({ id:99, title:'新需求', status:'backlog', priority:'P1', assignee:1, assignee_name:'张三', module:'', est_effort:4, actual_effort:0, progress:0, planned_start:null, planned_end:null, parent:null, note:'' }),
    },
    members: { list: vi.fn().mockResolvedValue([
      { id:1, name:'张三', week_capacity:40, modules:'', active:true },
      { id:2, name:'李四', week_capacity:40, modules:'', active:true },
    ])},
    milestones: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id:1, requirement:1, title:'M1', date:'2026-01-01', note:'', created_at:'2026-01-01T00:00:00Z' }),
    },
  }
}))

describe('Board', () => {
  it('renders columns and cards', async () => {
    render(<Board />)
    await waitFor(() => expect(screen.getByText('登录')).toBeInTheDocument())
    expect(screen.getByText('开发中')).toBeInTheDocument()
  })

  it('creates a new requirement', async () => {
    const { api } = await import('../api')
    render(<Board />)
    await waitFor(() => expect(screen.getByText('+ 新建需求')).toBeInTheDocument())
    const user = userEvent.setup()
    await user.click(screen.getByText('+ 新建需求'))
    await user.type(screen.getByPlaceholderText('请输入标题'), '新需求')
    await user.click(screen.getByRole('button', { name: '提交' }))
    await waitFor(() => {
      expect(api.requirements.create).toHaveBeenCalledWith({
        title: '新需求', status: 'backlog', priority: 'P1', assignee: null, module: '',
        est_effort: 0, actual_effort: 0, progress: 0, planned_start: null, planned_end: null,
      })
    })
    await waitFor(() => expect(screen.getByText('新需求')).toBeInTheDocument())
  })

  it('opens edit form on double-click', async () => {
    render(<Board />)
    await waitFor(() => expect(screen.getByText('登录')).toBeInTheDocument())
    const user = userEvent.setup()
    await user.dblClick(screen.getByText('登录'))
    await waitFor(() => expect(screen.getByDisplayValue('登录')).toBeInTheDocument())
    expect(screen.getByText('编辑需求')).toBeInTheDocument()
    expect(screen.getByText('已投入时间h')).toBeInTheDocument()
    expect(screen.getByText('进度')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: 跑前端测试 + 类型检查**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿,无 TS 报错。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(frontend): drop Sprint/calcProgress, progress -> manual 5-step (Wave 1 Task 2)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 后端快照叶子 rollup + update_or_create

**Files:**
- Modify: `backend/apps/core/views.py:153-169`(`snapshots_view`)
- Modify: `backend/apps/core/tests/test_snapshots.py`

**Interfaces:**
- Produces:`snapshots_view` 只对叶子需求汇总 `remaining`,且当天多次访问会刷新(update_or_create)。

- [ ] **Step 1: 写/改失败测试**

替换 `test_snapshots.py` 全文:

```python
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Member, Requirement, MemberDailySnapshot


@pytest.fixture
def client():
    User.objects.create_user("pl", password="pw")
    c = APIClient(); c.login(username="pl", password="pw")
    return c


@pytest.fixture
def setup_data():
    m = Member.objects.create(name="张三", week_capacity=40)
    Requirement.objects.create(title="测试", assignee=m, est_effort=24, actual_effort=5, status="in_progress")
    return m


@pytest.mark.django_db
def test_snapshot_created_on_visit(client, setup_data):
    m = setup_data
    resp = client.get("/api/snapshots/")
    assert resp.status_code == 200
    snap = [s for s in resp.data if s["member_id"] == m.id]
    assert len(snap) >= 1
    assert snap[0]["remaining_effort"] == 19.0  # 24 - 5


@pytest.mark.django_db
def test_snapshot_updates_on_same_day(client, setup_data):
    """A3: 同一天再次访问应刷新(不再 get_or_create 锁定)。"""
    m = setup_data
    client.get("/api/snapshots/")
    # 工时变化后再次访问
    Requirement.objects.filter(assignee=m).update(est_effort=24, actual_effort=10)
    client.get("/api/snapshots/")
    assert MemberDailySnapshot.objects.filter(member=m).count() == 1  # 仍只有一条
    snap = MemberDailySnapshot.objects.get(member=m)
    assert snap.remaining_effort == 14.0  # 24 - 10, 已刷新


@pytest.mark.django_db
def test_snapshot_excludes_parent_double_count(client):
    """A1: 父需求有子任务时,只算叶子,不 double-count。"""
    m = Member.objects.create(name="父负责人", week_capacity=40)
    parent = Requirement.objects.create(title="父", assignee=m, est_effort=20, actual_effort=0, status="in_progress")
    Requirement.objects.create(title="子A", assignee=m, parent=parent, est_effort=6, actual_effort=0, status="in_progress")
    Requirement.objects.create(title="子B", assignee=m, parent=parent, est_effort=6, actual_effort=0, status="in_progress")
    client.get("/api/snapshots/")
    snap = MemberDailySnapshot.objects.get(member=m)
    assert snap.remaining_effort == 12.0  # 只算两个叶子 6+6, 父被排除


@pytest.mark.django_db
def test_snapshot_excludes_done(client):
    m = Member.objects.create(name="李四", week_capacity=40)
    Requirement.objects.create(title="已上线", assignee=m, est_effort=10, status="done")
    resp = client.get("/api/snapshots/")
    snap = [s for s in resp.data if s["member_id"] == m.id]
    assert len(snap) >= 1
    assert snap[0]["remaining_effort"] == 0
```

(若 Task 1 给 `test_snapshot_idempotent` 加了 skip,这里整文件替换后 skip 自然消失。)

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_snapshots.py -v`
Expected: `test_snapshot_updates_on_same_day` 与 `test_snapshot_excludes_parent_double_count` FAIL。

- [ ] **Step 3: 改 `snapshots_view`**

old:
```python
@api_view(['GET'])
def snapshots_view(request):
    today = timezone.now().date()
    members = Member.objects.filter(active=True)
    for m in members:
        reqs = Requirement.objects.filter(assignee=m).exclude(status__in=['done', 'paused'])
        remaining = sum(max(0, r.est_effort - r.actual_effort) for r in reqs)
        MemberDailySnapshot.objects.get_or_create(
            date=today, member=m, defaults={'remaining_effort': remaining}
        )
    snaps = MemberDailySnapshot.objects.select_related('member').all()
    return Response([{
        'date': s.date.isoformat(),
        'member_id': s.member_id,
        'member': s.member.name,
        'remaining_effort': s.remaining_effort,
    } for s in snaps])
```
new:
```python
@api_view(['GET'])
def snapshots_view(request):
    today = timezone.now().date()
    members = Member.objects.filter(active=True)
    for m in members:
        # A1: 只算叶子需求(无子任务),避免父子 double-count
        reqs = Requirement.objects.filter(assignee=m).exclude(status__in=['done', 'paused'])\
            .annotate(nc=models.Count('children')).filter(nc=0)
        remaining = sum(max(0, r.est_effort - r.actual_effort) for r in reqs)
        # A3: 当天多次访问刷新(update_or_create),不再 get_or_create 锁定
        MemberDailySnapshot.objects.update_or_create(
            date=today, member=m, defaults={'remaining_effort': remaining}
        )
    snaps = MemberDailySnapshot.objects.select_related('member').all()
    return Response([{
        'date': s.date.isoformat(),
        'member_id': s.member_id,
        'member': s.member.name,
        'remaining_effort': s.remaining_effort,
    } for s in snaps])
```

注意:这里用了 `models.Count`,需在 `views.py` 顶部补回 `from django.db.models import Count`(Task 1 删了 `from django.db import models`)。在导入区加:

```python
from django.db.models import Count
```

并把 `models.Count('children')` 改为 `Count('children')`。最终 new 版本里那一行应是:

```python
            .annotate(nc=Count('children')).filter(nc=0)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_snapshots.py -v`
Expected: 全绿。

- [ ] **Step 5: 跑全量后端**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(snapshots): leaves-only rollup + update_or_create same-day refresh (Wave 1 Task 3)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 燃尽图叶子 rollup + actual/ideal 同口径

**Files:**
- Modify: `frontend/src/pages/Burndown.tsx`
- Modify: `frontend/src/pages/Burndown.test.tsx`

**Interfaces:**
- Produces:`inFlight` 只含叶子;`actualRemain` 只算 `myDated`(与 ideal 同口径)。

- [ ] **Step 1: 写失败测试**

在 Task 2 重写后的 `Burndown.test.tsx` 的 `describe` 块内追加一个用例(顶部 mock 已提供 `requirements/members/snapshots` 的 `vi.fn()`,本用例 per-test 覆盖):

```tsx
  it('父需求工时不 double-count,只算叶子', async () => {
    const { api } = await import('../api')
    ;(api.requirements.list as any).mockResolvedValue([
      { id:1, title:'父', status:'in_progress', assignee:1, est_effort:20, actual_effort:0, planned_start:'2026-07-01', planned_end:'2026-07-10', parent:null, module:'', progress:0, note:'' },
      { id:2, title:'子A', status:'in_progress', assignee:1, est_effort:6, actual_effort:0, planned_start:'2026-07-01', planned_end:'2026-07-10', parent:1, module:'', progress:0, note:'' },
      { id:3, title:'子B', status:'in_progress', assignee:1, est_effort:6, actual_effort:0, planned_start:'2026-07-01', planned_end:'2026-07-10', parent:1, module:'', progress:0, note:'' },
    ])
    render(<Burndown />)
    // 在途总工时 = 只算叶子 6+6 = 12h(父的 20h 被排除,不是 32h)
    await waitFor(() => expect(screen.getAllByText(/12h/).length).toBeGreaterThan(0))
  })
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Burndown.test.tsx`
Expected: FAIL(显示 32h 而非 12h)。

- [ ] **Step 3: 改 `Burndown.tsx` — 叶子 + 同口径**

在 `useMemo` 开头把 reqs 限定为叶子,后续都用 `inFlight`(已基于叶子):

old(第 21-24 行):
```tsx
    const inFlight = reqs.filter(r => !['done', 'paused'].includes(r.status))
    const totalEst = inFlight.reduce((s, r) => s + r.est_effort, 0)
    const totalInv = inFlight.reduce((s, r) => s + r.actual_effort, 0)
    const totalRem = Math.max(0, totalEst - totalInv)
```
new:
```tsx
    // A1: 只算叶子(无子任务),避免父子 double-count
    const leaves = reqs.filter(r => !reqs.some(c => c.parent === r.id))
    const inFlight = leaves.filter(r => !['done', 'paused'].includes(r.status))
    const totalEst = inFlight.reduce((s, r) => s + r.est_effort, 0)
    const totalInv = inFlight.reduce((s, r) => s + r.actual_effort, 0)
    const totalRem = Math.max(0, totalEst - totalInv)
```

A2 同口径:`actualRemain` 改为只算该成员的 `dated` 子集(与 ideal 同口径):

old(第 78-80 行):
```tsx
    const comp = activeMems.map((m, i) => {
      const myInFlight = inFlight.filter(r => r.assignee === m.id)
      const actualRemain = myInFlight.reduce((s, r) => s + Math.max(0, r.est_effort - r.actual_effort), 0)
```
new:
```tsx
    const comp = activeMems.map((m, i) => {
      // A2: actual 与 ideal 同口径,都只算有计划日期的(myDated),否则未排期需求导致恒显"落后"
      const myDated = dated.filter(r => r.assignee === m.id)
      const actualRemain = myDated.reduce((s, r) => s + Math.max(0, r.est_effort - r.actual_effort), 0)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd frontend && npx vitest run src/pages/Burndown.test.tsx`
Expected: 全绿(显示 12h)。

- [ ] **Step 5: 类型检查 + 全量前端**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(burndown): leaves-only rollup + same-scope actual/ideal (Wave 1 Task 4)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 产能叶子 rollup + productivity 折算

**Files:**
- Modify: `frontend/src/pages/Capacity.tsx`
- Modify: `frontend/src/pages/Capacity.test.tsx`

**Interfaces:**
- Produces:`rows` 只对叶子计算;利用率分母用 `week_capacity * PRODUCTIVITY_FACTOR`(默认 0.7),让红色超载阈值在真实负载下触发。

- [ ] **Step 1: 写失败测试**

在 Task 2 重写后的 `Capacity.test.tsx` 的 `describe` 块内追加两个用例(顶部 mock 已提供 `requirements/members` 的 `vi.fn()`)。注意:**用未排期数据测 leaves(不依赖"今天"),用峰值格测 productivity(峰值扫所有日期,也不依赖"今天")**,避免与真实当前日期耦合:

```tsx
  it('父需求工时不 double-count,未排期列只算叶子', async () => {
    const { api } = await import('../api')
    ;(api.requirements.list as any).mockResolvedValue([
      { id:1, title:'父', status:'in_progress', assignee:1, est_effort:20, actual_effort:0, planned_start:null, planned_end:null, parent:null, module:'', progress:0, note:'' },
      { id:2, title:'子', status:'in_progress', assignee:1, est_effort:8, actual_effort:0, planned_start:null, planned_end:null, parent:1, module:'', progress:0, note:'' },
    ])
    render(<Capacity />)
    // 未排期列只算叶子 8h(不是 28h)
    await waitFor(() => expect(screen.getAllByText('8').length).toBeGreaterThan(0))
    expect(screen.queryByText('28')).not.toBeInTheDocument()
  })

  it('productivity 折算后,峰值负载触发红色', async () => {
    const { api } = await import('../api')
    // est=24 排在 07-07~07-11(4天,不含今天): daily=6, peakWeekly=30
    // 名义 40 → 不折算 peakUtil=30/40=0.75(不红); 折算 effectiveCap=28 → 30/28=1.07(红)
    ;(api.requirements.list as any).mockResolvedValue([
      { id:1, title:'需求', status:'in_progress', assignee:1, est_effort:24, actual_effort:0, planned_start:'2026-07-07', planned_end:'2026-07-11', parent:null, module:'', progress:0, note:'' },
    ])
    render(<Capacity />)
    const peakCell = await waitFor(() => screen.getByText('30'))
    expect(peakCell.className).toContain('text-red-600')
  })
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Capacity.test.tsx`
Expected: FAIL(当前算 28h/未折算 → 不超载)。

- [ ] **Step 3: 改 `Capacity.tsx`**

文件顶部加常量:

```tsx
// D6: 名义产能折算为实际可用产能(扣会议/CR/支援/面试等非项目时间)。可调。
const PRODUCTIVITY_FACTOR = 0.7
```

`useMemo` 开头限定叶子:

old(第 23-24 行):
```tsx
    return members.filter(m => m.active).map(m => {
      const myReqs = reqs.filter(r => r.assignee === m.id && !['done', 'paused'].includes(r.status))
```
new:
```tsx
    // A1: 只算叶子(无子任务)
    const leaves = reqs.filter(r => !reqs.some(c => c.parent === r.id))
    return members.filter(m => m.active).map(m => {
      const myReqs = leaves.filter(r => r.assignee === m.id && !['done', 'paused'].includes(r.status))
```

利用率分母用折算容量:

old(第 50-59 行):
```tsx
      const unscheduledTotal = unscheduled.reduce((s, r) => s + r.est_effort, 0)
      const currentWeekly = todayLoad * 5
      const cap = m.week_capacity

      return {
        member_id: m.id, member: m.name, capacity: cap,
        currentWeekly: Math.round(currentWeekly),
        peakWeekly: Math.round(peakWeekly),
        unscheduled: Math.round(unscheduledTotal),
        utilization: cap > 0 ? currentWeekly / cap : 0,
        peakUtil: cap > 0 ? peakWeekly / cap : 0,
      }
```
new:
```tsx
      const unscheduledTotal = unscheduled.reduce((s, r) => s + r.est_effort, 0)
      const currentWeekly = todayLoad * 5
      const cap = m.week_capacity
      // D6: 实际可用 = 名义 × 折算系数,让 >100% 在真实负载下触发
      const effectiveCap = cap * PRODUCTIVITY_FACTOR

      return {
        member_id: m.id, member: m.name, capacity: cap,
        currentWeekly: Math.round(currentWeekly),
        peakWeekly: Math.round(peakWeekly),
        unscheduled: Math.round(unscheduledTotal),
        utilization: effectiveCap > 0 ? currentWeekly / effectiveCap : 0,
        peakUtil: effectiveCap > 0 ? peakWeekly / effectiveCap : 0,
      }
```

更新底部说明文案(第 117 行附近),把阈值解释改成折算口径:

old:
```tsx
          <p>绿色 &lt;80% · 黄色 80–100% · 红色 &gt;100%</p>
```
new:
```tsx
          <p>绿色 &lt;80% · 黄色 80–100% · 红色 &gt;100%(利用率按实际可用产能 = 名义 × {PRODUCTIVITY_FACTOR} 折算)</p>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd frontend && npx vitest run src/pages/Capacity.test.tsx`
Expected: 全绿。

- [ ] **Step 5: 全量前端 + 类型检查**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(capacity): leaves-only rollup + productivity factor for realistic overload (Wave 1 Task 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 收尾验证

- [ ] **全栈测试**:`cd backend && .venv/bin/python -m pytest -q` 与 `cd frontend && npx vitest run && npx tsc --noEmit` 均绿。
- [ ] **手动冒烟**(可选):`python manage.py runserver` + `npm run dev`,登录 → 看板拖拽改状态(进度不再被覆盖)→ 产能页(红色在真实负载下出现)→ 燃尽页(无假落后)。
- [ ] **备份**:再跑一次 `python manage.py backup_db` 固化 Wave 1 后的干净状态。
