# backend/tests/test_facebook_oauth.py
from unittest import mock
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from providers.models import FacebookConfig
from uploads.models import Destination


class FacebookExtendTokenTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(username="admin", password="pass1234"))
        self.cfg = FacebookConfig.objects.create(client_id="appid", client_secret="appsecret")

    def test_extend_creates_destination_per_page(self):
        pages = [
            {"id": "111", "name": "PageA", "access_token": "longA"},
            {"id": "222", "name": "PageB", "access_token": "longB"},
        ]
        with mock.patch("uploads.views.facebook_oauth._config", return_value=self.cfg), \
             mock.patch("uploads.views.facebook_oauth.extend_token", return_value="longtok"), \
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
             mock.patch("uploads.views.facebook_oauth.extend_token", return_value="longtok"), \
             mock.patch("uploads.views.facebook_oauth.fetch_pages", side_effect=ValueError("no pages")), \
             mock.patch("uploads.views.facebook_oauth.fetch_page_from_token", return_value={"id": "999", "name": "MyPage"}):
            resp = self.client.post("/api/oauth/facebook/extend/", {"access_token": "short"}, format="json")
        self.assertEqual(resp.status_code, 200)
        dest = Destination.objects.get(platform="facebook", page_id="999")
        self.assertEqual(dest.name, "MyPage")
        self.assertEqual(dest.access_token, "longtok")

    def test_extend_requires_token(self):
        resp = self.client.post("/api/oauth/facebook/extend/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_extend_surfaces_config_error(self):
        with mock.patch("uploads.views.facebook_oauth._config", side_effect=ValueError("ยังไม่ได้ตั้งค่า Facebook Config ใน Admin")):
            resp = self.client.post("/api/oauth/facebook/extend/", {"access_token": "x"}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("ยังไม่ได้ตั้งค่า", resp.json()["error"])
