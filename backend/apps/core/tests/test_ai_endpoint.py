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
def test_ai_chat_returns_parent_children(mock_glm, client):
    mock_glm.return_value = '分析完成\n```json\n{"parent":{"title":"漏检优化"},"children":[{"title":"模型选型","type":"模型","analysis":"对比YOLOv8"}]}\n```'
    r = client.post("/api/ai/chat/", {"message": "漏检", "history": []}, format="json")
    assert r.status_code == 200
    assert r.data["drafts"] is not None
    assert r.data["drafts"]["parent"]["title"] == "漏检优化"
    assert len(r.data["drafts"]["children"]) == 1

@pytest.mark.django_db
@patch("apps.core.views.chat_with_glm")
def test_ai_chat_no_drafts(mock_glm, client):
    mock_glm.return_value = "你想用哪个模型?"
    r = client.post("/api/ai/chat/", {"message": "漏检", "history": []}, format="json")
    assert r.status_code == 200
    assert r.data["drafts"] is None
