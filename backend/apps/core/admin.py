from django.contrib import admin
from .models import Member, Requirement, Milestone

@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('name', 'week_capacity', 'modules', 'active')
    list_filter = ('active',)
    search_fields = ('name',)

@admin.register(Requirement)
class RequirementAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'priority', 'assignee', 'module', 'est_effort', 'progress')
    list_filter = ('status', 'priority', 'module')
    search_fields = ('title', 'note')
    list_editable = ('status', 'priority', 'progress')

@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ('title', 'date', 'requirement', 'note')
    list_filter = ('requirement',)
    search_fields = ('title',)
