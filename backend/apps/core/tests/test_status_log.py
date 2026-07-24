import pytest
from apps.core.models import Member, Requirement, RequirementStatusChange


@pytest.mark.django_db
def test_create_records_initial_event():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='backlog')
    events = list(RequirementStatusChange.objects.filter(requirement=r).order_by('changed_at'))
    assert len(events) == 1
    assert events[0].from_status == ''
    assert events[0].to_status == 'backlog'


@pytest.mark.django_db
def test_status_change_records_event():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='backlog')
    r.status = 'in_progress'; r.save()
    r.status = 'done'; r.save()
    events = list(RequirementStatusChange.objects.filter(requirement=r).order_by('changed_at'))
    assert [e.to_status for e in events] == ['backlog', 'in_progress', 'done']
    assert events[1].from_status == 'backlog' and events[1].to_status == 'in_progress'
    assert events[2].from_status == 'in_progress' and events[2].to_status == 'done'


@pytest.mark.django_db
def test_no_status_change_no_event():
    m = Member.objects.create(name='张三')
    r = Requirement.objects.create(title='A', assignee=m, status='in_progress', est_effort=5)
    n_after_create = RequirementStatusChange.objects.filter(requirement=r).count()
    r.est_effort = 10; r.save()  # 仅改工时
    assert RequirementStatusChange.objects.filter(requirement=r).count() == n_after_create
