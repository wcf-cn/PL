import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Member, Requirement


@pytest.fixture
def client():
    User.objects.create_user('pl', password='pw')
    c = APIClient(); c.login(username='pl', password='pw'); return c


@pytest.mark.django_db
def test_requirement_kind_default_and_set(client):
    m = Member.objects.create(name='张三')
    r = client.post('/api/requirements/', {'title': 'A', 'assignee': m.id, 'kind': 'bug'}).data
    assert r['kind'] == 'bug'
    r2 = client.post('/api/requirements/', {'title': 'B', 'assignee': m.id}).data
    assert r2['kind'] == 'feature'
