# backend/tests/test_oauth_views.py
from unittest import mock
from django.test import TestCase
from django.contrib.auth.models import User
from providers.models import YouTubeConfig
from uploads.models import Destination


class OAuthViewsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")
        YouTubeConfig.objects.create(
            client_id="cid", client_secret="csec", redirect_uri="http://localhost/callback"
        )

    def test_start_returns_auth_url_and_state(self):
        from uploads import views
        with mock.patch("uploads.views.youtube_oauth.build_auth_url", return_value="http://auth"):
            resp = self.client.get("/api/oauth/youtube/start/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["auth_url"], "http://auth")
        self.assertIn("oauth_state", self.client.session)

    def test_callback_creates_destination(self):
        from uploads import views
        with mock.patch("uploads.views.youtube_oauth.build_auth_url", return_value="x"):
            self.client.get("/api/oauth/youtube/start/")
        tokens = {"access_token": "atok", "refresh_token": "rtok"}
        with mock.patch("uploads.views.youtube_oauth.exchange_code_for_tokens", return_value=tokens), \
             mock.patch("uploads.views.youtube_oauth.fetch_channel_title", return_value="ช่องA"):
            resp = self.client.get("/api/oauth/youtube/callback/?code=abc&state=" + self.client.session["oauth_state"])
        self.assertEqual(resp.status_code, 200)
        dest = Destination.objects.get(platform="youtube")
        self.assertEqual(dest.name, "ช่องA")
        self.assertEqual(dest.refresh_token, "rtok")
        self.assertIn("oauth-success", resp.content.decode())

    def test_callback_rejects_bad_state(self):
        resp = self.client.get("/api/oauth/youtube/callback/?code=abc&state=wrong")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("oauth-error", resp.content.decode())
