# AI 对话生成需求 — 设计文档

> 状态:设计中,待实现
> 日期:2026-07-05

## 1. 概述

接入智谱 GLM 大模型,PL 通过**多轮自然语言对话**,把模糊需求描述拆解成结构化需求,确认后一键导入看板。

- 用户:PL(个人自用,单用户)
- AI:智谱 GLM(glm-4-flash 免费额度 / glm-4)
- 交互:**多轮聊天**(逐步细化,非单轮)

## 2. 架构

### 后端(Django)
- 新端点 `POST /api/ai/chat/`:接收 `{message, history}`,调 GLM,返回 `{reply, drafts}`
- GLM 封装:`apps/core/ai.py`(纯函数,易测)
- API key:settings 从 env `GLM_API_KEY` 读(不硬编码)
- 上下文注入:现有 members/sprints/modules 注入 system prompt(帮 AI 填 assignee/sprint/module)

### 前端(React)
- 新页 `/assistant`(App 路由 + Nav "AI 助手")
- 聊天 UI:消息列表(user/assistant 气泡)+ 输入框 + 发送
- 草稿卡片:GLM 返回草稿时显示,字段可编辑 + "导入"按钮

## 3. 对话流

1. PL 输入描述(如"下个迭代做登录注册和个人中心")
2. 前端 POST `/api/ai/chat/` `{message, history: [...]}`
3. 后端:
   - 拼 `messages = [system_prompt, ...history, {role:user, content:message}]`
   - system_prompt 含:PL 助手角色 + 现有 members/sprints/modules 上下文 + "需求明确时返回 JSON" 指令
   - 调 GLM(`apps/core/ai.py`)
   - 解析回复:提取对话文字 + JSON 草稿
4. 返回 `{reply: text, drafts: [{title, status, priority, module, est_effort, assigned_sprint, assignee}]}`
5. 前端显示 reply + drafts(草稿卡片)
6. PL 编辑草稿(可选)+ 点"导入"→ `api.requirements.create`(逐条)→ 看板

### system prompt 模板
```
你是 PL(技术主管)的需求拆解助手。用户描述迭代要做的事,你帮拆成具体需求。
现有团队成员:{members(name/id)};迭代:{sprints(name/id/is_active)};模块:{modules}。
流程:先理解意图,必要时追问细化(如"登录用手机号还是邮箱?")。需求明确时,在回复末尾用 ```json 返回需求数组,每条:{title(必填), status(默认 backlog), priority(P0/P1/P2), module, est_effort(人时估算), assigned_sprint(迭代id), assignee(成员id)}。
```

### GLM 回复格式
- 文字:对话/追问
- JSON(需求明确时):<code>```json [{...}]```</code>

后端正则提取 ```json 块,JSON 解析。

## 4. GLM 集成(apps/core/ai.py)

```python
import os, requests, json, re

GLM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
GLM_MODEL = os.environ.get("GLM_MODEL", "glm-4-flash")

def chat_with_glm(messages):
    key = os.environ.get("GLM_API_KEY")
    if not key:
        raise ValueError("GLM_API_KEY 未配置")
    resp = requests.post(GLM_URL, headers={"Authorization": f"Bearer {key}"},
        json={"model": GLM_MODEL, "messages": messages}, timeout=30)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]

def parse_drafts(reply_text):
    m = re.search(r"```json\s*(\[.*?\])\s*```", reply_text, re.DOTALL)
    if not m: return []
    try: return json.loads(m.group(1))
    except json.JSONDecodeError: return []

def strip_json_block(reply_text):
    return re.sub(r"```json\s*\[.*?\]\s*```", "", reply_text, flags=re.DOTALL).strip()
```

### 端点(views.py)
```python
@api_view(["POST"])
def ai_chat(request):
    message = request.data.get("message", "")
    history = request.data.get("history", [])
    members = list(Member.objects.values("id", "name"))
    sprints = list(Sprint.objects.values("id", "name", "is_active"))
    modules = list(Requirement.objects.exclude(module="").values_list("module", flat=True).distinct())
    system = build_system_prompt(members, sprints, modules)
    messages = [{"role": "system", "content": system}] + history + [{"role": "user", "content": message}]
    reply = chat_with_glm(messages)
    drafts = parse_drafts(reply)
    return Response({"reply": strip_json_block(reply), "drafts": drafts})
```

## 5. 草稿导入(前端)

- 草稿卡片:显示 title/priority/module/est_effort/assignee/assigned_sprint,可编辑(Select 选 member/sprint)
- "导入"按钮 → 逐条 `api.requirements.create(draft)` → 刷新看板
- "导入全部"→ 批量创建

## 6. 配置

- `.env`(backend/):`GLM_API_KEY=xxx`(bigmodel.cn 申请)
- settings.py:`GLM_API_KEY = os.environ.get("GLM_API_KEY", "")`
- 依赖:`requests`(HTTP)、`python-dotenv`(读 .env)
- `.gitignore`:`.env`(不 commit key)

## 7. 数据流

PL 输入 → POST /api/ai/chat/ → ai.py(chat_with_glm)→ GLM API → 回复 → parse_drafts → {reply, drafts} → 前端聊天 + 草稿 → 导入 → Requirement

## 8. 错误处理

- `GLM_API_KEY` 未配 → 400 `{detail: "AI 未配置(GLM_API_KEY)"}`
- GLM 调用失败(网络/超时/限流)→ 502 `{detail: "AI 服务暂不可用"}`
- JSON 解析失败 → 返回 reply(text),drafts=[]
- 前端:错误显示 + 重试

## 9. 测试

- `apps/core/ai.py` 单测(mock requests):`chat_with_glm`(mock 回复)、`parse_drafts`(有/无 JSON 块)、`strip_json_block`
- 端点测试(mock chat_with_glm):POST /api/ai/chat/ → {reply, drafts}
- 前端:Assistant 渲染(mock api.ai.chat)

## 10. 非目标(YAGNI)

- 流式(streaming)回复(MVP 等完整回复)
- 语音输入
- AI 自动导入(不经确认)— 必须人工确认草稿
- 多 AI 提供商切换(MVP 只 GLM)
- 对话历史持久化(MVP 前端维护 history,刷新清空)

## 11. 依赖

- 后端:`requests`、`python-dotenv`(pip 装)
- 前端:无新依赖(现有 shadcn + axios)
