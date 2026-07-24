# PL 看板 v2 子项目 D — 扩展实体 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) tracking.

**Goal:** ① 需求 `kind`(feature/bug)+ 看板角标与筛选;② `TimeEntry` 工时条目(录入后自动同步 `actual_effort`);③ 「路线图」页(版本沿时间轴)。

**Architecture:** 后端加 2 个字段/模型(`kind`、`TimeEntry`)+ 2 个 migration;TimeEntry 增删时重算所属需求的 `actual_effort`(缓存字段保持权威,避免大改序列化器/AI 路径)。前端看板加 bug 角标+kind 筛选、需求编辑加「工时记录」区、新增 Roadmap 页。

**Tech Stack:** Django+DRF+SQLite(pytest-django),React+TS+Vite(vitest)。

## Global Constraints

- 纯单人自用,严守 YAGNI。
- 后端测试 `cd backend && .venv/bin/python -m pytest`;前端 `cd frontend && npx vitest run && npx tsc --noEmit`。
- 每个 commit 走 Conventional Commits。
- 工时单位人时(h),非负。
- **Rollup 语义**:leaves-only 沿用。
- 在 `feat/stage1-mvp` 分支。最新 migration 0012(RequirementStatusChange);本波 0013(kind)、0014(TimeEntry)。
- **#9 偏离说明**:`actual_effort` 不改成序列化器派生只读(那会牵连 AI/admin/多处写入路径);改为 TimeEntry 增删时**自动重算** `requirement.actual_effort = Σ TimeEntry.hours`。用户效果一致(录条目→实际工时跟着变),风险小得多。

---

## Task 1: 需求 kind 字段(feature/bug)

**Files:**
- Modify: `backend/apps/core/models.py`、`serializers.py`、`admin.py`
- Create: `backend/apps/core/migrations/0013_requirement_kind.py`
- Create: `backend/apps/core/tests/test_kind.py`
- Modify: `frontend/src/types.ts`、`pages/Board.tsx`、`pages/Board.test.tsx`

**Interfaces:**
- Produces:`Requirement.kind` choice(feature/bug,默认 feature);序列化暴露;看板卡片 🐛 角标;看板 kind 筛选。

- [ ] **Step 1: 写失败测试(后端)**

Create `backend/apps/core/tests/test_kind.py`:

```python
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Member, Requirement


@pytest.fixture
def client():
    User.objects.create_user('pl', password='pw')
    c = APIClient(); c.login(username='pl', password='pw'); return c


@pytest.mark.django_db
def test_requirement_kind_default_and_set(client):
    m = Member.objects.create(name='张三')
    r = client.post('/api/requirements/', {'title': 'A', 'assignee': m.id, 'kind': 'bug'}).data
    assert r['kind'] == 'bug'
    r2 = client.post('/api/requirements/', {'title': 'B', 'assignee': m.id}).data
    assert r2['kind'] == 'feature'
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_kind.py -v`
Expected: FAIL(kind 不存在)

- [ ] **Step 3: models.py 加 kind**

`Requirement` 类内(`priority` 之后)加:
```python
    KIND_CHOICES = [('feature', '需求'), ('bug', '缺陷')]
    kind = models.CharField('类型', max_length=10, choices=KIND_CHOICES, default='feature')
```

- [ ] **Step 4: 生成并执行 migration**

Run: `cd backend && .venv/bin/python manage.py makemigrations core && .venv/bin/python manage.py migrate`
Expected: 生成 `0013_requirement_kind.py`(AddField),应用成功。

- [ ] **Step 5: admin.py 加 kind**

RequirementAdmin 的 list_display + list_filter 加 `'kind'`;list_editable 加 `'kind'`(在现有 list_editable 元组里)。

- [ ] **Step 6: 跑后端测试**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: 全绿(serializer `fields='__all__'` 自动暴露 kind)。

