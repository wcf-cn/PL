# PL 看板 Wave 5 — AI 升级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) tracking.

**Goal:** 让 AI 助手不再是"半盲"——给它的 system prompt 喂上**在途需求摘要 + 版本**,这样它能回答"谁超载了""哪个 P0 卡住""v2.0 进展"等问题。(路线图的 single_point_risks 项已在 Wave 1 随 capacity.py 删除完成,本波不再涉及。)

**Architecture:** 单任务。扩 `build_system_prompt` 签名加 `in_flight_text` + `versions_text`,在 `ai_chat` 里聚合在途叶子需求(最多 30 条)与版本(current_phase)摘要传入。

**Tech Stack:** Django+DRF+SQLite(pytest-django)。

## Global Constraints

- 纯单人自用,严守 YAGNI。
- 后端测试:`cd backend && .venv/bin/python -m pytest`。
- 每个 commit 走 Conventional Commits。
- **Rollup 语义(沿用)**:在途摘要只取叶子 `.annotate(nc=Count('children')).filter(nc=0)`。
- Wave 1-4 已完成。`build_system_prompt(members, modules)` 是当前签名(Wave 1 去掉了 sprint 参数)。

---

## Task 1: AI system prompt 喂在途需求 + 版本

**Files:**
- Modify: `backend/apps/core/ai.py`(`build_system_prompt`)
- Modify: `backend/apps/core/views.py`(`ai_chat`)
- Modify: `backend/apps/core/tests/test_ai.py`
- Modify: `backend/apps/core/tests/test_ai_endpoint.py`

**Interfaces:**
- Produces: `build_system_prompt(members, modules, in_flight_text, versions_text)`;`ai_chat` 聚合在途叶子(≤30)与版本摘要传入;prompt 含"在途需求"与"版本"两段。

- [ ] **Step 1: 写失败测试**

改 `test_ai.py` 的 `test_build_system_prompt_has_analysis_framework`:

old:
```python
def test_build_system_prompt_has_analysis_framework():
    prompt = build_system_prompt(
        [{"id":1,"name":"张三"}],
        ["后端","前端"]
    )
    assert "张三" in prompt and "后端" in prompt
    assert "决策点" in prompt
    assert "parent" in prompt and "children" in prompt
```
new:
```python
def test_build_system_prompt_has_analysis_framework():
    prompt = build_system_prompt(
        [{"id":1,"name":"张三"}],
        ["后端","前端"],
        "登录接口[开发中]@张三 8h",
        "v2.0(联调中)",
    )
    assert "张三" in prompt and "后端" in prompt
    assert "登录接口" in prompt and "v2.0" in prompt
    assert "决策点" in prompt
    assert "parent" in prompt and "children" in prompt
```

在 `test_ai_endpoint.py` 加(确认 ai_chat 真的把在途需求/版本喂进 system message):

```python
import pytest
from apps.core.models import Member, Requirement, Version


@pytest.mark.django_db
@patch("apps.core.views.chat_with_glm")
def test_ai_chat_feeds_inflight_and_versions(mock_glm, client):
    m = Member.objects.create(name="张三")
    Requirement.objects.create(title="登录接口", assignee=m, status="in_progress", est_effort=8)
    Requirement.objects.create(title="已上线X", assignee=m, status="done", est_effort=2)  # 应被排除
    Version.objects.create(name="v2.0")
    mock_glm.return_value = "ok"
    client.post("/api/ai/chat/", {"message": "谁超载", "history": []}, format="json")
    sent_messages = mock_glm.call_args[0][0]
    system = next((m["content"] for m in sent_messages if m.get("role") == "system"), "")
    assert "登录接口" in system
    assert "已上线X" not in system   # done 不进在途摘要
    assert "v2.0" in system
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && .venv/bin/python -m pytest apps/core/tests/test_ai.py apps/core/tests/test_ai_endpoint.py -v`
Expected: FAIL(签名不匹配 / 在途未喂入)

- [ ] **Step 3: 改 `ai.py` — build_system_prompt 加两段**

old:
```python
def build_system_prompt(members, modules):
    m_list = ", ".join(f'{x["name"]}(id:{x["id"]})' for x in members) or "无"
    mod_list = ", ".join(modules) if modules else "无"
    return f"""你是 PL(技术主管)的分析助手。用户描述一个问题/需求,你帮深度拆解。
现有团队成员:{m_list};模块:{mod_list}。
分析框架:
```
new:
```python
def build_system_prompt(members, modules, in_flight_text, versions_text):
    m_list = ", ".join(f'{x["name"]}(id:{x["id"]})' for x in members) or "无"
    mod_list = ", ".join(modules) if modules else "无"
    return f"""你是 PL(技术主管)的分析助手。用户描述一个问题/需求,你帮深度拆解。
现有团队成员:{m_list};模块:{mod_list};版本:{versions_text}。
在途需求(叶子,最多30条):{in_flight_text}
分析框架:
```
(prompt 其余部分不变。)

- [ ] **Step 4: 改 `views.py` — ai_chat 聚合在途 + 版本**

old:
```python
    members = list(Member.objects.values("id", "name"))
    modules = list(Requirement.objects.exclude(module="").values_list("module", flat=True).distinct())
    system = build_system_prompt(members, modules)
```
new:
```python
    members = list(Member.objects.values("id", "name"))
    modules = list(Requirement.objects.exclude(module="").values_list("module", flat=True).distinct())
    # 在途叶子需求摘要(最多30条,按优先级/工时排序)
    in_flight_qs = (Requirement.objects.exclude(status__in=['done', 'paused'])
        .annotate(nc=Count('children')).filter(nc=0)
        .select_related('assignee').order_by('-priority', '-est_effort')[:30])
    in_flight_text = "; ".join(
        f'{r.title}[{r.get_status_display()}]@{r.assignee.name if r.assignee else "未分配"} {r.est_effort}h'
        for r in in_flight_qs) or "无"
    # 版本摘要(含当前阶段)
    versions_text = "; ".join(f'{v.name}({v.current_phase})' for v in Version.objects.all()) or "无"
    system = build_system_prompt(members, modules, in_flight_text, versions_text)
```
需要 `Count`(`from django.db.models import Count` —— views.py 已在 Wave 1 Task 3 导入)和 `Version`(Wave 2 已导入 models)。

- [ ] **Step 5: 跑全量后端测试**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: 全绿(约 45 条,含新 test_ai_chat_feeds_inflight_and_versions)。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ai): feed in-flight requirements + versions into system prompt (Wave 5 Task 1)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 收尾验证

- [ ] 后端 pytest 全绿。
- [ ] (可选)手动:启动后端,POST /api/ai/chat/ 问"现在谁超载了",确认 AI 能引用具体在途需求/版本作答。
- [ ] 备份:`python manage.py backup_db`。
