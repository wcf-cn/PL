# PL 看板 Wave 3 — 风险可见性实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) tracking.

**Goal:** 把"翻 7 列找问题"变成"打开 App 第一眼看到风险":看板卡片风险角标(超期/将至/被阻塞)、看板筛选条、横向依赖 `blocked_by`、以及一个 Focus 风险驾驶舱页(超期·将至·被阻塞·版本风险·超载 一屏汇总)。

**Architecture:** 3 个原子任务,每个结束全栈测试 green。先加后端 `blocked_by` 依赖(Task 1),再在看板加风险角标+筛选条(Task 2),最后建 Focus 页(Task 3)。风险/超载计算全在前端基于已有数据(reqs/members/versions)做,不新建聚合端点(YAGNI)。

**Tech Stack:** Django+DRF+SQLite(pytest-django),React+TS+Vite(vitest)。

## Global Constraints

- 纯单人自用,严守 YAGNI。
- 后端测试:`cd backend && .venv/bin/python -m pytest`;前端:`cd frontend && npx vitest run && npx tsc --noEmit`。
- 每个 commit 走 Conventional Commits。
- 工时单位人时(h)。
- **Rollup 语义(沿用)**:剩余/负载只算叶子 `reqs.filter(r => !reqs.some(c => c.parent === r.id))`。
- **风险阈值(固定,写死前端)**:超期 = `planned_end < 今天` 且状态非 done/paused;将至 = `planned_end` 在今天..今天+2 且非 done/paused;版本风险 = 版本 freeze/test 日期 ≤ 今天+3 且有未完成叶子需求;超载 = 成员在途叶子 est_effort > `week_capacity × 0.7`。
- Wave 1+2 已完成(Sprint 删、progress 手动、rollup 叶子化、Version 已加)。本波叠加。

---

## Task 1: 后端 Requirement.blocked_by 横向依赖

**Files:**
- Modify: `backend/apps/core/models.py`
- Modify: `backend/apps/core/admin.py`
- Create: `backend/apps/core/migrations/0010_requirement_blocked_by.py`
- Create: `backend/apps/core/tests/test_blocked_by.py`

**Interfaces:**
- Produces: `Requirement.blocked_by` M2M(self, symmetrical=False);serializer(fields='__all__')自动暴露 `blocked_by` 为 PK 列表;`/api/requirements/{id}/` 的 PATCH 可设置 blocked_by。

- [ ] **Step 1: 写失败测试 `test_blocked_by.py`**

Create `backend/apps/core/tests/test_blocked_by.py`:

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
def test_blocked_by_exposed_in_serializer(client):
    m = Member.objects.create(name='张三')
    a = Requirement.objects.create(title='A', assignee=m)
    b = Requirement.objects.create(title='B', assignee=m)
    b.blocked_by.add(a)
    data = client.get(f'/api/requirements/{b.id}/').data
    assert a.id in data['blocked_by']
    # symmetrical=False: 反向不自动建立
    data_a = client.get(f'/api/requirements/{a.id}/').data
    assert b.id not in data_a['blocked_by']


@pytest.mark.django_db
def test_set_blocked_by_via_patch(client):
    m = Member.objects.create(name='张三')
    a = Requirement.objects.create(title='A', assignee=m)
    b = Requirement.objects.create(title='B', assignee=m)
    r = client.patch(f'/api/requirements/{b.id}/', {'blocked_by': [a.id]})
    assert r.status_code == 200
    assert a.id in r.data['blocked_by']
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_blocked_by.py -v`
Expected: FAIL(blocked_by 不存在)

- [ ] **Step 3: 改 `models.py` — Requirement 加 blocked_by M2M**

在 `Requirement` 类内 `parent` 字段后加:

```python
    blocked_by = models.ManyToManyField('self', symmetrical=False, blank=True, verbose_name='被阻塞于')