- [ ] **Step 7: 前端 types.ts + Board(筛选 + 角标 + 表单 kind 选择)**

`types.ts` 的 `Requirement` 加 `kind:'feature'|'bug'`。
`Board.tsx`:
- 加 `kindFilter` state + 一个 kind Select(全部/需求/缺陷)在筛选行;`items.filter` 加 `(kindFilter === '' || r.kind === kindFilter)`。
- 卡片角标:`{requirement.kind === 'bug' && <Badge variant="outline" className="text-xs">🐛</Badge>}`(放在 riskBadge 旁)。
- **表单加「类型」Select**(feature/bug),与现有 status/priority Select 同模式:form state 加 `kind:'feature' as 'feature'|'bug'`;`startEdit` 回填 `kind:item.kind`;两处 setForm 重置加 `kind:'feature'`;createReq payload 加 `kind:form.kind`;表单 JSX 加一个 `<Select>`(选项 需求/缺陷)放在 priority 旁。
Board.test.tsx:所有 mock requirement 对象加 `kind:'feature'`;**create-payload 断言**加 `kind: 'feature'`(在现有 payload 对象里)。

- [ ] **Step 8: 跑前端 + tsc,Commit**

Run: `cd frontend && npx vitest run && npx tsc --noEmit` → 全绿。
```bash
git add -A
git commit -m "feat(core): requirement kind (feature/bug) + board filter/badge (v2-D Task 1)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: TimeEntry 工时条目(自动同步 actual_effort)

**Files:**
- Modify: `backend/apps/core/models.py`、`serializers.py`、`views.py`、`urls.py`、`admin.py`
- Create: `backend/apps/core/migrations/0014_timeentry.py`(含数据回填)
- Create: `backend/apps/core/tests/test_timeentry.py`
- Modify: `frontend/src/types.ts`、`api.ts`、`pages/Board.tsx`

**Interfaces:**
- Produces:`TimeEntry` 模型;`TimeEntry.save()/delete()` 重算 `requirement.actual_effort`;`/api/time-entries/` CRUD(filter `?requirement=`);前端需求编辑「工时记录」区(列表+添加)。

- [ ] **Step 1: 写失败测试**

Create `backend/apps/core/tests/test_timeentry.py`:

```python
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Member, Requirement, TimeEntry


@pytest.fixture
def client():
    User.objects.create_user('pl', password='pw')
    c = APIClient(); c.login(username='pl', password='pw'); return c


@pytest.mark.django_db
def test_timeentry_syncs_actual_effort(client):
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, actual_effort=0)
    client.post('/api/time-entries/', {'requirement': r.id, 'hours': 3, 'note': '开发'})
    client.post('/api/time-entries/', {'requirement': r.id, 'hours': 5})
    r.refresh_from_db()
    assert r.actual_effort == 8


