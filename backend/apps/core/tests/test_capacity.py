import pytest
from datetime import date
from apps.core.models import Member, Sprint, Requirement
from apps.core.capacity import sprint_capacity, sprint_load, utilization, single_point_risks

@pytest.fixture
def sprint():
    return Sprint.objects.create(name='S1', start_date=date(2026,7,6), end_date=date(2026,7,20))  # 2 周

@pytest.fixture
def member():
    return Member.objects.create(name='张三', week_capacity=40)

@pytest.mark.django_db
def test_sprint_capacity(member, sprint):
    assert sprint_capacity(member, sprint) == 80.0  # 40 * 2

@pytest.mark.django_db
def test_sprint_load_excludes_done_and_paused(member, sprint):
    Requirement.objects.create(title='A', assignee=member, assigned_sprint=sprint, est_effort=20, status='in_progress')
    Requirement.objects.create(title='B', assignee=member, assigned_sprint=sprint, est_effort=10, status='done')
    Requirement.objects.create(title='C', assignee=member, assigned_sprint=sprint, est_effort=5, status='paused')
    assert sprint_load(member, sprint) == 20.0  # 只算 in_progress 的 A

@pytest.mark.django_db
def test_utilization(member, sprint):
    Requirement.objects.create(title='A', assignee=member, assigned_sprint=sprint, est_effort=60, status='in_progress')
    # 容量 80,占用 60 → 0.75
    assert utilization(member, sprint) == 0.75

@pytest.mark.django_db
def test_utilization_zero_capacity(member, sprint):
    m2 = Member.objects.create(name='李四', week_capacity=0)
    assert utilization(m2, sprint) == 0  # 防除零

@pytest.mark.django_db
def test_single_point_risk():
    backend_only = Member.objects.create(name='张三')
    Member.objects.create(name='李四')
    s = Sprint.objects.create(name='S1', start_date=date(2026,7,6), end_date=date(2026,7,20))
    # 后端模块只有张三一人有需求 → 单点;前端两人 → 安全
    Requirement.objects.create(title='a', assignee=backend_only, module='后端', status='in_progress')
    Requirement.objects.create(title='b', assignee=backend_only, module='前端', status='in_progress')
    Requirement.objects.create(title='c', assignee=Member.objects.get(name='李四'), module='前端', status='in_progress')
    risks = single_point_risks()
    modules = [r['module'] for r in risks]
    assert '后端' in modules
    assert '前端' not in modules
