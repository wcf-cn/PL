# PL 看板 Wave 2 — 版本管理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) tracking.

**Goal:** 新增 `Version` 模型(联调/封板/转测/发布 4 个阶段日期),需求可关联版本;新增版本列表页(进度聚合 + 当前阶段),看板按版本筛选,甘特图标版本节点竖线。版本接棒被删除的 Sprint 成为需求分组单位。

**Architecture:** 3 个原子任务,每个结束全栈测试 green。先建后端模型+API(Task 1),再建前端版本页+路由(Task 2),最后甘特图节点+看板筛选(Task 3)。版本进度在前端按 requirements 聚合计算(YAGNI,不新建聚合端点)。

**Tech Stack:** Django+DRF+SQLite(pytest-django),React+TS+Vite(vitest),recharts/Gantt 自绘时间轴。

## Global Constraints

- 纯单人自用,严守 YAGNI。一个需求只归属一个版本(单 FK)。
- 后端测试:`cd backend && .venv/bin/python -m pytest`;前端:`cd frontend && npx vitest run && npx tsc --noEmit`。
- 每个 commit 走 Conventional Commits。
- 工时单位人时(h)。
- **Rollup 语义(沿用 Wave 1)**:剩余工时只算叶子需求。前端 `reqs.filter(r => !reqs.some(c => c.parent === r.id))`。
- 4 个阶段日期用**固定字段**(integration/freeze/test/release),可空;当前阶段由 `@property` 从日期派生,不落库。
- Wave 1 已完成(Sprint 已删,progress 已手动,rollup 已叶子化)。本波在其基础上叠加。

---

## Task 1: 后端 Version 模型 + Requirement.version FK + API

**Files:**
- Modify: `backend/apps/core/models.py`
- Modify: `backend/apps/core/serializers.py`
- Modify: `backend/apps/core/views.py`
- Modify: `backend/apps/core/urls.py`
- Modify: `backend/apps/core/admin.py`
- Create: `backend/apps/core/migrations/0009_version.py`
- Create: `backend/apps/core/tests/test_versions.py`

**Interfaces:**
- Produces: `Version` model with `current_phase` property; `Requirement.version` FK; `VersionSerializer`(含 `current_phase`);`RequirementSerializer.version_name`;`/api/versions/` CRUD;`VersionAdmin`;`RequirementAdmin` 加 version 列。

- [ ] **Step 1: 写失败测试 `test_versions.py`**

Create `backend/apps/core/tests/test_versions.py`:

```python
from datetime import date
from django.utils import timezone
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Version, Requirement, Member


@pytest.fixture
def client():
    User.objects.create_user('pl', password='pw')
    c = APIClient(); c.login(username='pl', password='pw'); return c


def test_current_phase_planning_when_no_dates():
    v = Version.objects.create(name='v1.0')
    assert v.current_phase == '规划中'


def test_current_phase_progresses_with_dates():
    today = timezone.now().date()
    v = Version.objects.create(
        name='v1.0',
        integration_date=today.replace(day=today.day - 10) if today.day > 10 else today,
        release_date=today.replace(day=today.day + 5) if today.day <= 23 else today,
    )
    # 今天已过联调日但未到发布日 → 联调中(或封板/转测,取决于其他日期)
    assert v.current_phase in ('联调中', '封板', '转测中')


def test_current_phase_released():
    today = timezone.now().date()
    v = Version.objects.create(name='v1.0', release_date=today.replace(day=today.day - 1) if today.day > 1 else today)
    assert v.current_phase == '已发布'


@pytest.mark.django_db
def test_version_crud(client):
    r = client.post('/api/versions/', {'name': 'v2.0', 'release_date': '2026-08-01'})
    assert r.status_code == 201
    vid = r.data['id']
    assert r.data['current_phase'] == '规划中'
    r2 = client.get('/api/versions/')
    assert r2.status_code == 200 and any(v['id'] == vid for v in r2.data)


@pytest.mark.django_db
def test_requirement_can_attach_version(client):
    m = Member.objects.create(name='张三')
    v = Version.objects.create(name='v2.0')
    r = client.post('/api/requirements/', {'title': '需求A', 'assignee': m.id, 'version': v.id})
    assert r.status_code == 201
    assert r.data['version'] == v.id
    assert r.data['version_name'] == 'v2.0'
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_versions.py -v`
Expected: FAIL(Version 未定义)

