from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import MemberViewSet, SprintViewSet, RequirementViewSet, capacity_view

router = DefaultRouter()
router.register('members', MemberViewSet)
router.register('sprints', SprintViewSet)
router.register('requirements', RequirementViewSet)

urlpatterns = router.urls + [path('capacity/', capacity_view)]
