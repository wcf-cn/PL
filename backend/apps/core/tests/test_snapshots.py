import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Member, Requirement, MemberDailySnapshot

@pytest.fixture
def client():
    User.objects.create_user("pl", password="pw")
    c = APIClient(); c.login(username="pl", password="pw")
    return c

@pytest.fixture
def setup_data():
    m = Member.objects.create(name="张三", week_capacity=40)
    Requirement.objects.create(title="测试", assignee=m, est_effort=24, actual_effort=5, status="in_progress")
    return m

@pytest.mark.django_db
def test_snapshot_created_on_visit(client, setup_data):
    m = setup_data
    resp = client.get("/api/snapshots/")
    assert resp.status_code == 200
    snap = [s for s in resp.data if s["member_id"] == m.id]
    assert len(snap) >= 1
    assert snap[0]["remaining_effort"] == 19.0

@pytest.mark.django_db
def test_snapshot_idempotent(client, setup_data):
    m = setup_data
    client.get("/api/snapshots/")
    client.get("/api/snapshots/")
    assert MemberDailySnapshot.objects.filter(member=m).count() == 1

@pytest.mark.django_db
def test_snapshot_excludes_done(client):
    m = Member.objects.create(name="李四", week_capacity=40)
    Requirement.objects.create(title="已上线", assignee=m, est_effort=10, status="done")
    resp = client.get("/api/snapshots/")
    snap = [s for s in resp.data if s["member_id"] == m.id]
    assert len(snap) >= 1
    assert snap[0]["remaining_effort"] == 0
