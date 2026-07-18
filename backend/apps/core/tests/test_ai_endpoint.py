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
    r = client.post("/api/ai/chat/", {"message": "做登录", "history": []}, format="json")
    assert r.status_code == 200
    assert "好的" in r.data["reply"]
    assert len(r.data["drafts"]) == 1
    assert r.data["drafts"][0]["title"] == "登录"

@pytest.mark.django_db
@patch("apps.core.views.chat_with_glm")
def test_ai_chat_no_drafts(mock_glm, client):
    mock_glm.return_value = "你想用手机号还是邮箱?"
    r = client.post("/api/ai/chat/", {"message": "登录", "history": []}, format="json")
    assert r.status_code == 200
    assert r.data["drafts"] == []
