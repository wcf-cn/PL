# PL 看板 v2 子项目 A — 效能度量 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) tracking.

**Goal:** 状态变更事件日志 + 吞吐量/周期时间/CFD 三个效能图 + 看板 WIP 告警 + 效能导航页。

**Architecture:** 后端加 `RequirementStatusChange` 事件模型(在现有 `Requirement.save()` 状态变更检测处记录),独立 `metrics.py` 聚合模块(单元可测)+ `/api/metrics/flow/` 端点;前端新「效能」页用 recharts 画三图,看板列头加 WIP 计数与超阈值标红。

**Tech Stack:** Django+DRF+SQLite(pytest-django),React+TS+Vite(vitest,recharts)。

## Global Constraints

- 纯单人自用,严守 YAGNI。
- 后端测试 `cd backend && .venv/bin/python -m pytest`;前端 `cd frontend && npx vitest run && npx tsc --noEmit`。
- 每个 commit 走 Conventional Commits。
- 工时单位人时(h)。
- 在 `feat/stage1-mvp` 分支。`Requirement.save()` 已在 Wave 4 实现 status 变更检测(查 old status)。
- 存量需求无事件历史:CFD/throughput 从本功能上线后积累;cycle time 对存量 done 用 `created_at`→`last_status_change_at` 近似回填。

---

## Task 1: RequirementStatusChange 事件日志(后端基础)

**Files:**
- Modify: `backend/apps/core/models.py`
- Modify: `backend/apps/core/admin.py`
- Create: `backend/apps/core/migrations/0012_requirementstatuschange.py`
- Create: `backend/apps/core/tests/test_status_log.py`

**Interfaces:**
- Produces: `RequirementStatusChange` 模型;`Requirement.save()` 在创建时记一条 `from_status=''→初始status`,在状态变更时记一条 `from=old,to=new`。

- [ ] **Step 1: 写失败测试**

Create `backend/apps/core/tests/test_status_log.py`:

```python
import pytest
from apps.core.models import Member, Requirement, RequirementStatusChange


@pytest.mark.django_db
def test_create_records_initial_event():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='backlog')
    events = list(RequirementStatusChange.objects.filter(requirement=r).order_by('changed_at'))
    assert len(events) == 1
    assert events[0].from_status == ''
    assert events[0].to_status == 'backlog'


@pytest.mark.django_db
def test_status_change_records_event():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='backlog')
    r.status = 'in_progress'; r.save()
    r.status = 'done'; r.save()
    events = list(RequirementStatusChange.objects.filter(requirement=r).order_by('changed_at'))
    assert [e.to_status for e in events] == ['backlog', 'in_progress', 'done']
    assert events[1].from_status == 'backlog' and events[1].to_status == 'in_progress'
    assert events[2].from_status == 'in_progress' and events[2].to_status == 'done'


@pytest.mark.django_db
def test_no_status_change_no_event():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='in_progress', est_effort=5)
    n_after_create = RequirementStatusChange.objects.filter(requirement=r).count()
    r.est_effort = 10; r.save()  # 仅改工时
    assert RequirementStatusChange.objects.filter(requirement=r).count() == n_after_create
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_status_log.py -v`
Expected: FAIL(`RequirementStatusChange` 不存在)

- [ ] **Step 3: models.py 加 RequirementStatusChange + 改 save()**

在 `Requirement` 类**之后**(第 81 行 `__str__` 结束后)插入新模型:

```python
class RequirementStatusChange(models.Model):
    requirement = models.ForeignKey(Requirement, on_delete=models.CASCADE, related_name='status_changes',
                                    verbose_name='需求')
    from_status = models.CharField('从状态', max_length=20, blank=True)
    to_status = models.CharField('到状态', max_length=20)
    changed_at = models.DateTimeField('变更时间', auto_now_add=True)

    class Meta:
        verbose_name = '状态变更日志'
        verbose_name_plural = '状态变更日志'
        ordering = ['changed_at']

    def __str__(self):
        return f'{self.requirement_id} {self.from_status}→{self.to_status} @ {self.changed_at}'
```

