# 燃尽图每日快照 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** 燃尽图实际线使用真实的每日快照数据(每人每天的剩余工时),而非两点估算。

**Architecture:** 后端 MemberDailySnapshot 模型 + 端点(访问燃尽页时自动 get_or_create 今天快照);前端从快照 API 取真实历史点连线。

**Tech Stack:** Django+DRF(SQLite migration)、React+Recharts。

## Global Constraints

- macOS 执行(venv backend/.venv, Python 3.14);前端 npm --prefix
- 沿用现有模式:DRF @api_view、SessionAuthentication、trailing-slash URL
- commit 带 Co-Authored-By: Claude <noreply@anthropic.com>

---

### Task 1: MemberDailySnapshot 模型 + 端点

**Files:**
- Modify: `backend/apps/core/models.py`
- Create: `backend/apps/core/migrations/0007_memberdailysnapshot.py`(makemigrations)
- Modify: `backend/apps/core/views.py`
- Modify: `backend/apps/core/urls.py`
- Create: `backend/apps/core/tests/test_snapshots.py`

**Interfaces:**
- Produces: `MemberDailySnapshot`(date, member FK, remaining_effort);`GET /api/snapshots/` 返回 `[{date, member, member_id, remaining_effort}]`;访问时自动创建今天快照

- [ ] **Step 1: 写测试**

Create `backend/apps/core/tests/test_snapshots.py`:
```python
import pytest
from datetime import date
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Member, Requirement, Sprint, MemberDailySnapshot

@pytest.fixture
def client():
    User.objects.create_user("pl", password="pw")
    c = APIClient(); c.login(username="pl", password="pw")
    return c

@pytest.fixture
def setup_data():
    m = Member.objects.create(name="张三", week_capacity=40)
    r = Requirement.objects.create(title="测试", assignee=m, est_effort=24, actual_effort=5, status="in_progress")
    return m, r

@pytest.mark.django_db
def test_snapshot_created_on_visit(client, setup_data):
    m, r = setup_data
    resp = client.get("/api/snapshots/")
    assert resp.status_code == 200
    today = date.today().isoformat()
    snap = [s for s in resp.data if s["member_id"] == m.id and s["date"] == today]
    assert len(snap) == 1
    assert snap[0]["remaining_effort"] == 19.0  # 24 - 5

@pytest.mark.django_db
def test_snapshot_idempotent(client, setup_data):
    m, r = setup_data
    client.get("/api/snapshots/")
    client.get("/api/snapshots/")  # 再访问一次
    today = date.today()
    count = MemberDailySnapshot.objects.filter(member=m, date=today).count()
    assert count == 1  # 同一天不重复

@pytest.mark.django_db
def test_snapshot_excludes_done_paused(client):
    m = Member.objects.create(name="李四", week_capacity=40)
    Requirement.objects.create(title="已上线", assignee=m, est_effort=10, status="done")
    resp = client.get("/api/snapshots/")
    today = date.today().isoformat()
    snaps = [s for s in resp.data if s["member_id"] == m.id and s["date"] == today]
    assert len(snaps) == 1
    assert snaps[0]["remaining_effort"] == 0  # 排除 done
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd backend && .venv/bin/pytest apps/core/tests/test_snapshots.py -v`
Expected: FAIL

- [ ] **Step 3: 加模型**

在 `backend/apps/core/models.py` 末尾加:
```python
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

Run: `cd backend && .venv/bin/python manage.py makemigrations core && .venv/bin/python manage.py migrate`

- [ ] **Step 4: 加端点 views.py + urls.py**

在 `backend/apps/core/views.py` 加 import 和视图:
```python
from .models import MemberDailySnapshot

@api_view(["GET"])
def snapshots_view(request):
    # 自动创建今天的快照(get_or_create per member)
    today = timezone.now().date()
    members = Member.objects.filter(active=True)
    for m in members:
        reqs = Requirement.objects.filter(assignee=m).exclude(status__in=['done', 'paused'])
        remaining = sum(max(0, r.est_effort - r.actual_effort) for r in reqs)
        MemberDailySnapshot.objects.get_or_create(
            date=today, member=m, defaults={'remaining_effort': remaining}
        )
    # 返回所有快照
    snaps = MemberDailySnapshot.objects.select_related('member').all()
    return Response([{
        'date': s.date.isoformat(),
        'member_id': s.member_id,
        'member': s.member.name,
        'remaining_effort': s.remaining_effort,
    } for s in snaps])
