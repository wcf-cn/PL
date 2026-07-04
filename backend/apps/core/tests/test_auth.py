import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_login_and_me():
    User.objects.create_user('pl', password='pw')
    c = APIClient()
    r = c.post('/api/auth/login', {'username': 'pl', 'password': 'pw'})
    assert r.status_code == 200
    r2 = c.get('/api/auth/me')
    assert r2.status_code == 200
    assert r2.data['username'] == 'pl'

@pytest.mark.django_db
def test_login_wrong_password():
    User.objects.create_user('pl', password='pw')
    c = APIClient()
    r = c.post('/api/auth/login', {'username': 'pl', 'password': 'wrong'})
    assert r.status_code == 401

@pytest.mark.django_db
def test_me_unauthenticated():
    c = APIClient()
    r = c.get('/api/auth/me')
    assert r.status_code == 401
