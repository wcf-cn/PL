from datetime import timedelta
from django.utils import timezone
from .models import Requirement, RequirementStatusChange

STATUSES = ['backlog', 'scheduled', 'in_progress', 'testing', 'done', 'blocked', 'paused']


def throughput():
    """每周完成需求数(to_status=done 事件按 ISO 周聚合)。"""
    events = RequirementStatusChange.objects.filter(to_status='done').order_by('changed_at')
    buckets = {}
    for e in events:
        iso = e.changed_at.isocalendar()
        key = f'{iso[0]}-W{iso[1]:02d}'
        buckets[key] = buckets.get(key, 0) + 1
    return [{'week': k, 'count': v} for k, v in sorted(buckets.items())]


def cycletime():
    """每个 done 需求:in_progress→done 的小时数(无事件则用 created_at→last_status_change_at 近似)。"""
    out = []
    for r in Requirement.objects.filter(status='done'):
        start = RequirementStatusChange.objects.filter(requirement=r, to_status='in_progress')\
            .order_by('changed_at').first()
        end = RequirementStatusChange.objects.filter(requirement=r, to_status='done')\
            .order_by('changed_at').first()
        if start and end and end.changed_at > start.changed_at:
            hours = (end.changed_at - start.changed_at).total_seconds() / 3600
        elif r.created_at and r.last_status_change_at and r.last_status_change_at > r.created_at:
            hours = (r.last_status_change_at - r.created_at).total_seconds() / 3600
        else:
            continue
        out.append({'id': r.id, 'title': r.title, 'hours': round(hours, 1)})
    return out


def cfd():
    """按日重建各状态累计数量(堆叠面积图用)。上限最近 180 天。"""
    events = list(RequirementStatusChange.objects.order_by('changed_at'))
    if not events:
        return []
    today = timezone.now().date()
    start = events[0].changed_at.date()
    start = max(start, today - timedelta(days=180))
    by_req = {}
    for e in events:
        by_req.setdefault(e.requirement_id, []).append((e.changed_at, e.to_status))
    rows = []
    d = start
    while d <= today:
        counts = {s: 0 for s in STATUSES}
        for evs in by_req.values():
            status_on_d = None
            for (ct, to_st) in evs:  # evs 已按 changed_at 升序
                if ct.date() <= d:
                    status_on_d = to_st
                else:
                    break
            if status_on_d in counts:
                counts[status_on_d] += 1
        row = {'date': d.isoformat()}
        row.update(counts)
        rows.append(row)
        d += timedelta(days=1)
    return rows


def flow_metrics():
    return {'throughput': throughput(), 'cycletime': cycletime(), 'cfd': cfd()}
