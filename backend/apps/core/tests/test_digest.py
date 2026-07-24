from datetime import date, timedelta
import pytest
from apps.core.models import Member, Requirement, Version
from apps.core.digest import build_digest


@pytest.mark.django_db
def test_digest_lists_overdue_and_clean_when_none():
    m = Member.objects.create(name='张三', week_capacity=40)
    # 超期需求
    Requirement.objects.create(title='延期A', assignee=m, status='in_progress',
                               planned_end=date.today() - timedelta(days=3), est_effort=8)
    md = build_digest()
    assert '超期' in md and '延期A' in md
    # 无风险时给"今日无风险"
    Requirement.objects.filter(title='延期A').delete()
    md2 = build_digest()
    assert '无风险' in md2


@pytest.mark.django_db
def test_digest_version_risk_and_overload():
    m = Member.objects.create(name='张三', week_capacity=10)  # 可用 7h
    Requirement.objects.create(title='大需求', assignee=m, status='in_progress', est_effort=20)  # 超载
    v = Version.objects.create(name='v2.0', freeze_date=date.today() + timedelta(days=2))
    Requirement.objects.create(title='版本内需求', assignee=m, version=v, status='in_progress', est_effort=5)
    md = build_digest()
    assert '超载' in md and '张三' in md
    assert '版本风险' in md and 'v2.0' in md
