from unittest import mock
from django.test import TestCase
from uploads.services import youtube_oauth


class YouTubeOAuthTest(TestCase):
    def test_build_auth_url_contains_state_and_scope(self):
        with mock.patch("uploads.services.youtube_oauth.YouTubeAppConfig.get_active") as cfg:
            cfg.return_value.client_id = "cid"
            cfg.return_value.client_secret = "sec"
            cfg.return_value.redirect_uri = "http://localhost:8000/api/oauth/youtube/callback/"
            url = youtube_oauth.build_auth_url("abc123")
        self.assertIn("state=abc123", url)
        self.assertIn("youtube.upload", url)
        self.assertIn("access_type=offline", url)

    def test_exchange_code_for_tokens(self):
        fake = mock.Mock()
        fake.raise_for_status.return_value = None
        fake.json.return_value = {"access_token": "atok", "refresh_token": "rtok"}
        with mock.patch("uploads.services.youtube_oauth.requests.post", return_value=fake):
            with mock.patch("uploads.services.youtube_oauth.YouTubeAppConfig.get_active") as cfg:
                cfg.return_value.client_id = "cid"
                cfg.return_value.client_secret = "sec"
                cfg.return_value.redirect_uri = "http://localhost:8000/api/oauth/youtube/callback/"
                tokens = youtube_oauth.exchange_code_for_tokens("code123")
        self.assertEqual(tokens["access_token"], "atok")
        self.assertEqual(tokens["refresh_token"], "rtok")

    def test_fetch_channel_title(self):
        fake = mock.Mock()
        fake.raise_for_status.return_value = None
        fake.json.return_value = {"items": [{"snippet": {"title": "ช่องทดสอบ"}}]}
        with mock.patch("uploads.services.youtube_oauth.requests.get", return_value=fake):
            title = youtube_oauth.fetch_channel_title("atok")
        self.assertEqual(title, "ช่องทดสอบ")

    def test_exchange_raises_on_error(self):
        fake = mock.Mock()
        fake.raise_for_status.side_effect = Exception("invalid_grant")
        with mock.patch("uploads.services.youtube_oauth.requests.post", return_value=fake):
            with mock.patch("uploads.services.youtube_oauth.YouTubeAppConfig.get_active") as cfg:
                cfg.return_value.client_id = "cid"
                cfg.return_value.client_secret = "sec"
                cfg.return_value.redirect_uri = "http://localhost:8000/api/oauth/youtube/callback/"
                with self.assertRaises(ValueError):
                    youtube_oauth.exchange_code_for_tokens("bad")
