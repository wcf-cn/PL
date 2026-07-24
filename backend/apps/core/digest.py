from datetime import timedelta
import os
import requests
from django.utils import timezone
from django.db.models import Count
from .models import Requirement, Version, Member

PRODUCTIVITY_FACTOR = 0.7  # 与 Capacity.tsx 一致


def _leaves(qs):
    return qs.annotate(nc=Count('children')).filter(nc=0)


def build_digest():
    """构建每日风险摘要 markdown(与 Focus 页阈值一致)。"""
    today = timezone.now().date()
    leaves = _leaves(Requirement.objects.all())
    active = leaves.exclude(status__in=['done', 'paused'])

    overdue = []
    upcoming = []
    for r in active:
        if r.planned_end:
            days = (r.planned_end - today).days
            if days < 0:
                overdue.append((r, days))
            elif days <= 2:
                upcoming.append((r, days))

    blocked = [r for r in leaves if r.blocked_by.exists() or r.status == 'blocked']

    version_risks = []
    for v in Version.objects.all():
        v_leaves = _leaves(v.requirements.all())
        unfinished = v_leaves.exclude(status__in=['done', 'paused']).count()
        for k, label in (('freeze_date', '封板'), ('test_date', '转测')):
            d = getattr(v, k)
            if d and (d - today).days <= 3:
                version_risks.append((v.name, label, d.isoformat(), unfinished))

    overloaded = []
    for m in Member.objects.filter(active=True):
        load = sum(r.est_effort for r in _leaves(Requirement.objects.filter(assignee=m))
                   .exclude(status__in=['done', 'paused']))
        cap = m.week_capacity * PRODUCTIVITY_FACTOR
        if cap > 0 and load > cap:
            overloaded.append((m.name, int(load), int(cap)))

    lines = [f'# 📋 PL 看板 每日风险摘要({today.isoformat()})', '']
    if not (overdue or upcoming or blocked or version_risks or overloaded):
        return '\n'.join(lines + ['✅ 今日无风险,各指标正常。'])

    def section(icon, title, items):
        if not items:
            return []
        out = [f'## {icon} {title} ({len(items)})']
        out += items
        out.append('')
        return out

    lines += section('🔴', '超期',
                     [f'- {r.title} · {(r.assignee.name if r.assignee else "未分配")} · 应完成 {r.planned_end}'
                      for r, _ in overdue])
    lines += section('🟡', '将至(2天内)',
                     [f'- {r.title} · {(r.assignee.name if r.assignee else "未分配")} · {r.planned_end}'
                      for r, _ in upcoming])
    lines += section('🔒', '被阻塞',
                     [f'- {r.title} · {(r.assignee.name if r.assignee else "未分配")}'
                      + (f' · 被{r.blocked_by.count()}项阻塞' if r.blocked_by.exists() else '')
                      for r in blocked])
    lines += section('🏷️', '版本风险(3天内封板/转测)',
                     [f'- {name} {label} {d}' + (f' · {unf}项未完成' if unf else '')
                      for name, label, d, unf in version_risks])
    lines += section('⚠️', '超载成员',
                     [f'- {name} {load}h > 可用{cap}h' for name, load, cap in overloaded])
    return '\n'.join(lines)


def _title():
    return f'PL 看板 每日风险摘要({timezone.now().date().isoformat()})'


def send_digest():
    """读 .env 配置,把摘要推到 Server酱 webhook(个人微信)和/或邮件。无配置则静默跳过。"""
    md = build_digest()
    title = _title()
    webhook = os.environ.get('NOTIFY_WEBHOOK_URL', '')
    if webhook:
        try:
            requests.post(webhook, data={'title': title, 'desp': md}, timeout=15)
        except Exception:
            pass  # 推送失败不抛,避免 cron 报错刷屏
    email_to = os.environ.get('NOTIFY_EMAIL_TO', '')
    if email_to:
        try:
            from django.core.mail import send_mail
            send_mail(subject=title, message=md, from_email=os.environ.get('EMAIL_HOST_USER', '') or 'pl-board@local',
                      recipient_list=[email_to], fail_silently=True)
        except Exception:
            pass
