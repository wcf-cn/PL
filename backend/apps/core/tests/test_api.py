import pytest
from datetime import date
from rest_framework.test import APIClient
from apps.core.models import Member, Sprint

@pytest.fixture
def client():
    from django.contrib.auth.models import User
    User.objects.create_user('pl', password='pw')
    c = APIClient()
    c.login(username='pl', password='pw')
    return c

@pytest.mark.django_db
def test_member_list(client):
    Member.objects.create(name='张三')
    r = client.get('/api/members/')
    assert r.status_code == 200
    assert r.data[0]['name'] == '张三'

@pytest.mark.django_db
def test_requirement_create_and_capacity(client):
    m = Member.objects.create(name='张三', week_capacity=40)
    s = Sprint.objects.create(name='S1', start_date=date(2026,7,6), end_date=date(2026,7,20))
    payload = {'title': '登录', 'assignee': m.id, 'assigned_sprint': s.id, 'est_effort': 60, 'status': 'in_progress'}
    r = client.post('/api/requirements/', payload)
    assert r.status_code == 201
    r2 = client.get(f'/api/capacity/?sprint={s.id}')
    assert r2.status_code == 200
    row = next(x for x in r2.data if x['member'] == '张三')
    assert row['utilization'] == 0.75
