3bdb440 feat: add YouTube OAuth token exchange and channel lookup service

 backend/tests/test_youtube_oauth.py       | 47 ++++++++++++++++++++
 backend/uploads/services/youtube_oauth.py | 71 +++++++++++++++++++++++++++++++
 2 files changed, 118 insertions(+)

diff --git a/backend/tests/test_youtube_oauth.py b/backend/tests/test_youtube_oauth.py
new file mode 100644
index 0000000..fd8f872
--- /dev/null
+++ b/backend/tests/test_youtube_oauth.py
@@ -0,0 +1,47 @@
+from unittest import mock
+from django.test import TestCase
+from uploads.services import youtube_oauth
+
+
+class YouTubeOAuthTest(TestCase):
+    def test_build_auth_url_contains_state_and_scope(self):
+        with mock.patch("uploads.services.youtube_oauth.YouTubeAppConfig.get_active") as cfg:
+            cfg.return_value.client_id = "cid"
+            cfg.return_value.client_secret = "sec"
+            cfg.return_value.redirect_uri = "http://localhost:8000/api/oauth/youtube/callback/"
+            url = youtube_oauth.build_auth_url("abc123")
+        self.assertIn("state=abc123", url)
+        self.assertIn("youtube.upload", url)
+        self.assertIn("access_type=offline", url)
+
+    def test_exchange_code_for_tokens(self):
+        fake = mock.Mock()
+        fake.raise_for_status.return_value = None
+        fake.json.return_value = {"access_token": "atok", "refresh_token": "rtok"}
+        with mock.patch("uploads.services.youtube_oauth.requests.post", return_value=fake):
+            with mock.patch("uploads.services.youtube_oauth.YouTubeAppConfig.get_active") as cfg:
+                cfg.return_value.client_id = "cid"
+                cfg.return_value.client_secret = "sec"
+                cfg.return_value.redirect_uri = "http://localhost:8000/api/oauth/youtube/callback/"
+                tokens = youtube_oauth.exchange_code_for_tokens("code123")
+        self.assertEqual(tokens["access_token"], "atok")
+        self.assertEqual(tokens["refresh_token"], "rtok")
+
+    def test_fetch_channel_title(self):
+        fake = mock.Mock()
+        fake.raise_for_status.return_value = None
+        fake.json.return_value = {"items": [{"snippet": {"title": "ช่องทดสอบ"}}]}
+        with mock.patch("uploads.services.youtube_oauth.requests.get", return_value=fake):
+            title = youtube_oauth.fetch_channel_title("atok")
+        self.assertEqual(title, "ช่องทดสอบ")
+
+    def test_exchange_raises_on_error(self):
+        fake = mock.Mock()
+        fake.raise_for_status.side_effect = Exception("invalid_grant")
+        with mock.patch("uploads.services.youtube_oauth.requests.post", return_value=fake):
+            with mock.patch("uploads.services.youtube_oauth.YouTubeAppConfig.get_active") as cfg:
+                cfg.return_value.client_id = "cid"
+                cfg.return_value.client_secret = "sec"
+                cfg.return_value.redirect_uri = "http://localhost:8000/api/oauth/youtube/callback/"
+                with self.assertRaises(ValueError):
+                    youtube_oauth.exchange_code_for_tokens("bad")
diff --git a/backend/uploads/services/youtube_oauth.py b/backend/uploads/services/youtube_oauth.py
new file mode 100644
index 0000000..3155916
--- /dev/null
+++ b/backend/uploads/services/youtube_oauth.py
@@ -0,0 +1,71 @@
+import requests
+from urllib.parse import urlencode
+from django.core.exceptions import ObjectDoesNotExist
+from ..models import YouTubeAppConfig
+
+GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
+GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
+YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/channels"
+SCOPES = (
+    "https://www.googleapis.com/auth/youtube.upload "
+    "https://www.googleapis.com/auth/youtube.readonly"
+)
+
+
+def _config():
+    try:
+        return YouTubeAppConfig.get_active()
+    except ObjectDoesNotExist:
+        raise ValueError("ยังไม่ได้ตั้งค่า YouTubeAppConfig ใน Admin")
+
+
+def build_auth_url(state):
+    cfg = _config()
+    params = {
+        "client_id": cfg.client_id,
+        "redirect_uri": cfg.redirect_uri,
+        "response_type": "code",
+        "scope": SCOPES,
+        "state": state,
+        "access_type": "offline",
+        "prompt": "consent",
+    }
+    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
+
+
+def exchange_code_for_tokens(code):
+    cfg = _config()
+    resp = requests.post(
+        GOOGLE_TOKEN_URL,
+        data={
+            "client_id": cfg.client_id,
+            "client_secret": cfg.client_secret,
+            "code": code,
+            "grant_type": "authorization_code",
+            "redirect_uri": cfg.redirect_uri,
+        },
+    )
+    try:
+        resp.raise_for_status()
+    except Exception as e:
+        raise ValueError(f"แลกเปลี่ยน token ล้มเหลว: {e}")
+    data = resp.json()
+    if "access_token" not in data:
+        raise ValueError("ไม่ได้รับ access_token จาก Google")
+    return data
+
+
+def fetch_channel_title(access_token):
+    resp = requests.get(
+        YOUTUBE_API_URL,
+        params={"part": "snippet", "mine": "true"},
+        headers={"Authorization": f"Bearer {access_token}"},
+    )
+    try:
+        resp.raise_for_status()
+    except Exception as e:
+        raise ValueError(f"ดึงข้อมูลช่องล้มเหลว: {e}")
+    items = resp.json().get("items", [])
+    if not items:
+        raise ValueError("ไม่พบช่อง YouTube สำหรับบัญชีนี้")
+    return items[0]["snippet"]["title"]
