from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Member, Sprint, Requirement
from .serializers import MemberSerializer, SprintSerializer, RequirementSerializer
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

@api_view(['GET'])
def capacity_view(request):
    sprint_id = request.query_params.get('sprint')
    if not sprint_id:
        return Response({'detail': 'sprint 参数必填'}, status=status.HTTP_400_BAD_REQUEST)
    sprint = Sprint.objects.get(pk=sprint_id)
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
