import pytest
from rest_framework.test import APIClient
from apps.core.models import Member


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