```

- [ ] **Step 4: 生成并执行 migration**

Run: `cd backend && .venv/bin/python manage.py makemigrations core && .venv/bin/python manage.py migrate`
Expected: 生成 `0010_requirement_blocked_by.py`(AddField M2M),应用成功。

- [ ] **Step 5: 改 `admin.py` — RequirementAdmin 加 filter_horizontal**

RequirementAdmin 加 `filter_horizontal = ('blocked_by',)`(M2M 在 admin 用水平选择器更友好)。

- [ ] **Step 6: 跑全量后端测试**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: 全绿(含新 test_blocked_by.py,约 40 条)。serializer 自动暴露 blocked_by 为 PK 列表(fields='__all__'),无需改 serializer。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(core): Requirement.blocked_by self-M2M dependency (Wave 3 Task 1)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 看板风险角标 + 筛选条

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/pages/Board.tsx`
- Modify: `frontend/src/pages/Board.test.tsx`

**Interfaces:**
- Produces: `Requirement.blocked_by: number[]`;Board 卡片显示 超期红/将至黄/被阻塞🔒 角标;Board 顶部筛选条(assignee/module/priority)。

- [ ] **Step 1: 写失败测试**

在 `Board.test.tsx` 的 describe 块内加用例(顶部 vi.mock 已提供 requirements/members/versions):

```tsx
  it('超期需求显示红色角标', async () => {
    const { api } = await import('../api')
    const past = new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0]
    ;(api.requirements.list as any).mockResolvedValue([
      { id:1, title:'延期需求', status:'in_progress', priority:'P1', assignee:1, assignee_name:'张三', module:'', est_effort:8, actual_effort:2, progress:25, planned_start:'2026-07-01', planned_end:past, parent:null, version:null, blocked_by:[], note:'' },
    ])
    render(<Board />)
    await waitFor(() => expect(screen.getByText('延期需求')).toBeInTheDocument())
    expect(screen.getByText(/超期/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Board.test.tsx`
Expected: FAIL(无"超期"角标)

- [ ] **Step 3: 改 `types.ts` — Requirement 加 blocked_by**

`Requirement` 接口加:
```ts
  blocked_by:number[];
```

- [ ] **Step 4: 改 `Board.tsx` — 风险角标 + 筛选条**

(a) 顶部加筛选 state(与现有 versionFilter 并列):
```tsx
  const [assigneeFilter, setAssigneeFilter] = useState<number | null>(null)
  const [moduleFilter, setModuleFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
```

(b) 在按钮行(version filter 旁)加筛选条。派生选项:
```tsx
  const modules = Array.from(new Set(items.map(r => r.module).filter(Boolean)))
```
筛选 JSX(放在 version filter Select 之后):
```tsx
  <Select value={assigneeFilter?.toString() ?? ''} onValueChange={(v) => setAssigneeFilter(v ? Number(v) : null)}>
    <SelectTrigger className="w-28"><SelectValue placeholder="负责人" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="">全部负责人</SelectItem>
      {members.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
    </SelectContent>
  </Select>
  <Select value={moduleFilter || '__all__'} onValueChange={(v) => setModuleFilter(v === '__all__' ? '' : v)}>
    <SelectTrigger className="w-28"><SelectValue placeholder="模块" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="__all__">全部模块</SelectItem>
      {modules.map(mo => <SelectItem key={mo} value={mo}>{mo}</SelectItem>)}
    </SelectContent>
  </Select>
  <Select value={priorityFilter || '__all__'} onValueChange={(v) => setPriorityFilter(v === '__all__' ? '' : v)}>
    <SelectTrigger className="w-24"><SelectValue placeholder="优先级" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="__all__">全部优先级</SelectItem>
      {['P0','P1','P2'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
    </SelectContent>
  </Select>
```

(c) 改列渲染的 items 过滤,叠加新筛选:
```tsx
  items.filter(r => r.status === st && !r.parent
    && (versionFilter === null || r.version === versionFilter)
    && (assigneeFilter === null || r.assignee === assigneeFilter)
    && (moduleFilter === '' || r.module === moduleFilter)
    && (priorityFilter === '' || r.priority === priorityFilter))
```

