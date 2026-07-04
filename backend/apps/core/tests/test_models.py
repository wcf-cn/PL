import pytest
from datetime import date
from apps.core.models import Member, Sprint

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
def test_sprint_weeks():
    s = Sprint.objects.create(name='2026-W27', start_date=date(2026,7,6), end_date=date(2026,7,20))
    assert s.weeks == 2.0
