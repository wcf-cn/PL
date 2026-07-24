# PL 看板 v2 子项目 C — 小工具 + 优化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) tracking.

**Goal:** 5 个快赢小改:CSV 导出、需求搜索、派活负载提示、产能本周精确、Gantt 节点带版本名。

**Architecture:** 后端加 1 个 CSV 导出视图;前端在 Board/Capacity/Gantt 上各做小幅增量。每项独立可测、独立提交。沿用 leaves-only rollup 与 `week_capacity×0.7` 产能口径。

**Tech Stack:** Django+DRF+SQLite(pytest-django),React+TS+Vite(vitest),recharts。

## Global Constraints

- 纯单人自用,严守 YAGNI。
- 后端测试:`cd backend && .venv/bin/python -m pytest`;前端:`cd frontend && npx vitest run && npx tsc --noEmit`。
- 每个 commit 走 Conventional Commits。
- DRF 默认 `IsAuthenticated`(settings.py:53),新端点自动需登录。
- **Rollup 语义**:leaves-only `items.filter(r => !items.some(c => c.parent === r.id))`;产能可用 = `week_capacity × 0.7`。
- 在 `feat/stage1-mvp` 分支。

---

## Task 1: CSV 导出(后端 + 前端按钮)

**Files:**
- Modify: `backend/apps/core/views.py`
- Modify: `backend/apps/core/urls.py`
- Modify: `frontend/src/pages/Board.tsx`
- Test: `backend/apps/core/tests/test_export.py`

**Interfaces:**
- Produces: `GET /api/export/requirements.csv` → CSV 附件(IsAuthenticated);Board 顶部「导出CSV」按钮。

- [ ] **Step 1: 写失败测试**

Create `backend/apps/core/tests/test_export.py`:

```python
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Member, Requirement, Version


@pytest.fixture
def client():
    User.objects.create_user('pl', password='pw')
    c = APIClient(); c.login(username='pl', password='pw'); return c


@pytest.mark.django_db
def test_export_csv(client):
    m = Member.objects.create(name='张三', week_capacity=40)
    v = Version.objects.create(name='v2.0')
    Requirement.objects.create(title='登录', assignee=m, version=v, status='in_progress', est_effort=8)
    r = client.get('/api/export/requirements.csv')
    assert r.status_code == 200
    assert r['Content-Type'].startswith('text/csv')
    body = r.content.decode('utf-8')
    assert '标题' in body.splitlines()[0]
    assert '登录' in body
    assert '张三' in body
    assert 'v2.0' in body


@pytest.mark.django_db
def test_export_requires_auth():
    from rest_framework.test import APIClient
    r = APIClient().get('/api/export/requirements.csv')
    assert r.status_code in (401, 403)
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_export.py -v`
Expected: FAIL(路由不存在 → 404)

- [ ] **Step 3: 后端 `views.py` 加导出视图**

在 `views.py` 顶部导入区加:
```python
import csv
from django.http import HttpResponse
```
在文件末尾(`snapshots_view` 之后)加:
```python
@api_view(['GET'])
def export_requirements(request):
    """导出全量需求为 CSV(IsAuthenticated)。"""
    resp = HttpResponse(content_type='text/csv')
    resp['Content-Disposition'] = 'attachment; filename="requirements.csv"'
    w = csv.writer(resp)
    w.writerow(['id', '标题', '状态', '优先级', '负责人', '模块', '版本',
                '预计工时', '实际工时', '进度', '计划开始', '计划结束', '更新时间'])
    for r in Requirement.objects.select_related('assignee', 'version'):
        w.writerow([
            r.id, r.title, r.get_status_display(), r.priority,
            r.assignee.name if r.assignee else '', r.module,
            r.version.name if r.version else '',
            r.est_effort, r.actual_effort, r.progress,
            r.planned_start or '', r.planned_end or '',
            r.updated_at.strftime('%Y-%m-%d'),
        ])
    return resp
```

- [ ] **Step 4: `urls.py` 注册路由**

old:
```python
from .views import MemberViewSet, RequirementViewSet, MilestoneViewSet, VersionViewSet, login_view, logout_view, me_view, ai_chat, ai_execute, snapshots_view
```
new:
```python
from .views import MemberViewSet, RequirementViewSet, MilestoneViewSet, VersionViewSet, login_view, logout_view, me_view, ai_chat, ai_execute, snapshots_view, export_requirements
```
old:
```python
    path('snapshots/', snapshots_view),
]
```
new:
```python
    path('snapshots/', snapshots_view),
    path('export/requirements.csv', export_requirements),
]
```

