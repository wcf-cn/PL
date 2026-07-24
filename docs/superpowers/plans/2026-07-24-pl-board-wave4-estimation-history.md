# PL 看板 Wave 4 — 估时反哺 + 流转历史实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) tracking.

**Goal:** 让你越用越准。① done 完成定义(状态=done 强制 progress=100);② 状态变更历史(`last_status_change_at`,回答"卡几天了");③ 估时偏差报表(est vs actual,按人/模块聚合,校准估时直觉);④ 工时非负校验。

**Architecture:** 3 个原子任务,每个结束全栈测试 green。后端加 `last_status_change_at` + `save()` 逻辑 + 校验(Task 1);前端估时偏差报表页(Task 2);看板卡片状态停留角标(Task 3)。

**Tech Stack:** Django+DRF+SQLite(pytest-django),React+TS+Vite(vitest)。

## Global Constraints

- 纯单人自用,严守 YAGNI。
- 后端测试:`cd backend && .venv/bin/python -m pytest`;前端:`cd frontend && npx vitest run && npx tsc --noEmit`。
- 每个 commit 走 Conventional Commits。
- 工时单位人时(h),非负。
- Wave 1-3 已完成。本波在其基础上叠加。progress 已是手动信号(Wave 1),本波只在 status=done 时强制 100。

---

## Task 1: 后端 last_status_change_at + done 定义 + 工时校验

**Files:**
- Modify: `backend/apps/core/models.py`
- Create: `backend/apps/core/migrations/0011_requirement_last_status_change_at.py`
- Modify: `backend/apps/core/tests/test_models.py`(或新建 test_status_history.py)

**Interfaces:**
- Produces: `Requirement.last_status_change_at`(DateTime, null);`save()` 在 status 变化时刷新 `last_status_change_at`,且 status=done 时强制 `progress=100`;`est_effort`/`actual_effort` 加 `MinValueValidator(0)`。

- [ ] **Step 1: 写失败测试**

Create `backend/apps/core/tests/test_status_history.py`:

```python
import pytest
from apps.core.models import Member, Requirement


@pytest.mark.django_db
def test_done_forces_progress_100():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='in_progress', progress=40)
    r.status = 'done'
    r.save()
    r.refresh_from_db()
    assert r.progress == 100


@pytest.mark.django_db
def test_status_change_updates_timestamp():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='backlog')
    first = r.last_status_change_at
    assert first is not None
    r.status = 'in_progress'
    r.save()
    r.refresh_from_db()
    assert r.last_status_change_at >= first


@pytest.mark.django_db
def test_no_status_change_does_not_update_timestamp():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='in_progress', est_effort=10)
    ts = r.last_status_change_at
    r.est_effort = 20
    r.save()
    r.refresh_from_db()
    assert r.last_status_change_at == ts  # 仅改工时,不改状态,时间戳不变
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_status_history.py -v`
Expected: FAIL(last_status_change_at 不存在 / done 未强制 100)

- [ ] **Step 3: 改 `models.py`**

顶部导入加 `from django.core.validators import MinValueValidator`(timezone 已在 Wave 2 导入)。

`Requirement` 加字段(在 `progress` 附近):
```python
    last_status_change_at = models.DateTimeField('状态变更时间', null=True, blank=True)
```
`est_effort`/`actual_effort` 加校验:
```python
    est_effort = models.FloatField('预计工时(h)', default=0, validators=[MinValueValidator(0)])
    actual_effort = models.FloatField('实际工时(h)', default=0, validators=[MinValueValidator(0)])
```

加 `save()` 覆盖(在 `__str__` 前):
```python
    def save(self, *args, **kwargs):
        # done 完成定义:已上线 → 进度强制 100
        if self.status == self.STATUS_DONE:
            self.progress = 100
        # 状态变更历史:检测 status 变化才刷新时间戳
        if self.pk:
            old = Requirement.objects.filter(pk=self.pk).only('status').first()
            if old and old.status != self.status:
                self.last_status_change_at = timezone.now()
        elif self.last_status_change_at is None:
            self.last_status_change_at = timezone.now()
        super().save(*args, **kwargs)
```

