import pytest
from django.utils import timezone
from rest_framework.test import APIClient
from apps.core.models import Sprint, Requirement, BurndownSnapshot, Member

@pytest.fixture
def client():
    from django.contrib.auth.models import User
    User.objects.create_user('pl', password='pw')
    c = APIClient()
    c.login(username='pl', password='pw')
    return c

@pytest.mark.django_db
def test_burndown_endpoint(client):
    # Create a sprint
    sprint = Sprint.objects.create(
        name='Sprint 1',
        start_date='2026-07-01',
        end_date='2026-07-14'
    )

    # Create a member
    member = Member.objects.create(name='Test Member')

    # Create requirements with different statuses
    req1 = Requirement.objects.create(
        title='Active Requirement',
        status='in_progress',
        assignee=member,
        assigned_sprint=sprint,
        est_effort=8.0
    )

    req2 = Requirement.objects.create(
        title='Done Requirement',
        status='done',
        assignee=member,
        assigned_sprint=sprint,
        est_effort=4.0
    )

    req3 = Requirement.objects.create(
        title='Paused Requirement',
        status='paused',
        assignee=member,
        assigned_sprint=sprint,
        est_effort=2.0
    )

    # Call the burndown endpoint
    response = client.get('/api/burndown/', {'sprint': sprint.id})

    # Assert response is successful
    assert response.status_code == 200

    data = response.json()

    # Assert sprint information
    assert data['sprint']['id'] == sprint.id
    assert data['sprint']['name'] == 'Sprint 1'

    # Assert total effort includes all requirements
    assert data['total_effort'] == 14.0  # 8.0 + 4.0 + 2.0

    # Assert today's snapshot is present
    today = timezone.now().date().isoformat()
    snapshot_dates = [s['date'] for s in data['snapshots']]
    assert today in snapshot_dates

    # Find today's snapshot
    today_snapshot = next(s for s in data['snapshots'] if s['date'] == today)

    # Assert remaining effort excludes done and paused
    assert today_snapshot['remaining_effort'] == 8.0  # Only active requirement

@pytest.mark.django_db
def test_burndown_requires_sprint_parameter(client):
    response = client.get('/api/burndown/')
    assert response.status_code == 400
    assert 'sprint 参数必填' in response.json()['detail']

@pytest.mark.django_db
def test_burndown_invalid_sprint(client):
    response = client.get('/api/burndown/', {'sprint': 99999})
    assert response.status_code == 404