- [ ] **Step 3: 改 `models.py` — 加 Version 类 + Requirement.version**

在 `models.py` 顶部导入加 `from django.utils import timezone`(若未有)。

在 `Requirement` 类内 `parent` 字段后加 version FK:

```python
    version = models.ForeignKey('Version', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='requirements', verbose_name='目标版本')
```

在文件末尾(MilestoneDailySnapshot 之后或末尾)加 Version 模型:

```python
class Version(models.Model):
    name = models.CharField('版本', max_length=64)
    integration_date = models.DateField('联调日', null=True, blank=True)
    freeze_date = models.DateField('封板日', null=True, blank=True)
    test_date = models.DateField('转测日', null=True, blank=True)
    release_date = models.DateField('发布日', null=True, blank=True)
    note = models.TextField('备注', blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '版本'
        verbose_name_plural = '版本'
        ordering = ['-release_date', '-created_at']

    def __str__(self):
        return self.name

    @property
    def current_phase(self):
        today = timezone.now().date()
        if self.release_date and today >= self.release_date:
            return '已发布'
        if self.test_date and today >= self.test_date:
            return '转测中'
        if self.freeze_date and today >= self.freeze_date:
            return '封板'
        if self.integration_date and today >= self.integration_date:
            return '联调中'
        return '规划中'
```

- [ ] **Step 4: 生成并执行 migration**

Run: `cd backend && .venv/bin/python manage.py makemigrations core && .venv/bin/python manage.py migrate`
Expected: 生成 `0009_version.py`(AddField version + CreateModel Version),`Applying core.0009_version... OK`。

- [ ] **Step 5: 改 `serializers.py`**

imports 加 `Version`:
```python
from .models import Member, Requirement, Milestone, Version
```

加 VersionSerializer,RequirementSerializer 加 version_name:

```python
class RequirementSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source='assignee.name', read_only=True)
    version_name = serializers.CharField(source='version.name', read_only=True, default='')
    class Meta:
        model = Requirement
        fields = '__all__'

class VersionSerializer(serializers.ModelSerializer):
    current_phase = serializers.CharField(read_only=True)
    class Meta:
        model = Version
        fields = '__all__'
```

- [ ] **Step 6: 改 `views.py` — 加 VersionViewSet**

imports 加 `Version`、`VersionSerializer`:
```python
from .models import Member, Requirement, Milestone, MemberDailySnapshot, Version
from .serializers import MemberSerializer, RequirementSerializer, MilestoneSerializer, VersionSerializer
```

在 MilestoneViewSet 后加:
```python
class VersionViewSet(viewsets.ModelViewSet):
    queryset = Version.objects.all()
    serializer_class = VersionSerializer
```

- [ ] **Step 7: 改 `urls.py` — 注册 versions 路由**

imports 加 `VersionViewSet`;router 注册:
```python
router.register('versions', VersionViewSet)
```

- [ ] **Step 8: 改 `admin.py` — 注册 VersionAdmin + Requirement 加 version 列**

imports 加 `Version`。加:
```python
@admin.register(Version)
class VersionAdmin(admin.ModelAdmin):
    list_display = ('name', 'integration_date', 'freeze_date', 'test_date', 'release_date')
    list_filter = ()
    search_fields = ('name', 'note')
```
RequirementAdmin 的 list_display/list_filter 末尾加 `'version'`。

- [ ] **Step 9: 跑全量后端测试**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: 全绿(含新 test_versions.py,共约 38 条)。

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(versions): Version model (4 phase dates + current_phase) + Requirement.version FK (Wave 2 Task 1)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 前端 Version 类型/api + 版本列表页 + 路由

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/Versions.tsx`
- Test: `frontend/src/pages/Versions.test.tsx`

**Interfaces:**
- Produces: `Version` interface(含 `current_phase`);`api.versions` CRUD;`Requirement.version`/`version_name`;`/versions` 路由 + NAV 项「版本」;Versions 页(进度聚合 + 当前阶段色 + 4 阶段时间线)。

- [ ] **Step 1: 写失败测试 `Versions.test.tsx`**

Create `frontend/src/pages/Versions.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Versions from './Versions'