- [ ] **Step 5: 跑后端测试**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_export.py -v`
Expected: 2 passed

- [ ] **Step 6: 前端 Board 加「导出CSV」按钮**

在 `Board.tsx` 顶部按钮行(「显示已上线」Button 之后,versionFilter Select 之前)加:
```tsx
        <Button variant="outline" onClick={() => window.open('/api/export/requirements.csv')}>导出CSV</Button>
```

- [ ] **Step 7: 跑前端 + tsc**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿(Board.test 现有断言不涉及该按钮;window.open 在 jsdom 为 no-op,不报错)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(export): requirements CSV export + board button (v2-C Task 1)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 需求搜索

**Files:**
- Modify: `frontend/src/pages/Board.tsx`
- Modify: `frontend/src/pages/Board.test.tsx`

**Interfaces:**
- Produces: Board 顶部搜索框;`items.filter` 增加 title 模糊匹配(与现有筛选 AND)。

- [ ] **Step 1: 写失败测试**

在 `Board.test.tsx` 的 describe 块内加(顶部 vi.mock 已提供 requirements.list):
```tsx
  it('按标题搜索过滤卡片', async () => {
    const { api } = await import('../api')
    ;(api.requirements.list as any).mockResolvedValue([
      { id:1, title:'登录接口', status:'in_progress', priority:'P1', assignee:1, assignee_name:'张三', module:'', est_effort:8, actual_effort:0, progress:0, planned_start:null, planned_end:null, parent:null, version:null, blocked_by:[], last_status_change_at:null, created_at:'', note:'' },
      { id:2, title:'支付接口', status:'in_progress', priority:'P1', assignee:1, assignee_name:'张三', module:'', est_effort:6, actual_effort:0, progress:0, planned_start:null, planned_end:null, parent:null, version:null, blocked_by:[], last_status_change_at:null, created_at:'', note:'' },
    ])
    const user = userEvent.setup()
    render(<Board />)
    await waitFor(() => expect(screen.getByText('登录接口')).toBeInTheDocument())
    await user.type(screen.getByPlaceholderText('搜索标题'), '支付')
    await waitFor(() => expect(screen.queryByText('登录接口')).not.toBeInTheDocument())
    expect(screen.getByText('支付接口')).toBeInTheDocument()
  })
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Board.test.tsx`
Expected: FAIL(无 placeholder="搜索标题" 的输入框)

- [ ] **Step 3: Board 加搜索 state**

在 `Board.tsx` 的 filter state 区(`priorityFilter` 之后)加:
```tsx
  const [searchText, setSearchText] = useState('')
```
(`useState` 已导入。)

- [ ] **Step 4: Board 按钮行加搜索框**

在 `priorityFilter` Select 的 `</Select>` 之后(按钮行 `</div>` 之前)加:
```tsx
        <Input
          placeholder="搜索标题"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-40"
        />
```

- [ ] **Step 5: `items.filter` 加 title 匹配**

old(在 Column 渲染处):
```tsx
          <Column key={st} status={st} items={items.filter(r => r.status === st && !r.parent && (versionFilter === null || r.version === versionFilter) && (assigneeFilter === null || r.assignee === assigneeFilter) && (moduleFilter === '' || r.module === moduleFilter) && (priorityFilter === '' || r.priority === priorityFilter))} allItems={items} onDrop={onDrop} onEdit={startEdit} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
```
new:
```tsx
          <Column key={st} status={st} items={items.filter(r => r.status === st && !r.parent && (versionFilter === null || r.version === versionFilter) && (assigneeFilter === null || r.assignee === assigneeFilter) && (moduleFilter === '' || r.module === moduleFilter) && (priorityFilter === '' || r.priority === priorityFilter) && (searchText === '' || r.title.toLowerCase().includes(searchText.toLowerCase())))} allItems={items} onDrop={onDrop} onEdit={startEdit} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