(d) 在 `RequirementCard` 内加风险角标。在卡片标题行下方/角标区加:
```tsx
function riskBadge(r: Requirement) {
  const today = new Date(); today.setHours(0,0,0,0)
  if (!r.planned_end || ['done','paused'].includes(r.status)) return null
  const end = new Date(r.planned_end)
  const days = Math.round((end.getTime() - today.getTime()) / 86400000)
  if (days < 0) return <Badge variant="destructive" className="text-xs">超期 {-days}天</Badge>
  if (days <= 2) return <Badge variant="secondary" className="text-xs">将至 {days}天</Badge>
  return null
}
```
在 RequirementCard 的 meta 行(`预计 Xh` 那一行)渲染 `{riskBadge(requirement)}`;若 `requirement.blocked_by.length > 0` 加 `<Badge variant="outline" className="text-xs">🔒 被阻塞({requirement.blocked_by.length})</Badge>`。

- [ ] **Step 5: 修 Board.test mock — reqs 加 blocked_by:[]**

Board.test.tsx 里所有 mock requirement 对象加 `blocked_by: []`(列表 mock + update mock + create mock)。

- [ ] **Step 6: 跑前端测试 + tsc**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿,tsc 干净。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(board): risk badges (overdue/due/blocked) + filter bar (Wave 3 Task 2)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Focus 风险驾驶舱页 + 路由

**Files:**
- Create: `frontend/src/pages/Focus.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/Focus.test.tsx`

**Interfaces:**
- Produces:`/focus` 路由 + NAV「聚焦」;Focus 页分区:超期 / 将至 / 被阻塞 / 版本风险 / 超载成员。

- [ ] **Step 1: 写失败测试 `Focus.test.tsx`**

Create `frontend/src/pages/Focus.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Focus from './Focus'

vi.mock('../api', () => ({
  api: {
    requirements: { list: vi.fn().mockResolvedValue([
      { id:1, title:'超期A', status:'in_progress', planned_end:'2020-01-01', est_effort:8, actual_effort:2, assignee:1, assignee_name:'张三', module:'', priority:'P1', parent:null, version:null, blocked_by:[], note:'' },
    ])},
    members: { list: vi.fn().mockResolvedValue([{ id:1, name:'张三', week_capacity:40, modules:'', active:true }]) },
    versions: { list: vi.fn().mockResolvedValue([]) },
  },
}))

describe('Focus', () => {
  it('列出超期风险', async () => {
    render(<Focus />)
    await waitFor(() => expect(screen.getByText('超期A')).toBeInTheDocument())
    expect(screen.getByText(/超期/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Focus.test.tsx`
Expected: FAIL(Focus 不存在)

- [ ] **Step 3: 创建 `Focus.tsx`**

