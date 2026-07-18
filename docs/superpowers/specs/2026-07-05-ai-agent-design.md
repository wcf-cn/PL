# AI Agent — 对话操作看板 设计文档

> 状态:设计中,待实现
> 日期:2026-07-05

## 1. 概述

AI 助手从"只产出需求草稿"升级为"**PL 看板 agent**":用户在对话中说自然语言指令(如"把登录接口分配给张三"、"把报表导出改成测试中"、"删掉 E2E-A"),AI 理解意图 → 生成操作建议 → **用户点确认** → 后端执行(API 调用)→ 返回结果。

- 交互:**AI 建议 + 用户确认**(写操作不自动执行)
- 覆盖:需求增删改、成员改、迭代改——全系统 CRUD

## 2. 架构

### 后端(Django)
- 端点 `POST /api/ai/chat/` 升级:除了现有 `{reply, drafts}`,新增 `{reply, drafts, actions}`
- `actions` = AI 返回的操作建议列表(JSON)
- 新端点 `POST /api/ai/execute/`:接收 `{action_type, params}`,后端执行(调 ORM),返回结果

### 前端(React)
- AssistantWidget:收到 actions 时显示"操作建议"卡片(描述 + 「确认执行」/「取消」按钮)
- 用户点确认 → POST /api/ai/execute/ → 结果反馈到对话

### AI 通信方式
**Prompt 工程**(非 tool use):system prompt 定义可用操作 + JSON 格式。AI 返回 `{reply, drafts?, actions?}`,其中 actions 是操作指令数组。不依赖 GLM tool use(更通用)。

## 3. system prompt 升级

在现有"PL 分析助手"基础上加:

```
你可以帮用户操作看板数据。用户说自然语言指令,你理解后返回操作建议(actions)。
可用操作:
- update_requirement: {id(可选,不指定时用标题匹配), fields: {status, assignee(name或id), priority, est_effort, module, assigned_sprint(name或id)}}
- create_requirement: {title, status?, priority?, module?, est_effort?, assignee?(name), assigned_sprint?(name)}
- delete_requirement: {id 或 title}
- update_member: {id或name, fields: {week_capacity, modules, active}}
- update_sprint: {id或name, fields: {name, start_date, end_date, is_active}}
- query: 查询需求/成员/迭代状态(只读,返回信息)

返回格式:在回复末尾,如果有操作建议,附加:
```json
{"actions": [{"type": "update_requirement", "match": {"title": "登录接口"}, "fields": {"assignee": "张三", "status": "in_progress"}}]}
```
注意:返回的是「建议」不是已执行,用户需要确认后才执行。回复文字里说明你建议做什么。
```

## 4. 操作建议格式

```json
{
  "actions": [
    {
      "type": "update_requirement",
      "match": {"title": "登录接口"},
      "fields": {"assignee": "张三", "status": "in_progress"},
      "description": "把「登录接口」分配给张三、状态改为开发中"
    }
  ]
}
```

- `match`:匹配条件(title 或 id)
- `fields`:要改的字段(name 值后端解析为 id)
- `description`:给用户看的人话描述

## 5. 端点

### POST /api/ai/chat/(现有,升级)
返回 `{reply, drafts?, actions?}`:
- `reply`:对话文字
- `drafts`:父子需求草稿(现有,{parent,children} | null)
- `actions`:操作建议列表(新增,[] | null)

### POST /api/ai/execute/(新)
```python
@api_view(["POST"])
def ai_execute(request):
    action = request.data  # {type, match, fields}
    # 执行(调 ORM),返回结果
    result = execute_action(action)
    return Response({"success": True, "result": result, "message": "..."})
```

`execute_action` 逻辑(apps/core/ai_actions.py 纯函数,易测):
- `update_requirement`:按 match(title 或 id)找到 Requirement → 更新 fields(name→id 解析)
- `create_requirement`:创建新 Requirement
- `delete_requirement`:删除
- `update_member`/`update_sprint`:同理
- 返回 {success, message, affected}

## 6. 前端 AssistantWidget

### 操作建议卡片
收到 actions 时,在对话流显示:
```
🔧 操作建议:
[把「登录接口」分配给张三、状态改为开发中]
[确认执行] [取消]
```
- 用户点「确认执行」→ POST /api/ai/execute/ → 结果加入对话("✅ 已执行:登录接口 → 张三/开发中")
- 多个 action 逐个或批量确认

## 7. 数据流

用户"把登录接口分配给张三" → POST /api/ai/chat/ → GLM(prompt 含操作定义)→ 返回 reply + actions → 前端显示操作建议卡片 → 用户确认 → POST /api/ai/execute/ → 后端 execute_action(ORM)→ 结果 → 对话反馈 → 看板刷新

## 8. 错误处理

- match 找不到(title 不匹配)→ execute 返回 {success: false, message: "找不到「登录接口」"}
- fields 无效(如 assignee name 不存在)→ {success: false, message: "成员「张三」不存在"}
- AI 未返回 actions(纯对话)→ 只显示 reply
- 执行失败(异常)→ {success: false, message: "执行失败:..."}

## 9. 安全

- **所有写操作必须用户点确认**(AI 只建议,不自动执行)
- 执行端点 `POST /api/ai/execute/` 需认证(IsAuthenticated)
- 操作建议卡片有「取消」按钮(不执行)

## 10. 测试

- ai_actions.py:`execute_action` 各操作(update/create/delete/member/sprint),mock ORM
- 端点:`POST /api/ai/execute/` 执行 + 结果
- chat 端点:mock GLM 返回 actions

## 11. 非目标(YAGNI)

- 批量操作(一次改多个需求)——逐个
- undo/撤销
- 操作历史日志
- AI 自动连续操作(不确认)
- tool use(用 prompt 工程)

## 12. 改动文件

- 后端:`apps/core/ai_actions.py`(新,execute_action 纯函数)、`apps/core/views.py`(ai_execute 端点 + ai_chat 返回 actions)、`apps/core/urls.py`(新端点)、`apps/core/ai.py`(prompt 升级)
- 前端:`types.ts`(Action 类型)、`api.ts`(aiExecute)、`components/AssistantWidget.tsx`(操作建议卡片 + 确认执行)
