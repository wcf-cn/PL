import pytest
from datetime import date
from rest_framework.test import APIClient
from apps.core.models import Member, Sprint, Requirement, Milestone

@pytest.fixture
def client():
    from django.contrib.auth.models import User
    User.objects.create_user('pl', password='pw')
    c = APIClient()
    c.login(username='pl', password='pw')
    return c

@pytest.mark.django_db
def test_milestone_create_and_list(client):
    # Setup: create member, sprint, requirement
    m = Member.objects.create(name='张三', week_capacity=40)
    s = Sprint.objects.create(name='S1', start_date=date(2026,7,6), end_date=date(2026,7,20))
    req = Requirement.objects.create(title='登录功能', assignee=m, assigned_sprint=s, est_effort=60)

    # Create milestone via API
    payload = {
        'requirement': req.id,
        'title': '联调完成',
        'date': '2026-07-10',
        'note': '后端+前端'
    }
    r = client.post('/api/milestones/', payload)
    assert r.status_code == 201
    assert r.data['title'] == '联调完成'
    assert r.data['requirement'] == req.id

    # List milestones filtered by requirement
    r2 = client.get(f'/api/milestones/?requirement={req.id}')
    assert r2.status_code == 200
    assert len(r2.data) == 1
    assert r2.data[0]['title'] == '联调完成'
    assert r2.data[0]['date'] == '2026-07-10'

@pytest.mark.django_db
def test_milestone_cascade_delete(client):
    # Setup: create member, sprint, requirement with milestone
    m = Member.objects.create(name='李四', week_capacity=40)
    s = Sprint.objects.create(name='S2', start_date=date(2026,7,1), end_date=date(2026,7,15))
    req = Requirement.objects.create(title='支付功能', assignee=m, assigned_sprint=s, est_effort=80)
    ms = Milestone.objects.create(requirement=req, title='设计完成', date=date(2026,7,5), note='UI设计')

    # Delete requirement should cascade delete milestone
    req_id = req.id
    req.delete()
    assert not Milestone.objects.filter(requirement_id=req_id).exists()