改 `Requirement.save()`(第 66-77 行)整个替换为:

```python
    def save(self, *args, **kwargs):
        # done 完成定义:已上线 → 进度强制 100
        if self.status == self.STATUS_DONE:
            self.progress = 100
        is_new = self.pk is None
        old_status = None
        if not is_new:
            old = Requirement.objects.filter(pk=self.pk).only('status').first()
            if old:
                old_status = old.status
        status_changed = (not is_new) and (old_status is not None) and (old_status != self.status)
        if status_changed:
            self.last_status_change_at = timezone.now()
        elif is_new and self.last_status_change_at is None:
            self.last_status_change_at = timezone.now()
        super().save(*args, **kwargs)
        # 状态变更事件日志:创建记初始事件,变更记转换事件
        if is_new:
            RequirementStatusChange.objects.create(requirement=self, from_status='', to_status=self.status)
        elif status_changed:
            RequirementStatusChange.objects.create(requirement=self, from_status=old_status, to_status=self.status)
```

(引用 `RequirementStatusChange` 在运行时按模块全局名解析,即使它定义在 `Requirement` 之后也没问题。)

- [ ] **Step 4: admin.py 注册**

imports 加 `RequirementStatusChange`。在 `MilestoneAdmin` 后加:

```python
@admin.register(RequirementStatusChange)
class RequirementStatusChangeAdmin(admin.ModelAdmin):
    list_display = ('requirement', 'from_status', 'to_status', 'changed_at')
    list_filter = ('to_status',)
    search_fields = ('requirement__title',)
```

- [ ] **Step 5: 生成并执行 migration**

Run: `cd backend && .venv/bin/python manage.py makemigrations core && .venv/bin/python manage.py migrate`
Expected: 生成 `0012_requirementstatuschange.py`(CreateModel),应用成功。

- [ ] **Step 6: 跑全量后端测试**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: 全绿(原 ~46 + 新 3 = ~49)。注意:既有创建 Requirement 的测试现在会顺带产生事件记录,不影响断言。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(core): RequirementStatusChange event log (v2-A Task 1)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 效能聚合模块 + /api/metrics/flow/ 端点

**Files:**
- Create: `backend/apps/core/metrics.py`
- Modify: `backend/apps/core/views.py`
- Modify: `backend/apps/core/urls.py`
- Create: `backend/apps/core/tests/test_metrics.py`

**Interfaces:**
- Consumes: `RequirementStatusChange`(Task 1)、`Requirement`。
- Produces: `metrics.flow_metrics()` → `{throughput, cycletime, cfd}`;`GET /api/metrics/flow/`。

- [ ] **Step 1: 写失败测试**

Create `backend/apps/core/tests/test_metrics.py`:

```python
from datetime import timedelta
from django.utils import timezone
import pytest
from apps.core.models import Member, Requirement
from apps.core.metrics import flow_metrics


@pytest.mark.django_db
def test_throughput_counts_done_per_week():
    m = Member.objects.create(name='张三')
    for _ in range(2):
        r = Requirement.objects.create(title='A', assignee=m, status='in_progress')
        r.status = 'done'; r.save()
    data = flow_metrics()
    assert any(b['count'] == 2 for b in data['throughput'])


@pytest.mark.django_db
def test_cycletime_uses_events_then_fallback():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='in_progress')
    r.status = 'done'; r.save()
    data = flow_metrics()
    assert len(data['cycletime']) == 1
    assert data['cycletime'][0]['hours'] >= 0


@pytest.mark.django_db
def test_cfd_has_status_keys_and_rows():
    m = Member.objects.create(name='张三')
    Requirement.objects.create(title='A', assignee=m, status='backlog')
    data = flow_metrics()
    assert len(data['cfd']) >= 1
    row = data['cfd'][-1]
    for s in ['backlog', 'scheduled', 'in_progress', 'testing', 'done', 'blocked', 'paused']:
        assert s in row
    assert row['backlog'] >= 1
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_metrics.py -v`
Expected: FAIL(`metrics` 模块不存在)