@pytest.mark.django_db
def test_timeentry_filter_by_requirement(client):
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m)
    TimeEntry.objects.create(requirement=r, hours=2)
    data = client.get(f'/api/time-entries/?requirement={r.id}').data
    assert len(data) == 1 and float(data[0]['hours']) == 2
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_timeentry.py -v`
Expected: FAIL(TimeEntry 不存在)

- [ ] **Step 3: models.py 加 TimeEntry**

在 `Requirement` 类**之后**加:
```python
class TimeEntry(models.Model):
    requirement = models.ForeignKey(Requirement, on_delete=models.CASCADE, related_name='timeentries', verbose_name='需求')
    member = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='成员')
    hours = models.FloatField('工时(h)', validators=[MinValueValidator(0)])
    date = models.DateField('日期', null=True, blank=True)
    note = models.TextField('备注', blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '工时记录'
        verbose_name_plural = '工时记录'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'{self.requirement_id} +{self.hours}h'

    def _resync_parent(self):
        total = sum(t.hours for t in TimeEntry.objects.filter(requirement=self.requirement))
        Requirement.objects.filter(pk=self.requirement_id).update(actual_effort=total)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self._resync_parent()

    def delete(self, *args, **kwargs):
        req_id = self.requirement_id
        super().delete(*args, **kwargs)
        total = sum(t.hours for t in TimeEntry.objects.filter(requirement_id=req_id))
        Requirement.objects.filter(pk=req_id).update(actual_effort=total)
```

- [ ] **Step 4: 生成 migration + 数据回填**

Run: `cd backend && .venv/bin/python manage.py makemigrations core` → 生成 `0014_timeentry.py`。
**编辑**该 migration,在 `operations` 列表末尾(`CreateModel` 之后)加数据回填(用 `RunPython`):把每个 `actual_effort>0` 的需求回填一条 TimeEntry。在该 migration 顶部加 `from django.utils import timezone`,operations 末尾加:

```python
def backfill_timeentries(apps, schema_editor):
    Requirement = apps.get_model('core', 'Requirement')
    TimeEntry = apps.get_model('core', 'TimeEntry')
    Member = apps.get_model('core', 'Member')
    today = timezone.now().date()
    for r in Requirement.objects.all():
        if r.actual_effort and r.actual_effort > 0:
            TimeEntry.objects.create(requirement=r, member=r.assignee, hours=r.actual_effort,
                                     date=today, note='初始回填')


class Migration(migrations.Migration):
    dependencies = [('core', '0013_requirement_kind')]
    operations = [
        migrations.CreateModel(...),  # 自动生成的,保留
        migrations.RunPython(backfill_timeentries, migrations.RunPython.noop),
    ]
```
Run: `cd backend && .venv/bin/python manage.py migrate` → 应用成功。

- [ ] **Step 5: serializer + viewset + url + admin**

`serializers.py` 加:
```python
from .models import ..., TimeEntry
class TimeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeEntry
        fields = '__all__'
```
`views.py` 加:
```python
from .serializers import ..., TimeEntrySerializer
class TimeEntryViewSet(viewsets.ModelViewSet):
    queryset = TimeEntry.objects.all()
    serializer_class = TimeEntrySerializer
    def get_queryset(self):
        qs = TimeEntry.objects.all()
        rid = self.request.query_params.get('requirement')
        if rid:
            qs = qs.filter(requirement_id=rid)
        return qs
```
`urls.py`:imports 加 `TimeEntryViewSet`;`router.register('time-entries', TimeEntryViewSet)`。
`admin.py`:加 `@admin.register(TimeEntry) class TimeEntryAdmin(admin.ModelAdmin): list_display=('requirement','member','hours','date','note')`。

- [ ] **Step 6: 跑后端测试**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: 全绿(含 2 新 timeentry 测试)。

- [ ] **Step 7: 前端 — types/api/Board 工时记录区**

`types.ts` 加:
```ts
export interface TimeEntry { id:number; requirement:number; member:number|null; hours:number; date:string|null; note:string; created_at:string }
```
`api.ts` imports 加 `TimeEntry`;api 对象加 `timeEntries: crud<TimeEntry>('/api/time-entries/')`。
`Board.tsx`:在需求编辑弹窗里(里程碑区附近)加「工时记录」区——`editingId` 时 `api.timeEntries.list({requirement:String(editingId)}).then(setTimeEntries)`,列出每条(`+Xh 日期 备注`)+ 一个添加表单(hours/date/note → `api.timeEntries.create({requirement:editingId,hours,date,note})` → 刷新 + 重载需求)。新增 state `timeEntries`/`teHours`/`teDate`/`teNote`。添加后 `load()` 刷新需求列表以反映新的 `actual_effort`。

- [ ] **Step 8: 跑前端 + tsc,Commit**

Run: `cd frontend && npx vitest run && npx tsc --noEmit` → 全绿(Board.test mock 不涉及 timeEntries;新增 UI 不破坏现有断言)。
```bash
git add -A
git commit -m "feat(timeentry): TimeEntry model auto-syncs actual_effort + form UI (v2-D Task 2)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Roadmap 路线图页

**Files:**
- Create: `frontend/src/pages/Roadmap.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/Roadmap.test.tsx`

**Interfaces:**
- Produces:`/roadmap` 路由 + NAV「路线」;版本沿横向时间轴排列(每个版本一条横条,跨联调→发布区间)。

- [ ] **Step 1: 写失败测试**

Create `frontend/src/pages/Roadmap.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Roadmap from './Roadmap'

vi.mock('../api', () => ({
  api: {
    versions: { list: vi.fn().mockResolvedValue([
      { id:1, name:'v1.0', integration_date:'2026-07-01', freeze_date:'2026-07-10', test_date:'2026-07-12', release_date:'2026-07-20', note:'', current_phase:'已发布', created_at:'', updated_at:'' },
    ])},
  },
}))

describe('Roadmap', () => {
  it('渲染版本名与标题', async () => {
    render(<Roadmap />)
    await waitFor(() => expect(screen.getByText('路线图')).toBeInTheDocument())
    expect(screen.getByText('v1.0')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Roadmap.test.tsx`
Expected: FAIL(Roadmap 不存在)

- [ ] **Step 3: 创建 Roadmap.tsx**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Version } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

