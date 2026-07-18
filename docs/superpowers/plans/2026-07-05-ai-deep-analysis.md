# AI 深度拆解 + 父子需求 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 助手升级为引导式分析框架 + 父子需求。Requirement 加 parent 字段,prompt 改 PL 分析助手,Draft 改 {parent, children} 结构,导入级联,看板父子显示。

**Architecture:** 后端 parent self-FK migration + ai.py prompt/parse 升级;前端 types DraftResult + AssistantWidget 父子草稿 + Board 父子卡片。

**Tech Stack:** Django+DRF(SQLite migration)、智谱 GLM glm-5.2(anthropic 端点)、React+shadcn。

## Global Constraints

- 沿用现有模式:DRF viewsets、NoCSRFSessionAuthentication、trailing-slash URL、anthropic 端点
- macOS 执行(venv backend/.venv, Python 3.14);前端 npm --prefix
- parent 只 1 层(子的子不支持)
- commit 带 Co-Authored-By: Claude <noreply@anthropic.com>

---

### Task 1: Requirement 加 parent 字段

**Files:**
- Modify: `backend/apps/core/models.py`
- Create: `backend/apps/core/migrations/0005_requirement_parent.py`(makemigrations 生成)
- Modify: `backend/apps/core/tests/test_models.py`

**Interfaces:**
- Produces: `Requirement.parent`(self FK,SET_NULL,null,blank)

- [ ] **Step 1: 写测试**

追加到 `backend/apps/core/tests/test_models.py`:
```python
@pytest.mark.django_db
def test_requirement_parent():
    from apps.core.models import Requirement, Member, Sprint
    from datetime import date
    m = Member.objects.create(name="张三")
    s = Sprint.objects.create(name="S1", start_date=date(2026,7,6), end_date=date(2026,7,20))
    parent = Requirement.objects.create(title="父需求", assignee=m, assigned_sprint=s)
    child = Requirement.objects.create(title="子任务", assignee=m, assigned_sprint=s, parent=parent)
    assert child.parent == parent
    assert child.parent.title == "父需求"
    assert parent.parent is None
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd backend && .venv/bin/pytest apps/core/tests/test_models.py::test_requirement_parent -v`
Expected: FAIL(parent 字段不存在)

- [ ] **Step 3: 加字段 + 迁移**

在 `backend/apps/core/models.py` 的 Requirement class 里加:
```python
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='children', verbose_name='父需求')
```

Run:
```bash
cd backend && .venv/bin/python manage.py makemigrations core
.venv/bin/python manage.py migrate
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd backend && .venv/bin/pytest apps/core/tests/test_models.py::test_requirement_parent -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/apps/core/models.py backend/apps/core/migrations/ backend/apps/core/tests/test_models.py
git commit -m "feat(core): add parent self-FK to Requirement (1-level parent-child)"
```

---

### Task 2: ai.py prompt + parse 升级

**Files:**
- Modify: `backend/apps/core/ai.py`
- Modify: `backend/apps/core/tests/test_ai.py`

**Interfaces:**
- Produces: `build_system_prompt` 升级(分析框架);`parse_drafts(text)` 返回 `{parent, children} | None`(替代旧 list)

- [ ] **Step 1: 更新测试**