- [ ] **Step 4: 生成并执行 migration**

Run: `cd backend && .venv/bin/python manage.py makemigrations core && .venv/bin/python manage.py migrate`
Expected: 生成 `0011_requirement_last_status_change_at.py`(AddField),应用成功。

- [ ] **Step 5: 跑全量后端测试**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: 全绿(约 43 条)。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): last_status_change_at + done->progress=100 + effort validators (Wave 4 Task 1)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 估时偏差报表页 + 路由

**Files:**
- Create: `frontend/src/pages/Estimation.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/Estimation.test.tsx`

**Interfaces:**
- Produces:`/estimation` 路由 + NAV「估时」;按成员 + 按模块两张表,只统计 done 需求(叶子),列 #done / Σest / Σactual / 偏差(actual/est,>1=低估)。

- [ ] **Step 1: 写失败测试 `Estimation.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Estimation from './Estimation'

vi.mock('../api', () => ({
  api: {
    requirements: { list: vi.fn().mockResolvedValue([
      { id:1, title:'A', status:'done', assignee:1, assignee_name:'张三', module:'后端', est_effort:10, actual_effort:18, parent:null },
      { id:2, title:'B', status:'done', assignee:1, assignee_name:'张三', module:'后端', est_effort:5, actual_effort:4, parent:null },
      { id:3, title:'C', status:'in_progress', assignee:1, assignee_name:'张三', module:'后端', est_effort:8, actual_effort:2, parent:null },
    ])},
  },
}))

describe('Estimation', () => {
  it('按人聚合 done 的 est/actual 与偏差', async () => {
    render(<Estimation />)
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument())
    // 只算 2 个 done:Σest=15, Σactual=22, 偏差 22/15≈1.47
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Estimation.test.tsx`
Expected: FAIL(Estimation 不存在)

- [ ] **Step 3: 创建 `Estimation.tsx`**

```tsx
import { useEffect, useState, useMemo } from 'react'
import { api } from '../api'
import type { Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'

function agg(rows: Requirement[], keyFn: (r: Requirement) => string) {
  const groups: Record<string, Requirement[]> = {}
  rows.forEach(r => { const k = keyFn(r) || '未分组'; (groups[k] = groups[k] || []).push(r) })
  return Object.entries(groups).map(([k, rs]) => ({
    key: k,
    count: rs.length,
    est: rs.reduce((s, r) => s + r.est_effort, 0),
    actual: rs.reduce((s, r) => s + r.actual_effort, 0),
  })).sort((a, b) => b.actual - a.actual)
}

export default function Estimation() {
  const [reqs, setReqs] = useState<Requirement[]>([])
  useEffect(() => { api.requirements.list().then(setReqs) }, [])

  const { byMember, byModule } = useMemo(() => {
    const done = reqs.filter(r => r.status === 'done' && !reqs.some(c => c.parent === r.id))
    return { byMember: agg(done, r => r.assignee_name || '未分配'), byModule: agg(done, r => r.module) }
  }, [reqs])

  function Table_(title: string, rows: ReturnType<typeof agg>) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <div className="text-sm text-muted-foreground">暂无已完成需求数据</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>分组</TableHead><TableHead>#done</TableHead>
                <TableHead>Σ预计h</TableHead><TableHead>Σ实际h</TableHead><TableHead>偏差</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(r => {
                  const ratio = r.est > 0 ? r.actual / r.est : 0
                  const pct = Math.round(ratio * 100)
                  return (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.key}</TableCell>
                      <TableCell>{r.count}</TableCell>
                      <TableCell>{r.est}</TableCell>
                      <TableCell>{r.actual}</TableCell>
                      <TableCell>
                        <Badge variant={ratio > 1.2 ? 'destructive' : ratio < 0.9 ? 'secondary' : 'default'}>
                          {pct}%{ratio > 1.2 ? ' 低估' : ratio < 0.9 ? ' 高估' : ' 准'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>估时偏差</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">仅统计已上线需求(叶子)。偏差 = Σ实际 / Σ预计。&gt;120% = 低估,&lt;90% = 高估。帮你校准估时直觉。</CardContent></Card>
      <div className="grid md:grid-cols-2 gap-4">
        {Table_('按成员', byMember)}
        {Table_('按模块', byModule)}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 改 `App.tsx` — 加 /estimation 路由 + NAV**

imports 加 `import Estimation from './pages/Estimation'`。`NAV_ITEMS` 在「聚焦」后加:
```ts
  { href: '#/estimation', label: '估时', icon: '🎯' },
