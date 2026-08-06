# backend/tests/test_facebook_oauth.py
from unittest import mock
from django.test import TestCase
from django.contrib.auth.models import User
from providers.models import FacebookConfig
from uploads.models import Destination


class FacebookOAuthViewsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")
        FacebookConfig.objects.create(
            client_id="appid", client_secret="appsecret", redirect_uri="http://localhost/cb"
        )

    def test_start_returns_auth_url_and_state(self):
        from uploads import views
        with mock.patch("uploads.views.facebook_oauth.build_auth_url", return_value="http://fbauth"):
            resp = self.client.get("/api/oauth/facebook/start/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["auth_url"], "http://fbauth")
        self.assertIn("oauth_fb_state", self.client.session)

    def test_callback_creates_destination_per_page(self):
        from uploads import views
        with mock.patch("uploads.views.facebook_oauth.build_auth_url", return_value="x"):
            self.client.get("/api/oauth/facebook/start/")
        pages = [
            {"id": "111", "name": "PageA", "access_token": "pageA"},
            {"id": "222", "name": "PageB", "access_token": "pageB"},
        ]
        with mock.patch("uploads.views.facebook_oauth.exchange_code_for_user_token", return_value="usertok"), \
             mock.patch("uploads.views.facebook_oauth.fetch_pages", return_value=pages):
            resp = self.client.get(
                "/api/oauth/facebook/callback/?code=abc&state=" + self.client.session["oauth_fb_state"]
            )
        self.assertEqual(resp.status_code, 200)
        dests = Destination.objects.filter(platform="facebook")
        self.assertEqual(dests.count(), 2)
        self.assertEqual(dests.get(page_id="111").name, "PageA")
        self.assertEqual(dests.get(page_id="111").access_token, "pageA")
        self.assertEqual(dests.get(page_id="111").client_id, "appid")
        self.assertIn("oauth-success", resp.content.decode())

    def test_callback_rejects_bad_state(self):
        resp = self.client.get("/api/oauth/facebook/callback/?code=abc&state=wrong")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("oauth-error", resp.content.decode())
        self.assertEqual(Destination.objects.filter(platform="facebook").count(), 0)