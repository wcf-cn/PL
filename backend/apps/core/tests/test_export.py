import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Member, Requirement, Version


@pytest.fixture
def client():
    User.objects.create_user('pl', password='pw')
    c = APIClient()
    c.login(username='pl', password='pw')
    return c


@pytest.mark.django_db
def test_export_csv(client):
    m = Member.objects.create(name='张三', week_capacity=40)
    v = Version.objects.create(name='v2.0')
    Requirement.objects.create(title='登录', assignee=m, version=v, status='in_progress', est_effort=8)
    r = client.get('/api/export/requirements.csv')
    assert r.status_code == 200
    assert r['Content-Type'].startswith('text/csv')
    body = r.content.decode('utf-8')
    assert '标题' in body.splitlines()[0]
    assert '登录' in body
    assert '张三' in body
    assert 'v2.0' in body


@pytest.mark.django_db
def test_export_requires_auth():
    from rest_framework.test import APIClient
    r = APIClient().get('/api/export/requirements.csv')
    assert r.status_code in (401, 403)
