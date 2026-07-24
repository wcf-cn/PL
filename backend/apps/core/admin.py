from django.contrib import admin
from .models import Member, Requirement, Milestone, Version, RequirementStatusChange, TimeEntry

@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('name', 'week_capacity', 'modules', 'active')
    list_filter = ('active',)
    search_fields = ('name',)

@admin.register(Requirement)
class RequirementAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'priority', 'kind', 'assignee', 'module', 'est_effort', 'progress', 'version')
    list_filter = ('status', 'priority', 'kind', 'module', 'version')
    search_fields = ('title', 'note')
    list_editable = ('status', 'priority', 'progress', 'kind')
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

@admin.register(RequirementStatusChange)
class RequirementStatusChangeAdmin(admin.ModelAdmin):
    list_display = ('requirement', 'from_status', 'to_status', 'changed_at')
    list_filter = ('to_status',)
    search_fields = ('requirement__title',)

@admin.register(TimeEntry)
class TimeEntryAdmin(admin.ModelAdmin):
    list_display = ('requirement', 'member', 'hours', 'date', 'note')
