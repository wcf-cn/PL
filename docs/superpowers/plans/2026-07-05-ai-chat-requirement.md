# AI 对话生成需求 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接入智谱 GLM(glm-5.1),通过悬浮聊天窗多轮对话,把 PL 的模糊描述拆解成需求草稿,确认后导入看板。

**Architecture:** 后端 `/api/ai/chat/` 代理调 GLM(注入 members/sprints/modules 上下文,解析回复里的 JSON 草稿);前端全局悬浮聊天 widget(右下角气泡,点开面板),草稿卡片可编辑后导入。

**Tech Stack:** Django+DRF(后端)、requests/python-dotenv、智谱 GLM glm-5.1、React+shadcn(前端悬浮窗)。

## Global Constraints

- GLM API:`https://open.bigmodel.cn/api/paas/v4/chat/completions`,model `glm-5.1`(env `GLM_MODEL` 可覆盖)
- API key 走 env `GLM_API_KEY`(backend/.env,不 commit;根 .gitignore 已含 .env)
- macOS 执行(venv `backend/.venv`,Python 3.14);目标部署 Win10
- 沿用现有模式:DRF `@api_view`、`SessionAuthentication`/`NoCSRFSessionAuthentication`、trailing-slash URL(`/api/ai/chat/`)
- TDD:每个 task 先写失败测试再实现;commit 带 `Co-Authored-By: Claude <noreply@anthropic.com>`

---

### Task 1: 后端依赖与配置

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/.env.example`
- Modify: `backend/plboard/settings.py`

**Interfaces:**
- Produces: `settings.GLM_API_KEY`、`settings.GLM_MODEL`;`.env.example` 模板;`requests`/`python-dotenv` 装好

- [ ] **Step 1: requirements.txt 加依赖**

追加到 `backend/requirements.txt`:
```
requests>=2.31
python-dotenv>=1.0
```

- [ ] **Step 2: 装依赖**

Run: `cd backend && .venv/bin/pip install requests python-dotenv`
Expected: 装好(Successfully installed ...)

- [ ] **Step 3: .env.example**

Create `backend/.env.example`:
```
# 智谱 GLM(bigmodel.cn 申请)
GLM_API_KEY=your_key_here
GLM_MODEL=glm-5.1
```

- [ ] **Step 4: settings 读 env**

在 `backend/plboard/settings.py` 顶部(`BASE_DIR` 后)加:
```python
from dotenv import load_dotenv
import os
load_dotenv(BASE_DIR / ".env")
GLM_API_KEY = os.environ.get("GLM_API_KEY", "")
GLM_MODEL = os.environ.get("GLM_MODEL", "glm-5.1")
```
(`import os` 若已存在不重复;`from pathlib import Path` 已在)

- [ ] **Step 5: 验证**

Run: `cd backend && .venv/bin/python manage.py check`
Expected: `System check identified no issues.`

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/.env.example backend/plboard/settings.py
git commit -m "chore(backend): add requests/python-dotenv + GLM env config"
```

---

### Task 2: GLM 集成纯函数(ai.py)

**Files:**
- Create: `backend/apps/core/ai.py`
- Create: `backend/apps/core/tests/test_ai.py`

**Interfaces:**
- Produces: `chat_with_glm(messages)->str`、`parse_drafts(text)->list[dict]`、`strip_json_block(text)->str`、`build_system_prompt(members, sprints, modules)->str`

- [ ] **Step 1: 写失败测试**

Create `backend/apps/core/tests/test_ai.py`:
```python
import pytest
from unittest.mock import patch, MagicMock
from apps.core.ai import chat_with_glm, parse_drafts, strip_json_block, build_system_prompt

def test_parse_drafts_extracts_json():
    text = '好的\n```json\n[{"title":"登录"}]\n```\n以上'
    assert parse_drafts(text) == [{"title": "登录"}]

def test_parse_drafts_no_json_returns_empty():
    assert parse_drafts("纯文字无json") == []

def test_parse_drafts_bad_json_returns_empty():
    assert parse_drafts("```json\n[bad\n```") == []

def test_strip_json_block_removes_json():
    text = '对话\n```json\n[{"title":"x"}]\n```\n结尾'
    assert "```json" not in strip_json_block(text)
    assert "对话" in strip_json_block(text)

def test_build_system_prompt_includes_context():
    prompt = build_system_prompt(
        [{"id":1,"name":"张三"}],
        [{"id":1,"name":"S1","is_active":True}],
        ["后端","前端"]
    )
    assert "张三" in prompt and "S1" in prompt and "后端" in prompt

@patch("apps.core.ai.requests.post")
def test_chat_with_glm_calls_api(mock_post):
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"choices":[{"message":{"content":"hi"}}]}
    mock_resp.raise_for_status = MagicMock()
    mock_post.return_value = mock_resp
    with pytest.MonkeyPatch().ctx() as mp:
        mp.setenv("GLM_API_KEY", "test-key")
        result = chat_with_glm([{"role":"user","content":"hi"}])
    assert result == "hi"
    mock_post.assert_called_once()
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd backend && .venv/bin/pytest apps/core/tests/test_ai.py -v`
Expected: FAIL(`ai 模块不存在`)

- [ ] **Step 3: 实现 ai.py**

Create `backend/apps/core/ai.py`:
```python
import os, re, json, requests
from django.conf import settings

