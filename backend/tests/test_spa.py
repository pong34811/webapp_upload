from django.test import TestCase
from django.test.utils import override_settings
from pathlib import Path


class SpaServingTest(TestCase):
    @override_settings(SPA_DIR=Path(__file__).parent)
    def test_root_serves_index(self):
        from django.conf import settings
        if not (settings.SPA_DIR / "index.html").exists():
            self.skipTest("no built SPA present")
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)

    @override_settings(SPA_DIR=Path(__file__).parent)
    def test_catchall_serves_index(self):
        from django.conf import settings
        if not (settings.SPA_DIR / "index.html").exists():
            self.skipTest("no built SPA present")
        resp = self.client.get("/settings")
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "# setting")
