import os, re, json, requests
from django.conf import settings

GLM_URL = "https://open.bigmodel.cn/api/anthropic/v1/messages"

def chat_with_glm(messages):
    key = os.environ.get("GLM_API_KEY", getattr(settings, "GLM_API_KEY", ""))
    if not key:
        raise ValueError("GLM_API_KEY 未配置")
    model = os.environ.get("GLM_MODEL", getattr(settings, "GLM_MODEL", "glm-5.2"))
    # Anthropic 兼容端点(coding plan 通道):system 提取为 top-level,messages 只留 user/assistant
    system = ""
    chat_msgs = messages
    if messages and messages[0].get("role") == "system":
        system = messages[0]["content"]
        chat_msgs = messages[1:]
    resp = requests.post(GLM_URL, headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
        json={"model": model, "system": system, "messages": chat_msgs, "max_tokens": 2048}, timeout=30)
    resp.raise_for_status()
    return resp.json()["content"][0]["text"]

def parse_drafts(text):
    m = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None

def strip_json_block(text):
    return re.sub(r"```json\s*\{.*?\}\s*```", "", text, flags=re.DOTALL).strip()

def parse_actions(text):
    """从 GLM 回复提取 actions JSON(```actions 标记)"""
    m = re.search(r"```actions\s*(\[.*?\])\s*```", text, re.DOTALL)
    if not m:
        return []
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return []

def strip_actions_block(text):
    return re.sub(r"```actions\s*\[.*?\]\s*```", "", text, flags=re.DOTALL).strip()

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
不要急于产出,先分析、追问、确认。
你也可以帮用户操作看板数据。用户说自然语言指令(如"把登录接口分配给张三"),你在回复末尾用 ```actions 返回操作建议。
可用操作:
- update_requirement: {{"type":"update_requirement","match":{{"title":"xxx"}},"fields":{{"status":"in_progress","assignee":"张三","priority":"P0"}},"description":"人话描述"}}
- create_requirement: {{"type":"create_requirement","params":{{"title":"xxx","assignee":"张三","assigned_sprint":"S1"}},"description":"..."}}
- delete_requirement: {{"type":"delete_requirement","match":{{"title":"xxx"}},"description":"..."}}
- update_member: {{"type":"update_member","match":{{"name":"张三"}},"fields":{{"week_capacity":35}},"description":"..."}}
- create_member: {{"type":"create_member","params":{{"name":"李四","week_capacity":40,"modules":"前端"}},"description":"添加成员李四"}}
- create_sprint: {{"type":"create_sprint","params":{{"name":"2026-W28","start_date":"2026-07-20","end_date":"2026-08-03"}},"description":"创建迭代"}}
返回的是建议(未执行),用户确认后才执行。"""