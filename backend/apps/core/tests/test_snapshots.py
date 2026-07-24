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
    assert snap[0]["remaining_effort"] == 19.0  # 24 - 5


@pytest.mark.django_db
def test_snapshot_updates_on_same_day(client, setup_data):
    """A3: 同一天再次访问应刷新(不再 get_or_create 锁定)。"""
    m = setup_data
    client.get("/api/snapshots/")
    # 工时变化后再次访问
    Requirement.objects.filter(assignee=m).update(est_effort=24, actual_effort=10)
    client.get("/api/snapshots/")
    assert MemberDailySnapshot.objects.filter(member=m).count() == 1  # 仍只有一条
    snap = MemberDailySnapshot.objects.get(member=m)
    assert snap.remaining_effort == 14.0  # 24 - 10, 已刷新


@pytest.mark.django_db
def test_snapshot_excludes_parent_double_count(client):
    """A1: 父需求有子任务时,只算叶子,不 double-count。"""
    m = Member.objects.create(name="父负责人", week_capacity=40)
    parent = Requirement.objects.create(title="父", assignee=m, est_effort=20, actual_effort=0, status="in_progress")
    Requirement.objects.create(title="子A", assignee=m, parent=parent, est_effort=6, actual_effort=0, status="in_progress")
    Requirement.objects.create(title="子B", assignee=m, parent=parent, est_effort=6, actual_effort=0, status="in_progress")
    client.get("/api/snapshots/")
    snap = MemberDailySnapshot.objects.get(member=m)
    assert snap.remaining_effort == 12.0  # 只算两个叶子 6+6, 父被排除


@pytest.mark.django_db
def test_snapshot_excludes_done(client):
    m = Member.objects.create(name="李四", week_capacity=40)
    Requirement.objects.create(title="已上线", assignee=m, est_effort=10, status="done")
    resp = client.get("/api/snapshots/")
    snap = [s for s in resp.data if s["member_id"] == m.id]
    assert len(snap) >= 1
    assert snap[0]["remaining_effort"] == 0
