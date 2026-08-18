import pytest
from rest_framework.test import APIClient


@pytest.fixture
def user(django_user_model):
    """Standard test user (admin / pass1234)."""
    return django_user_model.objects.create_user(username="admin", password="pass1234")


@pytest.fixture
def raw_client():
    """DRF APIClient without forced auth (for login/logout endpoints)."""
    return APIClient()


@pytest.fixture
def api_client(user):
    """DRF APIClient authenticated as the standard test user."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client