- [ ] **Step 3: 创建 `metrics.py`**

Create `backend/apps/core/metrics.py`:

```python
from datetime import timedelta
from django.utils import timezone
from .models import Requirement, RequirementStatusChange

STATUSES = ['backlog', 'scheduled', 'in_progress', 'testing', 'done', 'blocked', 'paused']


def throughput():
    """每周完成需求数(to_status=done 事件按 ISO 周聚合)。"""
    events = RequirementStatusChange.objects.filter(to_status='done').order_by('changed_at')
    buckets = {}
    for e in events:
        iso = e.changed_at.isocalendar()
        key = f'{iso[0]}-W{iso[1]:02d}'
        buckets[key] = buckets.get(key, 0) + 1
    return [{'week': k, 'count': v} for k, v in sorted(buckets.items())]


def cycletime():
    """每个 done 需求:in_progress→done 的小时数(无事件则用 created_at→last_status_change_at 近似)。"""
    out = []
    for r in Requirement.objects.filter(status='done'):
        start = RequirementStatusChange.objects.filter(requirement=r, to_status='in_progress')\
            .order_by('changed_at').first()
        end = RequirementStatusChange.objects.filter(requirement=r, to_status='done')\
            .order_by('changed_at').first()
        if start and end and end.changed_at > start.changed_at:
            hours = (end.changed_at - start.changed_at).total_seconds() / 3600
        elif r.created_at and r.last_status_change_at and r.last_status_change_at > r.created_at:
            hours = (r.last_status_change_at - r.created_at).total_seconds() / 3600
        else:
            continue
        out.append({'id': r.id, 'title': r.title, 'hours': round(hours, 1)})
    return out


def cfd():
    """按日重建各状态累计数量(堆叠面积图用)。上限最近 180 天。"""
    events = list(RequirementStatusChange.objects.order_by('changed_at'))
    if not events:
        return []
    today = timezone.now().date()
    start = events[0].changed_at.date()
    start = max(start, today - timedelta(days=180))
    by_req = {}
    for e in events:
        by_req.setdefault(e.requirement_id, []).append((e.changed_at, e.to_status))
    rows = []
    d = start
    while d <= today:
        counts = {s: 0 for s in STATUSES}
        for evs in by_req.values():
            status_on_d = None
            for (ct, to_st) in evs:  # evs 已按 changed_at 升序
                if ct.date() <= d:
                    status_on_d = to_st
                else:
                    break
            if status_on_d in counts:
                counts[status_on_d] += 1
        row = {'date': d.isoformat()}
        row.update(counts)
        rows.append(row)
        d += timedelta(days=1)
    return rows


def flow_metrics():
    return {'throughput': throughput(), 'cycletime': cycletime(), 'cfd': cfd()}
```

- [ ] **Step 4: views.py 加端点**

imports 区(`from .ai_actions import execute_action` 之后)加:
```python
from .metrics import flow_metrics
```
文件末尾加:
```python
@api_view(['GET'])
def metrics_flow(request):
    return Response(flow_metrics())
```

- [ ] **Step 5: urls.py 注册路由**

imports 加 `metrics_flow`;urlpatterns 加:
```python
    path('metrics/flow/', metrics_flow),
```

