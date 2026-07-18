import pytest
from apps.core.models import Member, Sprint, Requirement
from apps.core.ai_actions import execute_action
from datetime import date

@pytest.fixture
def setup_data():
    m = Member.objects.create(name="张三", week_capacity=40)
    s = Sprint.objects.create(name="S1", start_date=date(2026,7,6), end_date=date(2026,7,20))
    r = Requirement.objects.create(title="登录接口", assignee=m, assigned_sprint=s, status="backlog")
    return m, s, r

@pytest.mark.django_db
def test_update_requirement_by_title(setup_data):
    m, s, r = setup_data
    result = execute_action({"type": "update_requirement", "match": {"title": "登录接口"}, "fields": {"status": "in_progress", "assignee": "张三"}})
    assert result["success"] is True
    r.refresh_from_db()
    assert r.status == "in_progress"

@pytest.mark.django_db
def test_update_requirement_not_found():
    result = execute_action({"type": "update_requirement", "match": {"title": "不存在"}, "fields": {"status": "done"}})
    assert result["success"] is False
    assert "不存在" in result["message"]

@pytest.mark.django_db
def test_create_requirement(setup_data):
    result = execute_action({"type": "create_requirement", "params": {"title": "支付接口", "assignee": "张三", "assigned_sprint": "S1"}})
    assert result["success"] is True
    assert Requirement.objects.filter(title="支付接口").exists()

@pytest.mark.django_db
def test_delete_requirement_by_title(setup_data):
    result = execute_action({"type": "delete_requirement", "match": {"title": "登录接口"}})
    assert result["success"] is True
    assert not Requirement.objects.filter(title="登录接口").exists()

@pytest.mark.django_db
def test_update_member(setup_data):
    result = execute_action({"type": "update_member", "match": {"name": "张三"}, "fields": {"week_capacity": 35}})
    assert result["success"] is True

@pytest.mark.django_db
def test_unknown_action():
    result = execute_action({"type": "fly_to_moon"})
    assert result["success"] is False
    assert "不支持" in result["message"]
