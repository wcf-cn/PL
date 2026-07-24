from datetime import date
from django.utils import timezone
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.core.models import Version, Requirement, Member


@pytest.fixture
def client():
    User.objects.create_user('pl', password='pw')
    c = APIClient()
    c.login(username='pl', password='pw')
    return c


@pytest.mark.django_db
def test_current_phase_planning_when_no_dates():
    v = Version.objects.create(name='v1.0')
    assert v.current_phase == '规划中'


@pytest.mark.django_db
def test_current_phase_progresses_with_dates():
    today = timezone.now().date()
    v = Version.objects.create(
        name='v1.0',
        integration_date=today.replace(day=today.day - 10) if today.day > 10 else today,
        release_date=today.replace(day=today.day + 5) if today.day <= 25 else today.replace(month=today.month + 1, day=1),
    )
    # 今天已过联调日但未到发布日 → 联调中(或封板/转测,取决于其他日期)
    assert v.current_phase in ('联调中', '封板', '转测中')


@pytest.mark.django_db
def test_current_phase_released():
    today = timezone.now().date()
    v = Version.objects.create(name='v1.0', release_date=today.replace(day=today.day - 1) if today.day > 1 else today)
    assert v.current_phase == '已发布'


@pytest.mark.django_db
def test_version_crud(client):
    r = client.post('/api/versions/', {'name': 'v2.0', 'release_date': '2026-08-01'})
    assert r.status_code == 201
    vid = r.data['id']
    assert r.data['current_phase'] == '规划中'
    r2 = client.get('/api/versions/')
    assert r2.status_code == 200 and any(v['id'] == vid for v in r2.data)


@pytest.mark.django_db
def test_requirement_can_attach_version(client):
    m = Member.objects.create(name='张三')
    v = Version.objects.create(name='v2.0')
    r = client.post('/api/requirements/', {'title': '需求A', 'assignee': m.id, 'version': v.id})
    assert r.status_code == 201
    assert r.data['version'] == v.id
    assert r.data['version_name'] == 'v2.0'
