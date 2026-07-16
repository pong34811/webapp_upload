from unittest import mock
from django.test import TestCase
from django.contrib.auth.models import User
from uploads.models import Destination
from uploads.services.token_refresh import (
    refresh_youtube_access_token,
    get_valid_access_token,
)


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