```
Routes 加:
```tsx
                <Route path="/estimation" element={<Estimation />} />
```

- [ ] **Step 5: 跑前端测试 + tsc**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿,tsc 干净。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(estimation): est-vs-actual report by member/module + routing (Wave 4 Task 2)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 看板卡片状态停留角标

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/pages/Board.tsx`
- Modify: `frontend/src/pages/Board.test.tsx`

**Interfaces:**
- Produces: `Requirement.last_status_change_at` 类型;Board 卡片:非 done 且停留 >7 天 → 琥珀"卡 N天"角标。

- [ ] **Step 1: 写失败测试**

Board.test.tsx 加用例:
```tsx
  it('状态停留超7天显示卡顿角标', async () => {
    const { api } = await import('../api')
    const old = new Date(Date.now() - 86400000 * 10).toISOString()
    ;(api.requirements.list as any).mockResolvedValue([
      { id:1, title:'卡住的需求', status:'in_progress', priority:'P1', assignee:1, assignee_name:'张三', module:'', est_effort:8, actual_effort:1, progress:25, planned_start:null, planned_end:null, parent:null, version:null, blocked_by:[], last_status_change_at:old, created_at:old, note:'' },
    ])
    render(<Board />)
    await waitFor(() => expect(screen.getByText('卡住的需求')).toBeInTheDocument())
    expect(screen.getByText(/卡 \d+天/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Board.test.tsx`
Expected: FAIL(无"卡 N天")

- [ ] **Step 3: 改 `types.ts` — Requirement 加 last_status_change_at / created_at**

```ts
  last_status_change_at:string|null;
  created_at:string;
```

- [ ] **Step 4: 改 `Board.tsx` — 状态停留角标**

加 helper(与 riskBadge 并列):
```tsx
function stuckBadge(r: Requirement) {
  if (r.status === 'done') return null
  const ts = r.last_status_change_at || r.created_at
  if (!ts) return null
  const days = Math.round((Date.now() - new Date(ts).getTime()) / 86400000)
  if (days >= 7) return <Badge variant="secondary" className="text-xs">卡 {days}天</Badge>
  return null
}
```
在 RequirementCard 的 meta 行渲染 `{stuckBadge(requirement)}`(与 riskBadge 并列)。

- [ ] **Step 5: 修 Board.test mock — reqs 加 last_status_change_at / created_at**

Board.test.tsx 现有 mock requirement 对象加 `last_status_change_at: null, created_at: ''`(列表 mock + update mock + create mock)。

- [ ] **Step 6: 跑前端测试 + tsc**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿,tsc 干净。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(board): status-stuck badge (>7 days) on cards (Wave 4 Task 3)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 收尾验证

- [ ] 全栈测试绿:后端 pytest、前端 vitest + tsc。
- [ ] 手动冒烟(可选):把一个需求状态改成 done 看 progress 自动变 100;看板看长期 in_progress 的需求显示"卡 N天";估时页看按人/模块的偏差。
- [ ] 备份:`python manage.py backup_db`。