- [ ] **Step 6: 跑后端测试 + 端点冒烟**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_metrics.py -v`
Expected: 3 passed
再跑全量:`cd backend && .venv/bin/python -m pytest -q` → 全绿。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(metrics): flow metrics module + /api/metrics/flow/ (v2-A Task 2)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 效能页(前端三图)+ 路由

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Create: `frontend/src/pages/Performance.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/Performance.test.tsx`

**Interfaces:**
- Consumes: `GET /api/metrics/flow/` → `{throughput:[{week,count}], cycletime:[{id,title,hours}], cfd:[{date,backlog,...,paused}]}`。
- Produces:`/performance` 路由 + NAV「效能」;Performance 页(吞吐量折线 + 周期散点 + CFD 堆叠面积)。

- [ ] **Step 1: 写失败测试**

Create `frontend/src/pages/Performance.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Performance from './Performance'

vi.mock('../api', () => ({
  api: {
    metricsFlow: vi.fn().mockResolvedValue({
      throughput: [{ week: '2026-W30', count: 3 }],
      cycletime: [{ id: 1, title: 'A', hours: 12.5 }],
      cfd: [{ date: '2026-07-20', backlog: 1, scheduled: 0, in_progress: 0, testing: 0, done: 0, blocked: 0, paused: 0 }],
    }),
  },
}))