```

- [ ] **Step 6: 跑前端 + tsc**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(board): title search filter (v2-C Task 2)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 派活负载提示

**Files:**
- Modify: `frontend/src/pages/Board.tsx`
- Modify: `frontend/src/pages/Board.test.tsx`

**Interfaces:**
- Produces: 需求表单「负责人」选中时,旁显其在途负载/利用率,超载(`load > week_capacity×0.7`)标红并提示"超载"。

- [ ] **Step 1: 写失败测试**

在 `Board.test.tsx` 的 vi.mock 里把 members 改为含一个会被判定超载的成员(容量 40 → 可用 28),并加用例:
```tsx
// 在 vi.mock 的 members.list 里(member id 2 容量设小,便于超载):
//   members: { list: vi.fn().mockResolvedValue([
//     { id:1, name:'张三', week_capacity:40, modules:'', active:true },
//     { id:2, name:'李四', week_capacity:10, modules:'', active:true },   // 可用=7
//   ])},
// 并让 requirements.list 含一条分配给李四的在途叶子 est=20(>7 → 超载)
  it('选中超载成员时表单提示超载', async () => {
    const { api } = await import('../api')
    ;(api.requirements.list as any).mockResolvedValue([
      { id:1, title:'大需求', status:'in_progress', priority:'P1', assignee:2, assignee_name:'李四', module:'', est_effort:20, actual_effort:0, progress:0, planned_start:null, planned_end:null, parent:null, version:null, blocked_by:[], last_status_change_at:null, created_at:'', note:'' },
    ])
    const user = userEvent.setup()
    render(<Board />)
    await waitFor(() => expect(screen.getByText('+ 新建需求')).toBeInTheDocument())
    await user.click(screen.getByText('+ 新建需求'))
    // 选负责人 = 李四
    await user.click(screen.getByLabelText('负责人'))
    await user.click(screen.getByText('李四'))
    await waitFor(() => expect(screen.getByText(/超载/)).toBeInTheDocument())
  })
```
(若 `getByLabelText` 在 shadcn Select 上不稳,改用先点开 Select trigger 再点选项;以能选中李四为准。)

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Board.test.tsx`
Expected: FAIL(无"超载"提示)

- [ ] **Step 3: Board 加负载计算 helper 与提示**

在 `Board.tsx` 组件内(`createReq` 之前)加:
```tsx
  // 派活负载提示:所选负责人的在途叶子负载 vs 可用产能(×0.7)
  const assigneeLoad = (() => {
    if (form.assignee == null) return null
    const m = members.find(x => x.id === form.assignee)
    if (!m) return null
    const leaves = items.filter(r => !items.some(c => c.parent === r.id))
    const load = leaves.filter(r => r.assignee === form.assignee && !['done', 'paused'].includes(r.status))
      .reduce((s, r) => s + r.est_effort, 0)
    const cap = m.week_capacity * 0.7
    return { load, cap, util: cap > 0 ? load / cap : 0 }
  })()
```

在表单「负责人」字段块**内部**(该 `<div className="space-y-2">` 里,`</Select>` 之后、该字段 `</div>` 之前)插入提示,使其堆叠在 Select 下方(不占用额外的 2 列网格单元):
```tsx
                  {assigneeLoad && (
                    <div className={`text-xs ${assigneeLoad.util > 1 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      在途 {assigneeLoad.load}h / 可用 {Math.round(assigneeLoad.cap)}h{assigneeLoad.util > 1 ? ' · 超载' : ''}
                    </div>
                  )}
```

- [ ] **Step 4: 跑前端 + tsc**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(board): assignee load hint in requirement form (v2-C Task 3)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 产能「本周负载」精确按重叠天数

**Files:**
- Modify: `frontend/src/pages/Capacity.tsx`
- Modify: `frontend/src/pages/Capacity.test.tsx`

**Interfaces:**
- Produces: `currentWeekly` = Σ(daily_rate × 该需求与本周的重叠天数),替代"日速率×5 粗算"。

- [ ] **Step 1: 写失败测试(用 fake timers 锁定本周)**

在 `Capacity.test.tsx` 加:
```tsx
  it('本周负载按实际重叠天数精确计算', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-22T00:00:00')) // 周三;本周 07-20..07-26
    const { api } = await import('../api')
    // 需求 07-20..07-22(3 天), est=12 → daily=4, 与本周重叠 3 天 → 12h
    ;(api.requirements.list as any).mockResolvedValue([
      { id:1, title:'R', status:'in_progress', assignee:1, est_effort:12, actual_effort:0, planned_start:'2026-07-20', planned_end:'2026-07-22', parent:null, module:'', progress:0, note:'' },
    ])
    render(<Capacity />)
    await waitFor(() => expect(screen.getAllByText('12').length).toBeGreaterThan(0))
    vi.useRealTimers()
  })
