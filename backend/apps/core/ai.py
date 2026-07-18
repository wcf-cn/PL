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