```tsx
import { useEffect, useState, useMemo } from 'react'
import { api } from '../api'
import type { Requirement, Member, Version } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

const PRODUCTIVITY_FACTOR = 0.7 // 与 Capacity.tsx 一致;实际可用产能

function Section({ title, items, color }:{ title:string; items:{id:number|string;text:string;sub?:string}[]; color:string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><span>{color}</span>{title}<Badge variant="secondary">{items.length}</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 && <div className="text-sm text-muted-foreground">无</div>}
        {items.map(it => (
          <div key={it.id} className="text-sm">
            <span className="font-medium">{it.text}</span>
            {it.sub && <span className="text-muted-foreground ml-2 text-xs">{it.sub}</span>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function Focus() {
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [versions, setVersions] = useState<Version[]>([])

  useEffect(() => {
    api.requirements.list().then(setReqs)
    api.members.list().then(setMembers)
    api.versions.list().then(setVersions)
  }, [])

  const { overdue, upcoming, blocked, versionRisks, overloaded } = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const leaves = reqs.filter(r => !reqs.some(c => c.parent === r.id))
    const active = (r: Requirement) => !['done','paused'].includes(r.status)
    const overdue = leaves.filter(r => r.planned_end && active(r) && new Date(r.planned_end) < today)
      .map(r => ({ id:r.id, text:r.title, sub:`${r.assignee_name||'未分配'} · 应完成 ${r.planned_end}` }))
    const upcoming = leaves.filter(r => {
      if (!r.planned_end || !active(r)) return false
      const d = Math.round((new Date(r.planned_end).getTime() - today.getTime()) / 86400000)
      return d >= 0 && d <= 2
    }).map(r => ({ id:r.id, text:r.title, sub:`${r.assignee_name||'未分配'} · ${r.planned_end}` }))
    const blocked = leaves.filter(r => r.blocked_by.length > 0 || r.status === 'blocked')
      .map(r => ({ id:r.id, text:r.title, sub:`${r.assignee_name||'未分配'}${r.blocked_by.length ? ` · 被${r.blocked_by.length}项阻塞` : ''}` }))
    const versionRisks: {id:number|string;text:string;sub?:string}[] = []
    versions.forEach(v => {
      const vLeaves = reqs.filter(r => r.version === v.id && !reqs.some(c => c.parent === r.id))
      const unfinished = vLeaves.filter(r => !['done','paused'].includes(r.status)).length
      ;([['freeze_date','封板'],['test_date','转测']] as const).forEach(([k, label]) => {
        const d = v[k] as string | null
        if (!d) return
        const diff = Math.round((new Date(d).getTime() - today.getTime()) / 86400000)
        if (diff <= 3) versionRisks.push({ id:`${v.id}-${k}`, text:`${v.name} ${label}`, sub:`${d}${unfinished ? ` · ${unfinished}项未完成` : ''}` })
      })
    })
    const overloaded = members.filter(m => m.active).map(m => {
      const load = reqs.filter(r => r.assignee === m.id && !['done','paused'].includes(r.status) && !reqs.some(c => c.parent === r.id))
        .reduce((s, r) => s + r.est_effort, 0)
      const cap = m.week_capacity * PRODUCTIVITY_FACTOR
      return { m, load, cap }
    }).filter(x => x.cap > 0 && x.load > x.cap)
      .map(x => ({ id:x.m.id, text:x.m.name, sub:`${x.load}h > 可用${Math.round(x.cap)}h` }))
    return { overdue, upcoming, blocked, versionRisks, overloaded }
  }, [reqs, members, versions])

  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>风险驾驶舱</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">一屏看到需要先处理的问题。各分区为空即无该类风险。</CardContent></Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="超期" color="🔴" items={overdue} />
        <Section title="将至(2天内)" color="🟡" items={upcoming} />
        <Section title="被阻塞" color="🔒" items={blocked} />
        <Section title="版本风险(3天内封板/转测)" color="🏷️" items={versionRisks} />
        <Section title="超载成员" color="⚠️" items={overloaded} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 改 `App.tsx` — 加 /focus 路由 + NAV**

imports 加 `import Focus from './pages/Focus'`。`NAV_ITEMS` 在「版本」后加:
```ts
  { href: '#/focus', label: '聚焦', icon: '🚨' },
```
Routes 加:
```tsx
                <Route path="/focus" element={<Focus />} />
```

- [ ] **Step 5: 跑前端测试 + tsc**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿,tsc 干净。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(focus): risk dashboard page (overdue/due/blocked/version/overload) + routing (Wave 3 Task 3)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 收尾验证

- [ ] 全栈测试绿:后端 pytest、前端 vitest + tsc。
- [ ] 手动冒烟(可选):建两个需求 A、B,B.blocked_by=[A];看板看 B 的🔒角标;A planned_end 设过去日期看红色超期角标;Focus 页列出超期/被阻塞;版本 freeze_date 设近未来看版本风险。
- [ ] 备份:`python manage.py backup_db`。