function parse(d: string | null) { return d ? new Date(d).getTime() : null }

export default function Roadmap() {
  const [versions, setVersions] = useState<Version[]>([])
  useEffect(() => { api.versions.list().then(setVersions) }, [])

  const dated = versions.filter(v => parse(v.integration_date) || parse(v.release_date) || parse(v.freeze_date) || parse(v.test_date))
  const times = dated.flatMap(v => [v.integration_date, v.freeze_date, v.test_date, v.release_date].map(parse).filter((x): x is number => x !== null))
  const minT = times.length ? Math.min(...times) : 0
  const maxT = times.length ? Math.max(...times) : 1
  const span = Math.max(1, maxT - minT)

  return (
    <Card>
      <CardHeader><CardTitle>路线图</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {dated.length === 0 && <div className="text-sm text-muted-foreground">暂无带日期的版本</div>}
        {dated.map(v => {
          const start = parse(v.integration_date) || parse(v.freeze_date) || parse(v.test_date) || parse(v.release_date) || minT
          const end = parse(v.release_date) || parse(v.test_date) || parse(v.freeze_date) || parse(v.integration_date) || start
          const left = ((start - minT) / span) * 100
          const width = Math.max(3, ((end - start) / span) * 100)
          return (
            <div key={v.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm font-medium truncate">{v.name}</span>
              <div className="relative flex-1 h-6 bg-muted/40 rounded">
                <div className="absolute h-6 rounded bg-primary/30 border border-primary/50 flex items-center px-1"
                     style={{ left: `${left}%`, width: `${width}%` }}>
                  <Badge variant="outline" className="text-[10px]">{v.current_phase}</Badge>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: App.tsx 加路由 + NAV**

imports 加 `import Roadmap from './pages/Roadmap'`。`NAV_ITEMS` 在「版本」后加:
```ts
  { href: '#/roadmap', label: '路线', icon: '🛣️' },
```
Routes 加:
```tsx
                <Route path="/roadmap" element={<Roadmap />} />
```

- [ ] **Step 5: 跑前端 + tsc,Commit**

Run: `cd frontend && npx vitest run && npx tsc --noEmit` → 全绿。
```bash
git add -A
git commit -m "feat(roadmap): version timeline page + routing (v2-D Task 3)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 收尾验证

- [ ] 全栈绿:后端 pytest、前端 vitest + tsc。
- [ ] 手动冒烟:建一个 bug(kind=bug)看板显🐛+按缺陷筛选;需求编辑里加工时记录看 actual_effort 自动累加;路线图页显示版本条。
- [ ] 备份:`python manage.py backup_db`。