GLM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

def chat_with_glm(messages):
    key = os.environ.get("GLM_API_KEY", getattr(settings, "GLM_API_KEY", ""))
    if not key:
        raise ValueError("GLM_API_KEY 未配置")
    model = os.environ.get("GLM_MODEL", getattr(settings, "GLM_MODEL", "glm-5.1"))
    resp = requests.post(GLM_URL, headers={"Authorization": f"Bearer {key}"},
        json={"model": model, "messages": messages}, timeout=30)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]

def parse_drafts(text):
    m = re.search(r"```json\s*(\[.*?\])\s*```", text, re.DOTALL)
    if not m:
        return []
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return []

def strip_json_block(text):
    return re.sub(r"```json\s*\[.*?\]\s*```", "", text, flags=re.DOTALL).strip()

def build_system_prompt(members, sprints, modules):
    m_list = ", ".join(f'{x["name"]}(id:{x["id"]})' for x in members) or "无"
    s_list = ", ".join(f'{x["name"]}(id:{x["id"]}{"活跃" if x.get("is_active") else ""})' for x in sprints) or "无"
    mod_list = ", ".join(modules) if modules else "无"
    return f"""你是 PL(技术主管)的需求拆解助手。用户描述迭代要做的事,你帮拆成具体需求。
现有团队成员:{m_list};迭代:{s_list};模块:{mod_list}。
流程:先理解意图,必要时追问细化。需求明确时,在回复末尾用 ```json 返回需求数组,每条:{{title(必填), status(默认 backlog), priority(P0/P1/P2,默认 P1), module, est_effort(人时估算), assigned_sprint(迭代id), assignee(成员id)}}。"""
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd backend && .venv/bin/pytest apps/core/tests/test_ai.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/apps/core/ai.py backend/apps/core/tests/test_ai.py
git commit -m "feat(core): GLM integration pure functions (chat/parse/prompt)"
```

---

### Task 3: AI 聊天端点

**Files:**
- Modify: `backend/apps/core/views.py`
- Modify: `backend/apps/core/urls.py`
- Create: `backend/apps/core/tests/test_ai_endpoint.py`

**Interfaces:**
- Consumes: Task 2(`chat_with_glm`, `parse_drafts`, `strip_json_block`, `build_system_prompt`)
- Produces: `POST /api/ai/chat/` → `{reply:str, drafts:list[dict]}`

- [ ] **Step 1: 写失败测试**

Create `backend/apps/core/tests/test_ai_endpoint.py`:
```python
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from unittest.mock import patch

@pytest.fixture
def client():
    User.objects.create_user("pl", password="pw")
    c = APIClient(); c.login(username="pl", password="pw")
    return c

@pytest.mark.django_db
@patch("apps.core.views.chat_with_glm")
def test_ai_chat_returns_reply_and_drafts(mock_glm, client):
    mock_glm.return_value = '好的\n```json\n[{"title":"登录","est_effort":8}]\n```'
    r = client.post("/api/ai/chat/", {"message":"做登录", "history":[]}, format="json")
    assert r.status_code == 200
    assert "好的" in r.data["reply"]
    assert len(r.data["drafts"]) == 1
    assert r.data["drafts"][0]["title"] == "登录"

