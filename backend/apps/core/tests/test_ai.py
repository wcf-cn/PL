import pytest
from unittest.mock import patch, MagicMock
from apps.core.ai import chat_with_glm, parse_drafts, strip_json_block, build_system_prompt

def test_parse_drafts_extracts_parent_children():
    text = '分析完成\n```json\n{"parent":{"title":"漏检优化"},"children":[{"title":"模型选型","type":"模型","analysis":"对比YOLOv8"}]}\n```'
    result = parse_drafts(text)
    assert result is not None
    assert result["parent"]["title"] == "漏检优化"
    assert len(result["children"]) == 1
    assert result["children"][0]["type"] == "模型"

def test_parse_drafts_no_json_returns_none():
    assert parse_drafts("纯文字无json") is None

def test_parse_drafts_bad_json_returns_none():
    assert parse_drafts("```json\n{bad\n```") is None

def test_strip_json_block_removes_json():
    text = '对话\n```json\n{"parent":{"title":"x"},"children":[]}\n```\n结尾'
    assert "```json" not in strip_json_block(text)
    assert "对话" in strip_json_block(text)

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

@patch("apps.core.ai.requests.post")
def test_chat_with_glm_calls_api(mock_post):
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"content":[{"type":"text","text":"hi"}]}
    mock_resp.raise_for_status = MagicMock()
    mock_post.return_value = mock_resp
    import os
    old_key = os.environ.get("GLM_API_KEY")
    os.environ["GLM_API_KEY"] = "test-key"
    try:
        result = chat_with_glm([{"role":"user","content":"hi"}])
        assert result == "hi"
        mock_post.assert_called_once()
    finally:
        if old_key is None:
            os.environ.pop("GLM_API_KEY", None)
        else:
            os.environ["GLM_API_KEY"] = old_key
