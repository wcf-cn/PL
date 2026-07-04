from rest_framework import serializers
from .models import Member, Sprint, Requirement, Milestone

class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = '__all__'

class SprintSerializer(serializers.ModelSerializer):
    weeks = serializers.FloatField(read_only=True)
    class Meta:
        model = Sprint
        fields = '__all__'

class RequirementSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source='assignee.name', read_only=True)
    sprint_name = serializers.CharField(source='assigned_sprint.name', read_only=True, default='')
    class Meta:
        model = Requirement
        fields = '__all__'

class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = '__all__'
