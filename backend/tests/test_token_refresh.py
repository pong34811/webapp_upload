import os
import socket
from unittest import mock, skipUnless
from django.test import TestCase
from django.contrib.auth.models import User
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


class TokenRefreshTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")

    def test_refresh_youtube_access_token(self):
        fake_resp = mock.Mock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {"access_token": "new_tok"}
        with mock.patch("uploads.services.token_refresh.requests.post", return_value=fake_resp):
            tok = refresh_youtube_access_token("cid", "csec", "rtok")
        self.assertEqual(tok, "new_tok")

    def test_refresh_youtube_access_token_raises_on_error(self):
        fake_resp = mock.Mock()
        fake_resp.raise_for_status.side_effect = Exception("bad")
        with mock.patch("uploads.services.token_refresh.requests.post", return_value=fake_resp):
            with self.assertRaises(Exception):
                refresh_youtube_access_token("cid", "csec", "rtok")

    def test_get_valid_access_token_uses_refresh(self):
        dest = Destination.objects.create(
            platform="youtube", name="Ch", access_token="old",
            client_id="cid", client_secret="csec", refresh_token="rtok",
            created_by=self.user, updated_by=self.user,
        )
        fake_resp = mock.Mock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {"access_token": "fresh"}
        with mock.patch("uploads.services.token_refresh.requests.post", return_value=fake_resp):
            tok = get_valid_access_token(dest)
        self.assertEqual(tok, "fresh")

    def test_get_valid_access_token_legacy_fallback(self):
        dest = Destination.objects.create(
            platform="youtube", name="Ch", access_token="legacy",
            created_by=self.user, updated_by=self.user,
        )
        tok = get_valid_access_token(dest)
        self.assertEqual(tok, "legacy")

    def test_get_valid_access_token_facebook_legacy(self):
        dest = Destination.objects.create(
            platform="facebook", name="Pg", access_token="fbtok",
            created_by=self.user, updated_by=self.user,
        )
        self.assertEqual(get_valid_access_token(dest), "fbtok")

    @skipUnless(_REAL_NETWORK, "requires live network + RUN_REAL_NETWORK=1")
    def test_refresh_youtube_access_token_real_endpoint(self):
        # Hits Google's real token endpoint to validate the actual network
        # code path and error handling. Uses an invalid refresh token so no
        # real credentials are needed; we expect a 400 invalid_grant response.
        import requests

        with self.assertRaises(requests.exceptions.HTTPError):
            refresh_youtube_access_token(
                "dummy_client_id.apps.googleusercontent.com",
                "dummy_secret",
                "dummy_invalid_refresh_token",
            )
