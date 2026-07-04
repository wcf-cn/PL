from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import MemberViewSet, SprintViewSet, RequirementViewSet, MilestoneViewSet, capacity_view, login_view, logout_view, me_view, burndown_view

router = DefaultRouter()
router.register('members', MemberViewSet)
router.register('sprints', SprintViewSet)
router.register('requirements', RequirementViewSet)
router.register('milestones', MilestoneViewSet)

urlpatterns = router.urls + [path('capacity/', capacity_view)]
urlpatterns += [
    path('auth/login', login_view),
    path('auth/logout', logout_view),
    path('auth/me', me_view),
    path('burndown/', burndown_view),
]
