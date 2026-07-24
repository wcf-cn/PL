import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Member, Requirement


@pytest.fixture
def client():
    User.objects.create_user('pl', password='pw')
    c = APIClient(); c.login(username='pl', password='pw'); return c


@pytest.mark.django_db
def test_blocked_by_exposed_in_serializer(client):
    m = Member.objects.create(name='张三')
    a = Requirement.objects.create(title='A', assignee=m)
    b = Requirement.objects.create(title='B', assignee=m)
    b.blocked_by.add(a)
    data = client.get(f'/api/requirements/{b.id}/').data
    assert a.id in data['blocked_by']
    # symmetrical=False: 反向不自动建立
    data_a = client.get(f'/api/requirements/{a.id}/').data
    assert b.id not in data_a['blocked_by']


@pytest.mark.django_db
def test_set_blocked_by_via_patch(client):
    m = Member.objects.create(name='张三')
    a = Requirement.objects.create(title='A', assignee=m)
    b = Requirement.objects.create(title='B', assignee=m)
    r = client.patch(f'/api/requirements/{b.id}/', {'blocked_by': [a.id]})
    assert r.status_code == 200
    assert a.id in r.data['blocked_by']
