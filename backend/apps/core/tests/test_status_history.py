import pytest
from apps.core.models import Member, Requirement


@pytest.mark.django_db
def test_done_forces_progress_100():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='in_progress', progress=40)
    r.status = 'done'
    r.save()
    r.refresh_from_db()
    assert r.progress == 100


@pytest.mark.django_db
def test_status_change_updates_timestamp():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='backlog')
    first = r.last_status_change_at
    assert first is not None
    r.status = 'in_progress'
    r.save()
    r.refresh_from_db()
    assert r.last_status_change_at >= first


@pytest.mark.django_db
def test_no_status_change_does_not_update_timestamp():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='in_progress', est_effort=10)
    ts = r.last_status_change_at
    r.est_effort = 20
    r.save()
    r.refresh_from_db()
    assert r.last_status_change_at == ts  # 仅改工时,不改状态,时间戳不变
