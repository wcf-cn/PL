import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.fixture
def client():
    User.objects.create_user('pl', password='pw')
    c = APIClient(); c.login(username='pl', password='pw')
    return c


def test_sprint_and_burndown_snapshot_models_removed():
    from apps.core import models
    assert not hasattr(models, 'Sprint')
    assert not hasattr(models, 'BurndownSnapshot')


def test_capacity_module_removed():
    import importlib
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module('apps.core.capacity')


@pytest.mark.django_db
def test_dead_endpoints_gone(client):
    # 路由已删 → 404
    assert client.get('/api/sprints/').status_code == 404
    assert client.get('/api/capacity/?sprint=1').status_code == 404
    assert client.get('/api/burndown/?sprint=1').status_code == 404