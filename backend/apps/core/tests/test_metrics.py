from datetime import timedelta
from django.utils import timezone
import pytest
from apps.core.models import Member, Requirement
from apps.core.metrics import flow_metrics


@pytest.mark.django_db
def test_throughput_counts_done_per_week():
    m = Member.objects.create(name='张三')
    for _ in range(2):
        r = Requirement.objects.create(title='A', assignee=m, status='in_progress')
        r.status = 'done'; r.save()
    data = flow_metrics()
    assert any(b['count'] == 2 for b in data['throughput'])


@pytest.mark.django_db
def test_cycletime_uses_events_then_fallback():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='in_progress')
    r.status = 'done'; r.save()
    data = flow_metrics()
    assert len(data['cycletime']) == 1
    assert data['cycletime'][0]['hours'] >= 0


@pytest.mark.django_db
def test_cfd_has_status_keys_and_rows():
    m = Member.objects.create(name='张三')
    Requirement.objects.create(title='A', assignee=m, status='backlog')
    data = flow_metrics()
    assert len(data['cfd']) >= 1
    row = data['cfd'][-1]
    for s in ['backlog', 'scheduled', 'in_progress', 'testing', 'done', 'blocked', 'paused']:
        assert s in row
    assert row['backlog'] >= 1
