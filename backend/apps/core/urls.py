from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import MemberViewSet, RequirementViewSet, MilestoneViewSet, VersionViewSet, TimeEntryViewSet, login_view, logout_view, me_view, ai_chat, ai_execute, snapshots_view, export_requirements, metrics_flow

router = DefaultRouter()
router.register('members', MemberViewSet)
router.register('requirements', RequirementViewSet)
router.register('milestones', MilestoneViewSet)
router.register('versions', VersionViewSet)
router.register('time-entries', TimeEntryViewSet)

urlpatterns = router.urls + [
    path('auth/login', login_view),
    path('auth/logout', logout_view),
    path('auth/me', me_view),
    path('ai/chat/', ai_chat),
    path('ai/execute/', ai_execute),
    path('snapshots/', snapshots_view),
    path('export/requirements.csv', export_requirements),
    path('metrics/flow/', metrics_flow),
]
