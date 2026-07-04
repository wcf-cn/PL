from django.contrib import admin
from .models import Member, Sprint, Requirement

@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('name', 'week_capacity', 'modules', 'active')
    list_filter = ('active',)
    search_fields = ('name',)

@admin.register(Sprint)
class SprintAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_date', 'end_date', 'is_active')
    list_filter = ('is_active',)

@admin.register(Requirement)
class RequirementAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'priority', 'assignee', 'module', 'assigned_sprint', 'est_effort', 'progress')
    list_filter = ('status', 'priority', 'module', 'assigned_sprint')
    search_fields = ('title', 'note')
    list_editable = ('status', 'priority', 'progress')