在 `backend/apps/core/tests/test_ai.py` 改 `parse_drafts` 测试:
```python
def test_parse_drafts_extracts_parent_children():
    text = '分析完成\n```json\n{"parent":{"title":"漏检优化"},"children":[{"title":"模型选型","type":"模型","analysis":"对比YOLOv8"}]}\n```'
    result = parse_drafts(text)
    assert result is not None
    assert result["parent"]["title"] == "漏检优化"
    assert len(result["children"]) == 1
    assert result["children"][0]["type"] == "模型"

def test_parse_drafts_no_json_returns_none():
    assert parse_drafts("纯文字") is None

def test_parse_drafts_bad_json_returns_none():
    assert parse_drafts("```json\n{bad\n```") is None

def test_build_system_prompt_has_analysis_framework():
    prompt = build_system_prompt([{"id":1,"name":"张三"}], [{"id":1,"name":"S1","is_active":True}], ["后端"])
    assert "决策点" in prompt
    assert "parent" in prompt and "children" in prompt
```
删掉旧的 test_parse_drafts_extracts_json / no_json / bad_json / strip_json_block(或保留 strip——strip 仍用于剥离 JSON 块)。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd backend && .venv/bin/pytest apps/core/tests/test_ai.py -v`
Expected: FAIL(parse_drafts 返回 list 不是 dict)

- [ ] **Step 3: 改 ai.py**

`build_system_prompt` 改为(分析框架 + 父子格式):
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
不要急于产出,先分析、追问、确认。"""
```

`parse_drafts` 改为:
```python
def parse_drafts(text):
    m = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None
```

- [ ] **Step 4: 跑测试通过**

Run: `cd backend && .venv/bin/pytest apps/core/tests/test_ai.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/apps/core/ai.py backend/apps/core/tests/test_ai.py
git commit -m "feat(ai): upgrade prompt to analysis framework + parent-child parse"
```

---

### Task 3: 端点 drafts 结构适配

**Files:**
- Modify: `backend/apps/core/tests/test_ai_endpoint.py`

端点 views.py 不需改(parse_drafts 返回值变了,Response 自动序列化)。只需更新端点测试 mock。

- [ ] **Step 1: 改测试**

在 `backend/apps/core/tests/test_ai_endpoint.py` 改 mock 回复:
```python
@patch("apps.core.views.chat_with_glm")
def test_ai_chat_returns_parent_children(mock_glm, client):
    mock_glm.return_value = '分析完成\n```json\n{"parent":{"title":"漏检优化"},"children":[{"title":"模型选型","type":"模型","analysis":"对比YOLOv8"}]}\n```'
    r = client.post("/api/ai/chat/", {"message": "漏检", "history": []}, format="json")
    assert r.status_code == 200
    assert r.data["drafts"] is not None
    assert r.data["drafts"]["parent"]["title"] == "漏检优化"
    assert len(r.data["drafts"]["children"]) == 1

@patch("apps.core.views.chat_with_glm")
def test_ai_chat_no_drafts(mock_glm, client):
    mock_glm.return_value = "你想用哪个模型?"
    r = client.post("/api/ai/chat/", {"message": "漏检", "history": []}, format="json")
    assert r.status_code == 200
    assert r.data["drafts"] is None
```

- [ ] **Step 2: 跑测试**

Run: `cd backend && .venv/bin/pytest apps/core/tests/test_ai_endpoint.py -v && .venv/bin/pytest -q`
Expected: 全绿

- [ ] **Step 3: Commit**

```bash
git add backend/apps/core/tests/test_ai_endpoint.py
git commit -m "test(ai): update endpoint tests for parent-child draft structure"
```

---

### Task 4: 前端 types + AssistantWidget 父子草稿

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/AssistantWidget.tsx`

**Interfaces:**
- Consumes: Task 3 端点返回 `{reply, drafts: {parent, children} | None}`
- Produces: AssistantWidget 显示父+子树草稿;导入级联(create 父→子 parent)

- [ ] **Step 1: types.ts 加 DraftResult**

```typescript
export interface DraftResult {
  parent: { title: string }
  children: Array<{ title: string; type?: string; analysis?: string }>
}
```

- [ ] **Step 2: api.ts 改 aiChat 返回类型**

`aiChat` 的返回 `<{reply: string, drafts: DraftResult | null}>`(改 import + 泛型)。

- [ ] **Step 3: AssistantWidget 改 drafts state + 草稿卡片 + 导入**

- `drafts` state 改 `DraftResult[]`(多次对话多组)
- aiChat 返回 drafts(DraftResult)push 到 state
- 草稿卡片:显示父标题(大)+ 子任务列表(每子 type Badge + title + analysis)
- 导入:`importDraft(idx)`:先 create 父 → parent_id → children create(parent=parent_id)
- 导入后移除该组

关键代码(草稿渲染 + 导入):
```tsx
// state
const [draftGroups, setDraftGroups] = useState<DraftResult[]>([])

// send 里 aiChat 返回后:
if (d) setDraftGroups(prev => [...prev, d])

// 导入级联
const importGroup = async (idx: number) => {
  const g = draftGroups[idx]
  try {
    const parent = await api.requirements.create({ title: g.parent.title, status: 'backlog', priority: 'P1' })
    for (const c of g.children) {
      await api.requirements.create({ title: `[${c.type||''}] ${c.title}`, status: 'backlog', priority: 'P1', parent: parent.id, note: c.analysis || '' })
    }
    setDraftGroups(prev => prev.filter((_, i) => i !== idx))
  } catch { setError('导入失败') }
}

// 草稿卡片渲染
{draftGroups.map((g, idx) => (
  <Card key={idx} className="p-2 bg-amber-50 border-amber-200">
    <div className="font-semibold text-sm">{g.parent.title}</div>
    {g.children.map((c, ci) => (
      <div key={ci} className="text-xs mt-1">
        <Badge variant="secondary">{c.type}</Badge> {c.title}
        <div className="text-muted-foreground">{c.analysis}</div>
      </div>
    ))}
    <Button size="sm" className="mt-1" onClick={() => importGroup(idx)}>导入({g.children.length+1}条)</Button>
  </Card>
))}
```

- [ ] **Step 4: tsc + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts frontend/src/components/AssistantWidget.tsx
git commit -m "feat(frontend): parent-child draft tree + cascade import in AssistantWidget"
```

---

### Task 5: 看板父子卡片显示

**Files:**
- Modify: `frontend/src/pages/Board.tsx`

**Interfaces:**
- Consumes: Requirement.parent(后端返回)、types.ts Requirement 加 parent

- [ ] **Step 1: types.ts Requirement 加 parent**

```typescript
export interface Requirement {
  // ... 现有字段
  parent: number | null
}
```

- [ ] **Step 2: Board RequirementCard 父子显示**

RequirementCard 加判断:
- 子任务(parent != null):标题前 `↳` + type Badge(从 title `[类型]` 解析 或 note)
- 父任务(parent == null):暂不特殊(或后端返回 children_count?MVP 不加,看板默认所有都显示)

简化:子任务标题 `[模型] xxx` 自动有 type Badge。父无特殊(看板拖拽时父子各自独立卡片)。

- [ ] **Step 3: tsc + build**

Run: `cd frontend && npx tsc --noEmit && npm run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/pages/Board.tsx
git commit -m "feat(frontend): parent-child card display on board"
```

---

## Self-Review

- Task 1:parent 字段 + migration ✓(spec §2)
- Task 2:prompt 分析框架 + parse 父子 ✓(spec §3、§4)
- Task 3:端点测试适配 ✓(spec §5)
- Task 4:前端 DraftResult + 草稿树 + 级联导入 ✓(spec §6)
- Task 5:看板父子显示 ✓(spec §2 看板行为)
- 占位符:无(每步完整代码)
- 类型一致:parse_drafts 返回 {parent,children}|None(Task 2 定,Task 3 测,Task 4 用)✓

## 执行选择

Plan saved to `docs/superpowers/plans/2026-07-05-ai-deep-analysis.md`。

1. **Subagent-Driven(推荐)**
2. **Inline**
3. **先暂停**

选哪种?
