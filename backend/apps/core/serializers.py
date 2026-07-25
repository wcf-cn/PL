from rest_framework import serializers
from .models import Member, Requirement, Milestone, Version, TimeEntry, VersionMergePoint

class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = '__all__'

class RequirementSerializer(serializers.ModelSerializer):
    assignee_name = serializers.CharField(source='assignee.name', read_only=True)
    version_name = serializers.CharField(source='version.name', read_only=True, default='')
    class Meta:
        model = Requirement
        fields = '__all__'

class VersionSerializer(serializers.ModelSerializer):
    current_phase = serializers.CharField(read_only=True)
    class Meta:
        model = Version
        fields = '__all__'

class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = '__all__'

class TimeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeEntry
        fields = '__all__'

class VersionMergePointSerializer(serializers.ModelSerializer):
    class Meta:
        model = VersionMergePoint
        fields = '__all__'
