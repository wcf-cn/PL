import pytest
from apps.core.models import Member, Requirement

@pytest.mark.django_db
def test_member_default_capacity():
    m = Member.objects.create(name='张三')
    assert m.week_capacity == 40
    assert m.active is True

@pytest.mark.django_db
def test_member_str():
    m = Member.objects.create(name='张三')
    assert str(m) == '张三'

@pytest.mark.django_db
def test_requirement_defaults():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='登录接口', assignee=m)
    assert r.status == 'backlog'
    assert r.priority == 'P1'
    assert r.progress == 0
    assert r.est_effort == 0
    assert str(r) == '登录接口'
