import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Member, Requirement, TimeEntry


@pytest.fixture
def client():
    User.objects.create_user('pl', password='pw')
    c = APIClient(); c.login(username='pl', password='pw'); return c


@pytest.mark.django_db
def test_timeentry_syncs_actual_effort(client):
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, actual_effort=0)
    client.post('/api/time-entries/', {'requirement': r.id, 'hours': 3, 'note': '开发'})
    client.post('/api/time-entries/', {'requirement': r.id, 'hours': 5})
    r.refresh_from_db()
    assert r.actual_effort == 8


@pytest.mark.django_db
def test_timeentry_filter_by_requirement(client):
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m)
    TimeEntry.objects.create(requirement=r, hours=2)
    data = client.get(f'/api/time-entries/?requirement={r.id}').data
    assert len(data) == 1 and float(data[0]['hours']) == 2
