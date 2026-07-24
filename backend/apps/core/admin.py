from django.contrib import admin
from .models import Member, Requirement, Milestone, Version

@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('name', 'week_capacity', 'modules', 'active')
    list_filter = ('active',)
    search_fields = ('name',)

@admin.register(Requirement)
class RequirementAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'priority', 'assignee', 'module', 'est_effort', 'progress', 'version')
    list_filter = ('status', 'priority', 'module', 'version')
    search_fields = ('title', 'note')
    list_editable = ('status', 'priority', 'progress')
    filter_horizontal = ('blocked_by',)

@admin.register(Version)
class VersionAdmin(admin.ModelAdmin):
    list_display = ('name', 'integration_date', 'freeze_date', 'test_date', 'release_date')
    list_filter = ()
    search_fields = ('name', 'note')

@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ('title', 'date', 'requirement', 'note')
    list_filter = ('requirement',)
    search_fields = ('title',)
