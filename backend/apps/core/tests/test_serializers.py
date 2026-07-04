import pytest
from apps.core.models import Member, Sprint, Requirement
from apps.core.serializers import RequirementSerializer

@pytest.mark.django_db
def test_requirement_serializer_exposes_names():
    m = Member.objects.create(name='张三')
    s = Sprint.objects.create(name='S1', start_date='2026-01-01', end_date='2026-01-14')
    r = Requirement.objects.create(title='登录', assignee=m, assigned_sprint=s)
    data = RequirementSerializer(r).data
    assert data['assignee_name'] == '张三'
    assert data['sprint_name'] == 'S1'