vi.mock('../api', () => ({
  api: {
    versions: { list: vi.fn().mockResolvedValue([
      { id:1, name:'v1.0', integration_date:'2026-07-01', freeze_date:'2026-07-10', test_date:'2026-07-12', release_date:'2026-07-20', note:'', current_phase:'已发布', created_at:'', updated_at:'' },
    ])},
    requirements: { list: vi.fn().mockResolvedValue([
      { id:1, title:'A', status:'done', version:1, est_effort:8, actual_effort:8, parent:null },
      { id:2, title:'B', status:'in_progress', version:1, est_effort:4, actual_effort:1, parent:null },
    ])},
  },
}))

describe('Versions', () => {
  it('渲染版本名、当前阶段、进度', async () => {
    render(<Versions />)
    await waitFor(() => expect(screen.getByText('v1.0')).toBeInTheDocument())
    expect(screen.getByText('已发布')).toBeInTheDocument()
    // 2 个需求,1 已上线 → 进度 50%
    expect(screen.getByText(/50%/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Versions.test.tsx`
Expected: FAIL(Versions 不存在)

- [ ] **Step 3: 改 `types.ts` — 加 Version,Requirement 加 version**

加:
```ts
export interface Version {
  id:number;
  name:string;
  integration_date:string|null;
  freeze_date:string|null;
  test_date:string|null;
  release_date:string|null;
  note:string;
  current_phase:string;
  created_at:string;
  updated_at:string;
}
```
`Requirement` 接口加两个字段:
```ts
  version:number|null;
  version_name?:string;
```

- [ ] **Step 4: 改 `api.ts` — 加 versions CRUD**

imports 加 `Version`;api 对象 members 后加:
```ts
  versions: crud<Version>('/api/versions/'),
```

- [ ] **Step 5: 创建 `Versions.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Version, Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

const PHASE_DATES: Array<[keyof Version, string]> = [
  ['integration_date', '联调'],
  ['freeze_date', '封板'],
  ['test_date', '转测'],
  ['release_date', '发布'],
]

function phaseVariant(p: string) {
  if (p === '已发布') return 'secondary' as const
  if (p === '规划中') return 'outline' as const
  return 'default' as const
}

export default function Versions() {
  const [versions, setVersions] = useState<Version[]>([])
  const [reqs, setReqs] = useState<Requirement[]>([])

  useEffect(() => {
    api.versions.list().then(setVersions)
    api.requirements.list().then(setReqs)
  }, [])

  return (
    <Card>
      <CardHeader><CardTitle>版本管理</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {versions.length === 0 && <div className="text-sm text-muted-foreground">暂无版本</div>}
        {versions.map(v => {
          const leaves = reqs.filter(r => r.version === v.id && !reqs.some(c => c.parent === r.id))
          const total = leaves.length
          const done = leaves.filter(r => r.status === 'done').length
          const pct = total > 0 ? Math.round(done / total * 100) : 0
          const remaining = leaves.filter(r => !['done', 'paused'].includes(r.status))
            .reduce((s, r) => s + Math.max(0, r.est_effort - r.actual_effort), 0)
          return (
            <Card key={v.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{v.name}</span>
                  <Badge variant={phaseVariant(v.current_phase)}>{v.current_phase}</Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {PHASE_DATES.map(([k, label]) => (
                    <span key={k}>{label}: <b className="text-foreground">{(v[k] as string) || '—'}</b></span>
                  ))}
                </div>
                <div className="text-xs">
                  进度 <b>{done}/{total}</b> · <b>{pct}%</b> · 剩余 <b>{remaining}h</b>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: 改 `App.tsx` — 加路由 + NAV 项**

imports 加 `import Versions from './pages/Versions'`。
`NAV_ITEMS` 数组加(放在「团队」前):
```ts
  { href: '#/versions', label: '版本', icon: '🏷️' },
```
Routes 加:
```tsx
                <Route path="/versions" element={<Versions />} />
```

- [ ] **Step 7: 跑前端测试 + tsc**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿,tsc 干净。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(frontend): Versions page (progress + current phase) + nav/routing (Wave 2 Task 2)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 看板按版本筛选 + 甘特图版本节点竖线

**Files:**
- Modify: `frontend/src/pages/Board.tsx`
- Modify: `frontend/src/pages/Gantt.tsx`
- Modify: `frontend/src/pages/Board.test.tsx`(可选,若加版本筛选测试)

**Interfaces:**
- Produces:Board 顶部版本筛选下拉(按 `version` 过滤);Gantt 在时间轴画当前各版本的 4 个阶段竖线(用现有 `position()` 定位)。

- [ ] **Step 1: Board 加版本筛选**

在 `Board.tsx` 顶部 state 区加:
```tsx
  const [versions, setVersions] = useState<Version[]>([])
  const [versionFilter, setVersionFilter] = useState<number | null>(null)
```
imports 加 `Version`:`import { STATUS_LABEL, STATUS_ORDER, type Requirement, type Status, type Member, type Priority, type Version } from '../types'`
useEffect 加:`api.versions.list().then(setVersions)`
在「+ 新建需求」按钮那行的 flex 容器里加版本筛选下拉:
```tsx
  <Select value={versionFilter?.toString() ?? ''} onValueChange={(v) => setVersionFilter(v ? Number(v) : null)}>
    <SelectTrigger id="version-filter" className="w-32"><SelectValue placeholder="全部版本" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="">全部版本</SelectItem>
      {versions.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
    </SelectContent>
  </Select>
```
在渲染列时,过滤 items:`items.filter(r => r.status === st && !r.parent && (versionFilter === null || r.version === versionFilter))`。

- [ ] **Step 2: Gantt 画版本节点竖线**

在 `Gantt.tsx` 加 versions state + fetch:
```tsx
  const [versions, setVersions] = useState<Version[]>([])
```
imports 加 `Version`。
useEffect(已有的 api.requirements 旁)加 `api.versions.list().then(setVersions)`。

在时间轴容器(`<div ref={timelineRef}...>` 内部、assignee rows 之前)加版本竖线层。用现有 `dayToX`/`position()` 定位:对每个 version 的每个非空阶段日期,画一条竖线 + label:

```tsx
{versions.flatMap(v => (
  ([
    ['integration_date', v.integration_date, '联调', '#3b82f6'],
    ['freeze_date', v.freeze_date, '封板', '#f59e0b'],
    ['test_date', v.test_date, '转测', '#a855f7'],
    ['release_date', v.release_date, '发布', '#ef4444'],
  ] as const).filter(([, d]) => d).map(([key, d, label, color]) => {
    const x = dayToX(position(d!))
    return (
      <div key={`${v.id}-${key}`} className="absolute top-0 bottom-0 pointer-events-none"
           style={{ left: `${x}px`, borderLeft: `2px dashed ${color}` }}>
        <span className="absolute -top-0 left-1 text-[9px] whitespace-nowrap" style={{ color }}>{label}</span>
      </div>
    )
  })
))}
```
注意:竖线层需要父容器 `position: relative`(timeline 容器已有 `relative`)。日期若落在折叠空段(position 映射到 gap marker 中心)会近似定位,可接受。

- [ ] **Step 3: 跑前端测试 + tsc + 手动冒烟**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿,tsc 干净。(Board.test 现有 mock 未提供 versions — 在 Board.test.tsx 的 vi.mock 里加 `versions: { list: vi.fn().mockResolvedValue([]) }` 以免 `api.versions` 为 undefined。)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(board,gantt): version filter on board + version phase markers on gantt (Wave 2 Task 3)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 收尾验证

- [ ] 全栈测试绿:后端 pytest、前端 vitest + tsc。
- [ ] 手动冒烟(可选):创建版本 → 需求关联版本 → 版本页看进度/阶段 → 看板按版本筛选 → 甘特图标节点。
- [ ] 备份:`python manage.py backup_db`。