@pytest.mark.django_db
@patch("apps.core.views.chat_with_glm")
def test_ai_chat_no_drafts(mock_glm, client):
    mock_glm.return_value = "你想用手机号还是邮箱?"
    r = client.post("/api/ai/chat/", {"message":"登录", "history":[]}, format="json")
    assert r.status_code == 200
    assert r.data["drafts"] == []
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd backend && .venv/bin/pytest apps/core/tests/test_ai_endpoint.py -v`
Expected: FAIL(无 `/api/ai/chat/` 路由)

- [ ] **Step 3: 实现 views + urls**

在 `backend/apps/core/views.py` 顶部 import 加:
```python
from .ai import chat_with_glm, parse_drafts, strip_json_block, build_system_prompt
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
```
(`api_view`/`Response`/`status` 若已 import 不重复)

追加视图:
```python
@api_view(["POST"])
def ai_chat(request):
    message = request.data.get("message", "")
    history = request.data.get("history", [])
    members = list(Member.objects.values("id", "name"))
    sprints = list(Sprint.objects.values("id", "name", "is_active"))
    modules = list(Requirement.objects.exclude(module="").values_list("module", flat=True).distinct())
    system = build_system_prompt(members, sprints, modules)
    messages = [{"role": "system", "content": system}] + list(history) + [{"role": "user", "content": message}]
    try:
        reply = chat_with_glm(messages)
    except ValueError:
        return Response({"detail": "AI 未配置(GLM_API_KEY)"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception:
        return Response({"detail": "AI 服务暂不可用"}, status=status.HTTP_502_BAD_GATEWAY)
    return Response({"reply": strip_json_block(reply), "drafts": parse_drafts(reply)})
```

在 `backend/apps/core/urls.py` 的 `urlpatterns` 加:
```python
from .views import ai_chat
# ... urlpatterns 里加:
path("ai/chat/", ai_chat),
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd backend && .venv/bin/pytest apps/core/tests/test_ai_endpoint.py -v`
Expected: 2 passed

- [ ] **Step 5: 全量后端测试**

Run: `cd backend && .venv/bin/pytest -q`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add backend/apps/core/views.py backend/apps/core/urls.py backend/apps/core/tests/test_ai_endpoint.py
git commit -m "feat(core): POST /api/ai/chat/ endpoint"
```

---

(前端 Task 4-6 见下一块,继续追加)

---

### Task 4: 前端 types + api.aiChat

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api.ts`

**Interfaces:**
- Consumes: Task 3 端点 `POST /api/ai/chat/`
- Produces: `api.aiChat(message, history)` → `Promise<{reply, drafts}>`;types `ChatMessage`、`Draft`

- [ ] **Step 1: types.ts 加类型**

在 `frontend/src/types.ts` 末尾加:
```typescript
export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string }
export interface Draft {
  title: string
  status?: string
  priority?: string
  module?: string
  est_effort?: number
  assigned_sprint?: number | null
  assignee?: number | null
}
```

- [ ] **Step 2: api.ts 加 aiChat**

在 `frontend/src/api.ts` 的 `export const api = { ... }` 里加(aiChat 在 capacity 后):
```typescript
  aiChat: (message: string, history: ChatMessage[]) =>
    http.post<{reply: string, drafts: Draft[]}>('/api/ai/chat/', { message, history }).then(r => r.data),
```
(import 加 `ChatMessage, Draft` from types)

- [ ] **Step 3: 验证**

Run: `cd frontend && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts
git commit -m "feat(frontend): types + api.aiChat for AI endpoint"
```

---

### Task 5: 悬浮聊天窗 AssistantWidget + 挂载

**Files:**
- Create: `frontend/src/components/AssistantWidget.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/components/AssistantWidget.test.tsx`

**Interfaces:**
- Consumes: Task 4 `api.aiChat`、`api.requirements.create`、`api.members.list`、`api.sprints.list`
- Produces: 全局悬浮聊天 widget(右下角气泡 → 面板 → 消息 + 草稿导入)

- [ ] **Step 1: 写失败测试**

Create `frontend/src/components/AssistantWidget.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AssistantWidget from './AssistantWidget'
vi.mock('../api', () => ({
  api: {
    aiChat: vi.fn().mockResolvedValue({ reply: '好的,先确认:手机号?', drafts: [{ title: '登录', est_effort: 8 }] }),
    members: { list: vi.fn().mockResolvedValue([{ id: 1, name: '张三', week_capacity: 40, modules: '', active: true }]) },
    sprints: { list: vi.fn().mockResolvedValue([{ id: 1, name: 'S1', start_date: '', end_date: '', is_active: true, weeks: 2 }]) },
    requirements: { create: vi.fn().mockResolvedValue({ id: 99, title: '登录' }) },
  }
}))
describe('AssistantWidget', () => {
  it('opens panel, sends message, shows reply + draft', async () => {
    render(<AssistantWidget />)
    fireEvent.click(screen.getByText('AI'))
    fireEvent.change(screen.getByPlaceholderText('描述你的需求...'), { target: { value: '做登录' } })
    fireEvent.click(screen.getByText('发送'))
    await waitFor(() => expect(screen.getByText(/手机号/)).toBeInTheDocument())
    expect(screen.getByText('登录')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/components/AssistantWidget.test.tsx`
Expected: FAIL(组件不存在)

- [ ] **Step 3: 实现 AssistantWidget**

Create `frontend/src/components/AssistantWidget.tsx`:
```tsx
import { useState } from 'react'
import { api } from '../api'
import type { ChatMessage, Draft, Member, Sprint } from '../types'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

export default function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [error, setError] = useState('')

  const loadContext = async () => {
    if (members.length === 0) {
      const [m, s] = await Promise.all([api.members.list(), api.sprints.list()])
      setMembers(m); setSprints(s)
    }
  }

  const send = async () => {
    if (!input.trim() || loading) return
    await loadContext()
    const userMsg: ChatMessage = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages); setInput(''); setLoading(true); setError('')
    try {
      const { reply, drafts: d } = await api.aiChat(input, history)
      setMessages([...newMessages, { role: 'assistant', content: reply }])
      setHistory([...history, userMsg, { role: 'assistant', content: reply }])
      if (d.length) setDrafts(prev => [...prev, ...d])
    } catch (e: any) {
      setError(e.response?.data?.detail || 'AI 调用失败')
    } finally {
      setLoading(false)
    }
  }

  const importDraft = async (idx: number) => {
    const d = drafts[idx]
    try {
      await api.requirements.create({ title: d.title, status: (d.status as any) || 'backlog', priority: (d.priority as any) || 'P1', module: d.module || '', est_effort: d.est_effort || 0, assigned_sprint: d.assigned_sprint ?? null, assignee: d.assignee ?? null })
      setDrafts(prev => prev.filter((_, i) => i !== idx))
    } catch {
      setError('导入失败')
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-50 rounded-full bg-primary text-primary-foreground w-14 h-14 shadow-lg text-sm font-bold">AI</button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[80vh] flex flex-col shadow-xl">
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-3 border-b bg-muted">
          <span className="font-semibold">AI 助手</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>✕</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-60">
          {messages.length === 0 && <div className="text-sm text-muted-foreground">描述你的需求,我帮你拆成卡片...</div>}
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <span className={`inline-block px-3 py-1 rounded-lg text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{m.content}</span>
            </div>
          ))}
          {loading && <div className="text-sm text-muted-foreground">思考中...</div>}
          {drafts.map((d, idx) => (
            <Card key={idx} className="p-2 bg-amber-50">
              <div className="text-sm font-medium">{d.title}</div>
              <div className="text-xs text-muted-foreground">{d.est_effort || 0}h · {d.module || '未分模块'}</div>
              <Button size="sm" className="mt-1" onClick={() => importDraft(idx)}>导入看板</Button>
            </Card>
          ))}
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <div className="p-3 border-t flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} placeholder="描述你的需求..." onKeyDown={e => { if (e.key === 'Enter') send() }} />
          <Button onClick={send} disabled={loading}>发送</Button>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: App.tsx 挂载**

在 `frontend/src/App.tsx` 的 authed 路由块里(`<Routes>` 内的 authed 分支,`<Route path="/board".../>` 后)加挂载。实际在 `</main>` 前(authed 时)加:
```tsx
import AssistantWidget from './components/AssistantWidget'
// ... 在 <main></main> 后、</div> 前(authed 时):
{authed && <AssistantWidget />}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd frontend && npx vitest run src/components/AssistantWidget.test.tsx`
Expected: PASS

- [ ] **Step 6: 全量测试 + build**

Run: `cd frontend && npx vitest run && npx tsc --noEmit && npm run build`
Expected: 全绿 + build 成功

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/AssistantWidget.tsx frontend/src/components/AssistantWidget.test.tsx frontend/src/App.tsx
git commit -m "feat(frontend): floating AssistantWidget chat + draft import"
```

---

## Self-Review(spec 覆盖)

- Task 1:配置(env/依赖/settings)✓ — spec §6
- Task 2:GLM 纯函数(chat/parse/strip/build_prompt)✓ — spec §4
- Task 3:端点 /api/ai/chat/ + 错误(400/502)✓ — spec §3、§8
- Task 4:前端 api.aiChat + types ✓ — spec §3 数据流
- Task 5:悬浮窗 + 消息 + 草稿导入 ✓ — spec §2 前端、§5 草稿导入
- 占位符:无(每步完整代码)
- 类型一致:chat_with_glm/parse_drafts/strip_json_block/build_system_prompt(Task 2 定义,Task 3 用);aiChat(Task 4 定义,Task 5 用)✓

## 执行选择

Plan 完成,保存于 `docs/superpowers/plans/2026-07-05-ai-chat-requirement.md`。两种执行方式:

1. **Subagent-Driven(推荐)** — 每 task 派子 agent + review
2. **Inline** — 当前会话批量执行 + checkpoint

选哪种?
