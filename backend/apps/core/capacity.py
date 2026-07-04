from django.db.models import Count
from .models import Requirement

EXCLUDED_STATUS = [Requirement.STATUS_DONE, Requirement.STATUS_PAUSED]

def sprint_capacity(member, sprint):
    """成员在某 Sprint 的总容量(人时)= 周容量 × 周数"""
    return member.week_capacity * sprint.weeks

def sprint_load(member, sprint):
    """成员在某 Sprint 的在途需求预计工时之和(排除 done/paused)"""
    qs = Requirement.objects.filter(
        assignee=member, assigned_sprint=sprint,
    ).exclude(status__in=EXCLUDED_STATUS)
    return sum(r.est_effort for r in qs)

def utilization(member, sprint):
    """利用率 = 占用 / 容量,容量为 0 返回 0"""
    cap = sprint_capacity(member, sprint)
    if cap == 0:
        return 0
    return sprint_load(member, sprint) / cap

def single_point_risks():
    """只有 1 个活跃负责人覆盖的模块列表"""
    qs = Requirement.objects.exclude(status__in=EXCLUDED_STATUS).exclude(module='').values('module')\
        .annotate(n=Count('assignee', distinct=True)).filter(n=1)
    return [{'module': r['module'], 'n': r['n']} for r in qs]
