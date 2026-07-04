from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import models
from .models import Member, Sprint, Requirement, Milestone, BurndownSnapshot
from .serializers import MemberSerializer, SprintSerializer, RequirementSerializer, MilestoneSerializer
from . import capacity

class MemberViewSet(viewsets.ModelViewSet):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer

class SprintViewSet(viewsets.ModelViewSet):
    queryset = Sprint.objects.all()
    serializer_class = SprintSerializer

class RequirementViewSet(viewsets.ModelViewSet):
    queryset = Requirement.objects.all()
    serializer_class = RequirementSerializer
    def get_queryset(self):
        qs = Requirement.objects.all()
        for f in ('status', 'assignee', 'assigned_sprint', 'priority'):
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

@api_view(['GET'])
def capacity_view(request):
    sprint_id = request.query_params.get('sprint')
    if not sprint_id:
        return Response({'detail': 'sprint 参数必填'}, status=status.HTTP_400_BAD_REQUEST)
    sprint = get_object_or_404(Sprint, pk=sprint_id)
    rows = []
    for m in Member.objects.filter(active=True):
        rows.append({
            'member_id': m.id, 'member': m.name,
            'capacity': capacity.sprint_capacity(m, sprint),
            'load': capacity.sprint_load(m, sprint),
            'utilization': capacity.utilization(m, sprint),
        })
    rows.sort(key=lambda x: x['utilization'], reverse=True)
    return Response(rows)

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

@api_view(['GET'])
def burndown_view(request):
    sprint_id = request.query_params.get('sprint')
    if not sprint_id:
        return Response({'detail': 'sprint 参数必填'}, status=status.HTTP_400_BAD_REQUEST)
    sprint = get_object_or_404(Sprint, pk=sprint_id)

    # Calculate current remaining effort (exclude done/paused requirements)
    current_remaining = Requirement.objects.filter(
        assigned_sprint=sprint,
        status__in=['backlog', 'scheduled', 'in_progress', 'testing', 'blocked']
    ).aggregate(total=models.Sum('est_effort'))['total'] or 0

    # Create or update today's snapshot
    today = timezone.now().date()
    BurndownSnapshot.objects.get_or_create(
        sprint=sprint,
        date=today,
        defaults={'remaining_effort': current_remaining}
    )

    # Calculate total effort for the sprint
    total_effort = Requirement.objects.filter(
        assigned_sprint=sprint
    ).aggregate(total=models.Sum('est_effort'))['total'] or 0

    # Get all snapshots ordered by date
    snapshots = BurndownSnapshot.objects.filter(
        sprint=sprint
    ).order_by('date')

    return Response({
        'sprint': {
            'id': sprint.id,
            'name': sprint.name,
            'start_date': sprint.start_date.isoformat(),
            'end_date': sprint.end_date.isoformat()
        },
        'total_effort': total_effort,
        'snapshots': [
            {
                'date': snapshot.date.isoformat(),
                'remaining_effort': snapshot.remaining_effort
            }
            for snapshot in snapshots
        ]
    })
