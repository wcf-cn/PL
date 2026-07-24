import pytest
from apps.core.models import Member, Requirement
from apps.core.serializers import RequirementSerializer


@pytest.mark.django_db
def test_requirement_serializer_exposes_names():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='登录', assignee=m)
    data = RequirementSerializer(r).data
    assert data['assignee_name'] == '张三'
    assert 'sprint_name' not in data
