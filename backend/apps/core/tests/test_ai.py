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