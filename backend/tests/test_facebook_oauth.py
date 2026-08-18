# backend/tests/test_facebook_oauth.py
from unittest import mock
from datetime import datetime, timezone
import requests
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from providers.models import FacebookConfig
from uploads.models import Destination
from uploads.services.facebook_oauth import data_access_expiry


class FacebookExtendTokenTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(username="admin", password="pass1234"))
        self.cfg = FacebookConfig.objects.create(client_id="appid", client_secret="appsecret")

    def test_auth_url_returns_implicit_dialog(self):
        resp = self.client.get("/api/oauth/facebook/auth-url/")
        self.assertEqual(resp.status_code, 200)
        url = resp.json()["auth_url"]
        self.assertIn("https://www.facebook.com/v25.0/dialog/oauth", url)
        self.assertIn("response_type=token", url)
        self.assertIn("client_id=appid", url)
        self.assertIn("facebook-token", url)

    def test_extend_creates_destination_per_page(self):
        pages = [
            {"id": "111", "name": "PageA", "access_token": "longA"},
            {"id": "222", "name": "PageB", "access_token": "longB"},
        ]
        with mock.patch("uploads.views.facebook_oauth._config", return_value=self.cfg), \
             mock.patch("uploads.views.facebook_oauth.extend_token", return_value=("longtok", 5184000)), \
             mock.patch("uploads.views.facebook_oauth.data_access_expiry", return_value=None), \
             mock.patch("uploads.views.facebook_oauth.fetch_pages", return_value=pages):
            resp = self.client.post("/api/oauth/facebook/extend/", {"access_token": "short"}, format="json")
        self.assertEqual(resp.status_code, 200)
        dests = Destination.objects.filter(platform="facebook")
        self.assertEqual(dests.count(), 2)
        self.assertEqual(dests.get(page_id="111").name, "PageA")
        self.assertEqual(dests.get(page_id="111").access_token, "longA")
        self.assertEqual(dests.get(page_id="111").client_id, "appid")

    def test_extend_handles_page_token_via_me(self):
        with mock.patch("uploads.views.facebook_oauth._config", return_value=self.cfg), \
             mock.patch("uploads.views.facebook_oauth.extend_token", return_value=("longtok", 5184000)), \
             mock.patch("uploads.views.facebook_oauth.data_access_expiry", return_value=None), \
             mock.patch("uploads.views.facebook_oauth.fetch_pages", side_effect=ValueError("no pages")), \
             mock.patch("uploads.views.facebook_oauth.fetch_page_from_token", return_value={"id": "999", "name": "MyPage"}):
            resp = self.client.post("/api/oauth/facebook/extend/", {"access_token": "short"}, format="json")
        self.assertEqual(resp.status_code, 200)
        dest = Destination.objects.get(platform="facebook", page_id="999")
        self.assertEqual(dest.name, "MyPage")
        self.assertEqual(dest.access_token, "longtok")

    def test_extend_stores_data_access_expiry(self):
        pages = [{"id": "111", "name": "PageA", "access_token": "longA"}]
        exp = datetime(2026, 11, 8, 0, 0, tzinfo=timezone.utc)
        with mock.patch("uploads.views.facebook_oauth._config", return_value=self.cfg), \
             mock.patch("uploads.views.facebook_oauth.extend_token", return_value=("longtok", 5184000)), \
             mock.patch("uploads.views.facebook_oauth.data_access_expiry", return_value=exp), \
             mock.patch("uploads.views.facebook_oauth.fetch_pages", return_value=pages):
            resp = self.client.post("/api/oauth/facebook/extend/", {"access_token": "short"}, format="json")
        self.assertEqual(resp.status_code, 200)
        dest = Destination.objects.get(platform="facebook", page_id="111")
        self.assertEqual(dest.data_access_expires_at, exp)

    def test_extend_requires_token(self):
        resp = self.client.post("/api/oauth/facebook/extend/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_extend_surfaces_config_error(self):
        with mock.patch("uploads.views.facebook_oauth._config", side_effect=ValueError("ยังไม่ได้ตั้งค่า Facebook Config ใน Admin")):
            resp = self.client.post("/api/oauth/facebook/extend/", {"access_token": "x"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("ยังไม่ได้ตั้งค่า", resp.json()["error"])


class DataAccessExpiryTest(TestCase):
    def setUp(self):
        self.cfg = FacebookConfig.objects.create(client_id="appid", client_secret="appsecret")

    def _fake_resp(self, payload=None, status_error=None):
        resp = mock.Mock()
        if status_error:
            resp.raise_for_status.side_effect = status_error
        else:
            resp.raise_for_status.return_value = None
        resp.json.return_value = payload or {}
        return resp

    def test_parses_timestamp(self):
        exp = 1768000000
        with mock.patch("uploads.services.facebook_oauth.requests.get",
                        return_value=self._fake_resp({"data": {"data_access_expires_at": exp}})):
            result = data_access_expiry(self.cfg, "tok")
        self.assertEqual(result, datetime.fromtimestamp(exp, tz=timezone.utc))

    def test_returns_none_on_http_error(self):
        with mock.patch("uploads.services.facebook_oauth.requests.get",
                        return_value=self._fake_resp(status_error=requests.exceptions.HTTPError("400"))):
            self.assertIsNone(data_access_expiry(self.cfg, "tok"))

    def test_returns_none_on_connection_error(self):
        with mock.patch("uploads.services.facebook_oauth.requests.get",
                        side_effect=requests.exceptions.ConnectionError("no network")):
            self.assertIsNone(data_access_expiry(self.cfg, "tok"))

    def test_returns_none_when_fb_reports_no_expiry(self):
        with mock.patch("uploads.services.facebook_oauth.requests.get",
                        return_value=self._fake_resp({"data": {"app_id": "123"}})):
            self.assertIsNone(data_access_expiry(self.cfg, "tok"))
