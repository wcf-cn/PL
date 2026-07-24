from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.utils import timezone
from django.db.models import Count
from django.http import HttpResponse
import csv
from .models import Member, Requirement, Milestone, MemberDailySnapshot, Version
from .serializers import MemberSerializer, RequirementSerializer, MilestoneSerializer, VersionSerializer
from .ai import chat_with_glm, parse_drafts, strip_json_block, build_system_prompt, parse_actions, strip_actions_block
from .ai_actions import execute_action
from .metrics import flow_metrics

class MemberViewSet(viewsets.ModelViewSet):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer

class RequirementViewSet(viewsets.ModelViewSet):
    queryset = Requirement.objects.all()
    serializer_class = RequirementSerializer
    def get_queryset(self):
        qs = Requirement.objects.all()
        for f in ('status', 'assignee', 'priority'):
            v = self.request.query_params.get(f)
            if v:
                qs = qs.filter(**{f: v})
        return qs

class MilestoneViewSet(viewsets.ModelViewSet):
    queryset = Milestone.objects.all()
    serializer_class = MilestoneSerializer
    def get_queryset(self):
        qs = Milestone.objects.all()
        requirement_id = self.request.query_params.get('requirement')
        if requirement_id:
            qs = qs.filter(requirement_id=requirement_id)
        return qs

class VersionViewSet(viewsets.ModelViewSet):
    queryset = Version.objects.all()
    serializer_class = VersionSerializer

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    u = authenticate(request, username=request.data.get('username'), password=request.data.get('password'))
    if u is None:
        return Response({'detail': '用户名或密码错误'}, status=status.HTTP_401_UNAUTHORIZED)
    django_login(request, u)
    return Response({'username': u.username})

@api_view(['POST'])
def logout_view(request):
    django_logout(request)
    return Response({'detail': '已登出'})

@api_view(['GET'])
@permission_classes([AllowAny])
def me_view(request):
    if not request.user.is_authenticated:
        return Response({'detail': '未登录'}, status=status.HTTP_401_UNAUTHORIZED)
    return Response({'username': request.user.username})

@api_view(["POST"])
def ai_chat(request):
    message = request.data.get("message", "")
    history = request.data.get("history", [])
    members = list(Member.objects.values("id", "name"))
    modules = list(Requirement.objects.exclude(module="").values_list("module", flat=True).distinct())
    # 在途叶子需求摘要(最多30条,按优先级/工时排序)
    in_flight_qs = (Requirement.objects.exclude(status__in=['done', 'paused'])
        .annotate(nc=Count('children')).filter(nc=0)
        .select_related('assignee').order_by('-priority', '-est_effort')[:30])
    in_flight_text = "; ".join(
        f'{r.title}[{r.get_status_display()}]@{r.assignee.name if r.assignee else "未分配"} {r.est_effort}h'
        for r in in_flight_qs) or "无"
    # 版本摘要(含当前阶段)
    versions_text = "; ".join(f'{v.name}({v.current_phase})' for v in Version.objects.all()) or "无"
    system = build_system_prompt(members, modules, in_flight_text, versions_text)
    messages = [{"role": "system", "content": system}] + list(history) + [{"role": "user", "content": message}]
    try:
        reply = chat_with_glm(messages)
    except ValueError:
        return Response({"detail": "AI 未配置(GLM_API_KEY)"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception:
        return Response({"detail": "AI 服务暂不可用"}, status=status.HTTP_502_BAD_GATEWAY)
    reply_text = strip_actions_block(strip_json_block(reply))
    return Response({"reply": reply_text, "drafts": parse_drafts(reply), "actions": parse_actions(reply)})

@api_view(["POST"])
def ai_execute(request):
    result = execute_action(request.data)
    return Response(result)

@api_view(["GET"])
def snapshots_view(request):
    today = timezone.now().date()
    members = Member.objects.filter(active=True)
    for m in members:
        # A1: 只算叶子需求(无子任务),避免父子 double-count
        reqs = Requirement.objects.filter(assignee=m).exclude(status__in=['done', 'paused']) \
            .annotate(nc=Count('children')).filter(nc=0)
        remaining = sum(max(0, r.est_effort - r.actual_effort) for r in reqs)
        # A3: 当天多次访问刷新(update_or_create),不再 get_or_create 锁定
        MemberDailySnapshot.objects.update_or_create(
            date=today, member=m, defaults={'remaining_effort': remaining}
        )
    snaps = MemberDailySnapshot.objects.select_related('member').all()
    return Response([{
        'date': s.date.isoformat(),
        'member_id': s.member_id,
        'member': s.member.name,
        'remaining_effort': s.remaining_effort,
    } for s in snaps])


@api_view(['GET'])
def export_requirements(request):
    """导出全量需求为 CSV(IsAuthenticated)。"""
    resp = HttpResponse(content_type='text/csv')
    resp['Content-Disposition'] = 'attachment; filename="requirements.csv"'
    w = csv.writer(resp)
    w.writerow(['id', '标题', '状态', '优先级', '负责人', '模块', '版本',
                '预计工时', '实际工时', '进度', '计划开始', '计划结束', '更新时间'])
    for r in Requirement.objects.select_related('assignee', 'version'):
        w.writerow([
            r.id, r.title, r.get_status_display(), r.priority,
            r.assignee.name if r.assignee else '', r.module,
            r.version.name if r.version else '',
            r.est_effort, r.actual_effort, r.progress,
            r.planned_start or '', r.planned_end or '',
            r.updated_at.strftime('%Y-%m-%d'),
        ])
    return resp


@api_view(['GET'])
def metrics_flow(request):
    return Response(flow_metrics())
