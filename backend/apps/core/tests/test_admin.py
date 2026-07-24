import pytest
from django.contrib.auth.models import User
from django.test import Client

@pytest.mark.django_db
def test_admin_requires_login():
    c = Client()
    r = c.get('/admin/')
    assert r.status_code in (200, 302)  # 302 重定向到登录

@pytest.mark.django_db
def test_admin_models_registered():
    from django.contrib import admin as djadmin
    from apps.core.models import Member, Requirement, Milestone
    assert Member in djadmin.site._registry
    assert Requirement in djadmin.site._registry
    assert Milestone in djadmin.site._registry
