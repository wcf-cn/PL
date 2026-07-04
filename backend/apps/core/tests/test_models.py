import pytest
from apps.core.models import Member

@pytest.mark.django_db
def test_member_default_capacity():
    m = Member.objects.create(name='张三')
    assert m.week_capacity == 40
    assert m.active is True

@pytest.mark.django_db
def test_member_str():
    m = Member.objects.create(name='张三')
    assert str(m) == '张三'