```
(本周负载=12h → currentWeekly 单元格显示 12。)

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Capacity.test.tsx`
Expected: FAIL(当前粗算 currentWeekly = daily×5 = 4×5 = 20,显示 20 而非 12)

- [ ] **Step 3: 改 `Capacity.tsx` 的 todayLoad 计算**

old:
```tsx
      // 本周负载:本周(weekStart~weekEnd)与 planned 区间有重叠的需求,贡献其日速率(×5 换算成周)
      const todayLoad = scheduled
        .filter(r => r.planned_start! <= weekEndStr && r.planned_end! >= weekStartStr)
        .reduce((s, r) => s + r.est_effort / daysBetween(r.planned_start!, r.planned_end!), 0)
```
new:
```tsx
      // 本周负载:按本周(weekStart~weekEnd)与 planned 区间的【实际重叠天数】精确累加 daily×overlapDays
      const todayLoad = scheduled
        .filter(r => r.planned_start! <= weekEndStr && r.planned_end! >= weekStartStr)
        .reduce((s, r) => {
          const daily = r.est_effort / daysBetween(r.planned_start!, r.planned_end!)
          const ovStart = Math.max(new Date(r.planned_start!).getTime(), weekStart.getTime())
          const ovEnd = Math.min(new Date(r.planned_end!).getTime(), weekEnd.getTime())
          const overlapDays = Math.max(0, Math.round((ovEnd - ovStart) / 86400000) + 1) // 含首尾
          return s + daily * overlapDays
        }, 0)
```
(`weekStart`/`weekEnd` 已在前面以 Date 对象计算;`weekStartStr`/`weekEndStr` 仍用于 filter 比较。)

并把 `const currentWeekly = todayLoad * 5` 改为不再 ×5(todayLoad 已是本周小时数):
old:
```tsx
      const currentWeekly = todayLoad * 5
```
new:
```tsx
      const currentWeekly = todayLoad
```

- [ ] **Step 4: 跑前端 + tsc(确认新测试过 + 原有 Capacity 测试仍绿)**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿(原有 peak/unscheduled 测试用的是 peakWeekly/unscheduled,不受 currentWeekly 改动影响)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(capacity): weekly load by precise overlap days (v2-C Task 4)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Gantt 版本节点 label 带版本名

**Files:**
- Modify: `frontend/src/pages/Gantt.tsx`
- Modify: `frontend/src/pages/Gantt.test.tsx`

**Interfaces:**
- Produces: Gantt 版本节点竖线 label 形如 `v2.0·封板`(版本名 + 阶段),多版本日期重叠时可区分。

- [ ] **Step 1: 写失败测试**

在 `Gantt.test.tsx` 的 vi.mock 里加一个 version(若未有),并加用例。先确认 mock 含 `versions: { list: vi.fn().mockResolvedValue([{ id:1, name:'v2.0', integration_date:'2026-07-01', freeze_date:'2026-07-03', test_date:null, release_date:null, note:'', current_phase:'联调中', created_at:'', updated_at:'' }]) }`,且 requirements 含一条有 planned 日期的(让时间轴渲染)。加:
```tsx
  it('版本节点 label 带版本名', async () => {
    render(<Gantt />)
    await waitFor(() => expect(screen.getByText('甘特图')).toBeInTheDocument())
    expect(screen.getByText(/v2\.0.*联调/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: 运行确认失败**

Run: `cd frontend && npx vitest run src/pages/Gantt.test.tsx`
Expected: FAIL(当前 label 只有"联调",不含"v2.0")

- [ ] **Step 3: 改 `Gantt.tsx` 节点 label**

old:
```tsx
                    <span className="absolute -top-0 left-1 text-[9px] whitespace-nowrap" style={{ color }}>{label}</span>
```
new:
```tsx
                    <span className="absolute -top-0 left-1 text-[9px] whitespace-nowrap" style={{ color }}>{v.name}·{label}</span>
```

- [ ] **Step 4: 跑前端 + tsc**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(gantt): version name in phase marker label (v2-C Task 5)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 收尾验证

- [ ] 全栈绿:后端 pytest、前端 vitest + tsc。
- [ ] 手动冒烟(浏览器):看板顶部「导出CSV」下载正常;搜索框过滤;新建需求选负责人看负载提示;产能页本周负载与峰值合理;甘特图版本节点带版本名。
