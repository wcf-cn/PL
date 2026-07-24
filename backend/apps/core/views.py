from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.utils import timezone
from .models import Member, Requirement, Milestone, MemberDailySnapshot
from .serializers import MemberSerializer, RequirementSerializer, MilestoneSerializer
from .ai import chat_with_glm, parse_drafts, strip_json_block, build_system_prompt, parse_actions, strip_actions_block
from .ai_actions import execute_action

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
    system = build_system_prompt(members, modules)
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
        reqs = Requirement.objects.filter(assignee=m).exclude(status__in=['done', 'paused'])
        remaining = sum(max(0, r.est_effort - r.actual_effort) for r in reqs)
        MemberDailySnapshot.objects.get_or_create(
            date=today, member=m, defaults={'remaining_effort': remaining}
        )
    snaps = MemberDailySnapshot.objects.select_related('member').all()
    return Response([{
        'date': s.date.isoformat(),
        'member_id': s.member_id,
        'member': s.member.name,
        'remaining_effort': s.remaining_effort,
    } for s in snaps])