describe('Performance', () => {
  it('渲染三图标题与样本数据', async () => {
    render(<Performance />)
    await waitFor(() => expect(screen.getByText('吞吐量(每周完成)')).toBeInTheDocument())
    expect(screen.getByText('周期时间')).toBeInTheDocument()
    expect(screen.getByText('累积流量图')).toBeInTheDocument()
    expect(screen.getByText('2026-W30')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Performance.test.tsx`
Expected: FAIL(Performance 不存在)

- [ ] **Step 3: types.ts 加类型**

```ts
export interface FlowMetrics {
  throughput: { week: string; count: number }[]
  cycletime: { id: number; title: string; hours: number }[]
  cfd: Array<Record<string, number | string>>
}
```

- [ ] **Step 4: api.ts 加 metricsFlow**

imports 加 `FlowMetrics`;api 对象加:
```ts
  metricsFlow: () => http.get<FlowMetrics>('/api/metrics/flow/').then(r => r.data),
```

- [ ] **Step 5: 创建 Performance.tsx**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { FlowMetrics } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, AreaChart, Area, Legend } from 'recharts'

const CFD_KEYS = ['backlog', 'scheduled', 'in_progress', 'testing', 'done', 'blocked', 'paused'] as const
const CFD_COLORS: Record<string, string> = {
  backlog: '#94a3b8', scheduled: '#3b82f6', in_progress: '#eab308',
  testing: '#a855f7', done: '#22c55e', blocked: '#ef4444', paused: '#64748b',
}

export default function Performance() {
  const [data, setData] = useState<FlowMetrics | null>(null)
  useEffect(() => { api.metricsFlow().then(setData) }, [])
  if (!data) return <Card><CardContent className="p-6 text-sm text-muted-foreground">加载中…</CardContent></Card>
  const median = data.cycletime.length ? data.cycletime.map(c => c.hours).sort((a, b) => a - b)[Math.floor(data.cycletime.length / 2)] : 0
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>吞吐量(每周完成)</CardTitle></CardHeader>
        <CardContent>
          {data.throughput.length === 0 ? <div className="text-sm text-muted-foreground">暂无数据(完成需求后开始积累)</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.throughput}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="完成数" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>周期时间(in_progress→done,小时)</CardTitle></CardHeader>
        <CardContent>
          {data.cycletime.length === 0 ? <div className="text-sm text-muted-foreground">暂无已完成需求数据</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="id" name="需求" tick={{ fontSize: 10 }} />
                <YAxis dataKey="hours" name="小时" tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={data.cycletime} fill="#3b82f6" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
          {data.cycletime.length > 0 && <div className="text-xs text-muted-foreground mt-1">中位周期: {median}h</div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>累积流量图</CardTitle></CardHeader>
        <CardContent>
          {data.cfd.length === 0 ? <div className="text-sm text-muted-foreground">暂无历史(上线后开始积累)</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.cfd}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {CFD_KEYS.map(k => <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={CFD_COLORS[k]} fill={CFD_COLORS[k]} />)}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: App.tsx 加路由 + NAV**

imports 加 `import Performance from './pages/Performance'`。`NAV_ITEMS` 在「估时」后加:
```ts
  { href: '#/performance', label: '效能', icon: '📈' },
```
Routes 加:
```tsx
                <Route path="/performance" element={<Performance />} />
```

- [ ] **Step 7: 跑前端 + tsc**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿,tsc 干净。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(performance): flow metrics page (throughput/cycletime/CFD) + routing (v2-A Task 3)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 看板 WIP 计数 + 超阈值标红

**Files:**
- Modify: `frontend/src/pages/Board.tsx`
- Modify: `frontend/src/pages/Board.test.tsx`

**Interfaces:**
- Produces:看板列头显示该列在途数;超过 `WIP_LIMITS[status]` 整列标红。

- [ ] **Step 1: 写失败测试**

在 `Board.test.tsx` 的 describe 内加(用现有 mock 不够,需多造几条 in_progress):
```tsx
  it('开发中超过 WIP 阈值时列头标红', async () => {
    const { api } = await import('../api')
    ;(api.requirements.list as any).mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => ({
        id: i + 1, title: `需求${i}`, status: 'in_progress', priority: 'P1', assignee: 1, assignee_name: '张三',
        module: '', est_effort: 4, actual_effort: 0, progress: 0, planned_start: null, planned_end: null,
        parent: null, version: null, blocked_by: [], last_status_change_at: null, created_at: '', note: '',
      }))
    )
    render(<Board />)
    await waitFor(() => expect(screen.getByText('需求0')).toBeInTheDocument())
    // 列头 "开发中" 的 Badge 应有红色 class(threshold=5, 6 条超限)
    const header = screen.getByText('开发中').closest('div')
    expect(header?.className).toMatch(/red|destructive|text-red/)
  })
```
(若 class 匹配不稳,改为断言列头区域含 "6" 且有红色样式钩子;以实现里实际用的 class 为准。)

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Board.test.tsx`
Expected: FAIL(列头无超限红色)

- [ ] **Step 3: Board.tsx 加 WIP 阈值 + 列头标红**

在 `Board.tsx` 顶部(组件外,`PRIO_VARIANT` 附近)加常量:
```tsx
const WIP_LIMITS: Record<string, number> = { in_progress: 5, testing: 5 }
```
找到 `Column` 组件里列头那块(显示 `STATUS_LABEL[status]` 与 `<Badge variant="secondary">{items.length}</Badge>` 的 `div`),把列头容器加条件红色 class。把列头 `div` 改为:
```tsx
      <div className={`flex justify-between items-center mb-3 pb-2 border-b ${WIP_LIMITS[status] && items.length > WIP_LIMITS[status] ? 'text-red-600' : ''}`}>
        <h3 className="font-semibold">{STATUS_LABEL[status]}</h3>
        <Badge variant={WIP_LIMITS[status] && items.length > WIP_LIMITS[status] ? 'destructive' : 'secondary'}>{items.length}{WIP_LIMITS[status] ? `/${WIP_LIMITS[status]}` : ''}</Badge>
      </div>
```
(若现有列头结构与上略有出入,以"列头标题 + 数量 Badge"为锚点,把数量 Badge 的 variant 与标题颜色按 `items.length > WIP_LIMITS[status]` 切红。)

- [ ] **Step 4: 跑前端 + tsc**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(board): WIP count + over-limit red on column headers (v2-A Task 4)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 收尾验证

- [ ] 全栈绿:后端 pytest、前端 vitest + tsc。
- [ ] 手动冒烟:把几个需求状态从 in_progress→done,看效能页吞吐量/周期/CFD 出数据;开发中堆 >5 条看列头变红。
- [ ] 备份:`python manage.py backup_db`。
