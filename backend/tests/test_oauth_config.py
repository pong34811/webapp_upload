from django.test import TestCase
from uploads.models import YouTubeAppConfig


class YouTubeAppConfigTest(TestCase):
    def test_get_active_returns_config(self):
        YouTubeAppConfig.objects.create(
            client_id="cid.apps.googleusercontent.com",
            client_secret="sec",
            redirect_uri="http://localhost:8000/api/oauth/youtube/callback/",
        )
        cfg = YouTubeAppConfig.get_active()
        self.assertEqual(cfg.client_id, "cid.apps.googleusercontent.com")

    def test_get_active_raises_when_missing(self):
        from django.core.exceptions import ObjectDoesNotExist
        with self.assertRaises(ObjectDoesNotExist):
            YouTubeAppConfig.get_active()
