import os
import socket
from unittest import mock

import pytest
import requests
from uploads.models import Destination
from uploads.services.token_refresh import (
    refresh_youtube_access_token,
    get_valid_access_token,
)


def _network_available(host="oauth2.googleapis.com", port=443, timeout=3):
    try:
        socket.create_connection((host, port), timeout=timeout)
        return True
    except OSError:
        return False


_REAL_NETWORK = _network_available() and os.environ.get("RUN_REAL_NETWORK") == "1"


def _fake_post_response(json_payload=None, error=None):
    resp = mock.Mock()
    if error:
        resp.raise_for_status.side_effect = error
    else:
        resp.raise_for_status.return_value = None
    resp.json.return_value = json_payload or {}
    return resp


def test_refresh_youtube_access_token(monkeypatch):
    monkeypatch.setattr(
        "uploads.services.token_refresh.requests.post",
        mock.Mock(return_value=_fake_post_response({"access_token": "new_tok"})),
    )
    assert refresh_youtube_access_token("cid", "csec", "rtok") == "new_tok"


def test_refresh_youtube_access_token_raises_on_error(monkeypatch):
    monkeypatch.setattr(
        "uploads.services.token_refresh.requests.post",
        mock.Mock(return_value=_fake_post_response(error=Exception("bad"))),
    )
    with pytest.raises(Exception):
        refresh_youtube_access_token("cid", "csec", "rtok")


@pytest.mark.django_db
def test_get_valid_access_token_uses_refresh(user, monkeypatch):
    dest = Destination.objects.create(
        platform="youtube", name="Ch", access_token="old",
        client_id="cid", client_secret="csec", refresh_token="rtok",
        created_by=user, updated_by=user,
    )
    monkeypatch.setattr(
        "uploads.services.token_refresh.requests.post",
        mock.Mock(return_value=_fake_post_response({"access_token": "fresh"})),
    )
    assert get_valid_access_token(dest) == "fresh"


@pytest.mark.django_db
def test_get_valid_access_token_legacy_fallback(user):
    dest = Destination.objects.create(
        platform="youtube", name="Ch", access_token="legacy",
        created_by=user, updated_by=user,
    )
    assert get_valid_access_token(dest) == "legacy"


@pytest.mark.django_db
def test_get_valid_access_token_facebook_legacy(user):
    dest = Destination.objects.create(
        platform="facebook", name="Pg", access_token="fbtok",
        created_by=user, updated_by=user,
    )
    assert get_valid_access_token(dest) == "fbtok"


@pytest.mark.skipif(not _REAL_NETWORK, reason="requires live network + RUN_REAL_NETWORK=1")
def test_refresh_youtube_access_token_real_endpoint():
    # Hits Google's real token endpoint to validate the actual network
    # code path and error handling. Uses an invalid refresh token so no
    # real credentials are needed; we expect a 400 invalid_grant response.
    with pytest.raises(requests.exceptions.HTTPError):
        refresh_youtube_access_token(
            "dummy_client_id.apps.googleusercontent.com",
            "dummy_secret",
            "dummy_invalid_refresh_token",
        )
