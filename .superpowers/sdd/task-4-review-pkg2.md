e63a0a5 fix: require YouTubeAppConfig in OAuth callback; drop empty-secret fallback

 backend/tests/test_oauth_views.py |  5 ++++-
 backend/uploads/views.py          | 10 +++++-----
 2 files changed, 9 insertions(+), 6 deletions(-)

diff --git a/backend/tests/test_oauth_views.py b/backend/tests/test_oauth_views.py
index d15abb8..ae139c0 100644
--- a/backend/tests/test_oauth_views.py
+++ b/backend/tests/test_oauth_views.py
@@ -1,20 +1,23 @@
 # backend/tests/test_oauth_views.py
 from unittest import mock
 from django.test import TestCase
 from django.contrib.auth.models import User
-from uploads.models import Destination
+from uploads.models import Destination, YouTubeAppConfig
 
 
 class OAuthViewsTest(TestCase):
     def setUp(self):
         self.user = User.objects.create_user(username="admin", password="pass1234")
+        YouTubeAppConfig.objects.create(
+            client_id="cid", client_secret="csec", redirect_uri="http://localhost/callback"
+        )
 
     def test_start_returns_auth_url_and_state(self):
         from uploads import views
         with mock.patch("uploads.views.youtube_oauth.build_auth_url", return_value="http://auth"):
             resp = self.client.get("/api/oauth/youtube/start/")
         self.assertEqual(resp.status_code, 200)
         self.assertEqual(resp.json()["auth_url"], "http://auth")
         self.assertIn("oauth_state", self.client.session)
 
     def test_callback_creates_destination(self):
diff --git a/backend/uploads/views.py b/backend/uploads/views.py
index ec9d61e..04d3a9f 100644
--- a/backend/uploads/views.py
+++ b/backend/uploads/views.py
@@ -1,12 +1,13 @@
 import os
 import json
+import secrets
 import threading
 from pathlib import Path
 from django.conf import settings
 from django.http import JsonResponse, HttpResponse
 from rest_framework import viewsets, status
 from rest_framework.decorators import api_view, permission_classes, action, authentication_classes
 from rest_framework.response import Response
 from rest_framework.permissions import IsAuthenticated, AllowAny
 from django.views.decorators.csrf import csrf_exempt
 from django.contrib.auth import authenticate, login, logout
@@ -206,21 +207,20 @@ def spa_index(request):
     if html is None:
         return HttpResponse("SPA not built. Run the build step.", status=404)
     return HttpResponse(html)
 
 
 def spa_catchall(request, path=""):
     return spa_index(request)
 
 
 def oauth_youtube_start(request):
-    import secrets
     state = secrets.token_urlsafe(16)
     request.session["oauth_state"] = state
     auth_url = youtube_oauth.build_auth_url(state)
     return JsonResponse({"auth_url": auth_url})
 
 
 def _find_or_create_youtube_destination(title, tokens, cfg, user):
     dest = Destination.objects.filter(platform="youtube").first()
     if dest is None:
         dest = Destination(platform="youtube", created_by=user, updated_by=user)
@@ -239,20 +239,20 @@ def oauth_youtube_callback(request):
     state = request.GET.get("state", "")
     code = request.GET.get("code", "")
     expected = request.session.get("oauth_state", "")
     if not state or state != expected:
         result_payload = {"type": "oauth-error", "message": "state ไม่ถูกต้อง"}
         return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
     try:
         tokens = youtube_oauth.exchange_code_for_tokens(code)
         title = youtube_oauth.fetch_channel_title(tokens["access_token"])
         user = request.user if request.user.is_authenticated else None
-        try:
-            cfg = YouTubeAppConfig.get_active()
-        except YouTubeAppConfig.DoesNotExist:
-            cfg = type("Cfg", (), {"client_id": "", "client_secret": ""})()
+        cfg = YouTubeAppConfig.get_active()
         _find_or_create_youtube_destination(title, tokens, cfg, user)
+    except YouTubeAppConfig.DoesNotExist:
+        result_payload = {"type": "oauth-error", "message": "ยังไม่ได้ตั้งค่า YouTubeAppConfig ใน Admin"}
+        return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
     except Exception as e:
         result_payload = {"type": "oauth-error", "message": str(e)}
         return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
     result_payload = {"type": "oauth-success"}
     return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