```

在 `backend/apps/core/urls.py` 的 urlpatterns 加:
```python
from .views import snapshots_view
path("snapshots/", snapshots_view),
```

- [ ] **Step 5: 跑测试通过**

Run: `cd backend && .venv/bin/pytest apps/core/tests/test_snapshots.py -v`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add backend/apps/core/models.py backend/apps/core/migrations/ backend/apps/core/views.py backend/apps/core/urls.py backend/apps/core/tests/test_snapshots.py
git commit -m "feat(core): MemberDailySnapshot model + auto-create on visit endpoint"
```

---

### Task 2: 前端燃尽页改用快照数据

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/pages/Burndown.tsx`

**Interfaces:**
- Consumes: Task 1 `GET /api/snapshots/` → `[{date, member, member_id, remaining_effort}]`
- Produces: Burndown 页用真实快照连线

- [ ] **Step 1: types.ts 加 Snapshot**

```typescript
export interface MemberSnapshot {
  date: string
  member_id: number
  member: string
  remaining_effort: number
}
```

- [ ] **Step 2: api.ts 加 snapshots**

import 加 `MemberSnapshot`,api 对象加:
```typescript
snapshots: () => http.get<MemberSnapshot[]>('/api/snapshots/').then(r => r.data),
```

- [ ] **Step 3: Burndown.tsx 改用快照画实际线**

核心改动:
- 删除之前的 `_actual` 估算逻辑
- 从 `api.snapshots()` 取数据
- 按 member 分组,每人的快照按 date 排序 → 一条 Line
- 理想线(虚线)保留(从 planned_start~end 估算)
- 实际线(实线)= 真实快照点连线

```tsx
const [snapshots, setSnapshots] = useState<MemberSnapshot[]>([])
useEffect(() => { api.snapshots().then(setSnapshots) }, [])

// 实际线数据:按人分组,展开成 {date, memberName: remaining} 格式
const snapshotData = useMemo(() => {
  const byDate: Record<string, Record<string, number>> = {}
  for (const s of snapshots) {
    if (!byDate[s.date]) byDate[s.date] = {}
    byDate[s.date][s.member] = s.remaining_effort
  }
  return Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, vals]) => ({ date, ...vals }))
}, [snapshots])

// 合并理想线 + 实际线到同一数据集
const mergedData = useMemo(() => {
  // 取理想线和快照线的日期并集
  const allDates = new Set<string>()
  chartData.forEach(d => allDates.add(d.date))
  snapshotData.forEach(d => allDates.add(d.date))
  const sorted = Array.from(allDates).sort()
  return sorted.map(ds => {
    const ideal = chartData.find(d => d.date === ds) || {}
    const actual = snapshotData.find(d => d.date === ds) || {}
    return { date: ds, ...ideal, ...actual }
  })
}, [chartData, snapshotData])
```

Line 渲染改为:
```tsx
{activeMembers.map((m, i) => (
  <>
    <Line key={`ideal-${m.id}`} type="monotone" dataKey={`${m.name}_ideal`}
      name={`${m.name}(理想)`} stroke={COLORS[i]} strokeWidth={1.5}
      strokeDasharray="5 5" dot={false} connectNulls />
    <Line key={`actual-${m.id}`} type="monotone" dataKey={m.name}
      name={`${m.name}(实际)`} stroke={COLORS[i]} strokeWidth={2.5}
      dot={{ r: 3 }} connectNulls={false} />
  </>
))}
```

注意:快照数据里 key 是 `member.name`(直接值),理想线 key 是 `member.name + '_ideal'`。这样不冲突。

- [ ] **Step 4: build + commit**

Run: `npm --prefix frontend run build`

```bash
git add frontend/src/types.ts frontend/src/api.ts frontend/src/pages/Burndown.tsx
git commit -m "feat(burndown): use real daily snapshots for actual line"
```

---

## Self-Review

- Task 1:模型 + 端点 + 测试 ✓
- Task 2:前端取真实快照连线 ✓
- 快照自动创建(访问时 get_or_create)✓
- 排除 done/paused ✓
- 同一天幂等(unique_together + get_or_create)✓
- 类型一致:`MemberSnapshot`(Task1 定,Task2 用);`remaining_effort` 字段名一致 ✓

## 执行选择

Plan saved to `docs/superpowers/plans/2026-07-23-burndown-snapshots.md`。
