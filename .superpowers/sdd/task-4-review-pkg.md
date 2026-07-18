4ce70e6 feat: add YouTube OAuth start/callback views and callback page

 backend/tests/test_oauth_views.py         | 37 +++++++++++++++++++++++
 backend/uploads/templates/oauth_done.html | 13 ++++++++
 backend/uploads/urls.py                   |  2 ++
 backend/uploads/views.py                  | 49 +++++++++++++++++++++++++++++++
 4 files changed, 101 insertions(+)

diff --git a/backend/tests/test_oauth_views.py b/backend/tests/test_oauth_views.py
new file mode 100644
index 0000000..d15abb8
--- /dev/null
+++ b/backend/tests/test_oauth_views.py
@@ -0,0 +1,37 @@
+# backend/tests/test_oauth_views.py
+from unittest import mock
+from django.test import TestCase
+from django.contrib.auth.models import User
+from uploads.models import Destination
+
+
+class OAuthViewsTest(TestCase):
+    def setUp(self):
+        self.user = User.objects.create_user(username="admin", password="pass1234")
+
+    def test_start_returns_auth_url_and_state(self):
+        from uploads import views
+        with mock.patch("uploads.views.youtube_oauth.build_auth_url", return_value="http://auth"):
+            resp = self.client.get("/api/oauth/youtube/start/")
+        self.assertEqual(resp.status_code, 200)
+        self.assertEqual(resp.json()["auth_url"], "http://auth")
+        self.assertIn("oauth_state", self.client.session)
+
+    def test_callback_creates_destination(self):
+        from uploads import views
+        with mock.patch("uploads.views.youtube_oauth.build_auth_url", return_value="x"):
+            self.client.get("/api/oauth/youtube/start/")
+        tokens = {"access_token": "atok", "refresh_token": "rtok"}
+        with mock.patch("uploads.views.youtube_oauth.exchange_code_for_tokens", return_value=tokens), \
+             mock.patch("uploads.views.youtube_oauth.fetch_channel_title", return_value="ช่องA"):
+            resp = self.client.get("/api/oauth/youtube/callback/?code=abc&state=" + self.client.session["oauth_state"])
+        self.assertEqual(resp.status_code, 200)
+        dest = Destination.objects.get(platform="youtube")
+        self.assertEqual(dest.name, "ช่องA")
+        self.assertEqual(dest.refresh_token, "rtok")
+        self.assertIn("oauth-success", resp.content.decode())
+
+    def test_callback_rejects_bad_state(self):
+        resp = self.client.get("/api/oauth/youtube/callback/?code=abc&state=wrong")
+        self.assertEqual(resp.status_code, 200)
+        self.assertIn("oauth-error", resp.content.decode())
diff --git a/backend/uploads/templates/oauth_done.html b/backend/uploads/templates/oauth_done.html
new file mode 100644
index 0000000..687e866
--- /dev/null
+++ b/backend/uploads/templates/oauth_done.html
@@ -0,0 +1,13 @@
+<!doctype html>
+<html lang="th">
+<head><meta charset="UTF-8"><title>OAuth Done</title></head>
+<body>
+<script>
+  const result = {{ result_json|safe }};
+  if (window.opener) {
+    window.opener.postMessage(result, window.location.origin);
+  }
+  window.close();
+</script>
+</body>
+</html>
diff --git a/backend/uploads/urls.py b/backend/uploads/urls.py
index 41cb6fc..764a101 100644
--- a/backend/uploads/urls.py
+++ b/backend/uploads/urls.py
@@ -3,12 +3,14 @@ from rest_framework.routers import DefaultRouter
 from . import views
 
 router = DefaultRouter()
 router.register("destinations", views.DestinationViewSet, basename="destination")
 router.register("uploads", views.UploadViewSet, basename="upload")
 
 urlpatterns = [
     path("auth/login/", views.api_login, name="api_login"),
     path("auth/logout/", views.api_logout, name="api_logout"),
     path("auth/me/", views.api_me, name="api_me"),
+    path("oauth/youtube/start/", views.oauth_youtube_start, name="oauth_start"),
+    path("oauth/youtube/callback/", views.oauth_youtube_callback, name="oauth_callback"),
     path("", include(router.urls)),
 ]
diff --git a/backend/uploads/views.py b/backend/uploads/views.py
index 96a5d17..ec9d61e 100644
--- a/backend/uploads/views.py
+++ b/backend/uploads/views.py
@@ -9,20 +9,23 @@ from rest_framework.decorators import api_view, permission_classes, action, auth
 from rest_framework.response import Response
 from rest_framework.permissions import IsAuthenticated, AllowAny
 from django.views.decorators.csrf import csrf_exempt
 from django.contrib.auth import authenticate, login, logout
 from django.contrib.auth.models import User
 from .models import Destination, UploadJob
 from .serializers import DestinationSerializer, UploadJobSerializer, UploadCreateSerializer
 from .services.youtube import upload_to_youtube
 from .services.facebook import upload_to_facebook
 from .services.token_refresh import get_valid_access_token
+from .services import youtube_oauth
+from django.shortcuts import render
+from .models import YouTubeAppConfig
 
 
 @csrf_exempt
 def api_login(request):
     if request.method != "POST":
         return JsonResponse({"error": "method not allowed"}, status=405)
     try:
         data = json.loads(request.body)
     except Exception:
         data = request.POST
@@ -200,10 +203,56 @@ def _read_index():
 
 def spa_index(request):
     html = _read_index()
     if html is None:
         return HttpResponse("SPA not built. Run the build step.", status=404)
     return HttpResponse(html)
 
 
 def spa_catchall(request, path=""):
     return spa_index(request)
+
+
+def oauth_youtube_start(request):
+    import secrets
+    state = secrets.token_urlsafe(16)
+    request.session["oauth_state"] = state
+    auth_url = youtube_oauth.build_auth_url(state)
+    return JsonResponse({"auth_url": auth_url})
+
+
+def _find_or_create_youtube_destination(title, tokens, cfg, user):
+    dest = Destination.objects.filter(platform="youtube").first()
+    if dest is None:
+        dest = Destination(platform="youtube", created_by=user, updated_by=user)
+    dest.name = title
+    dest.access_token = tokens.get("access_token", "")
+    dest.refresh_token = tokens.get("refresh_token", "")
+    dest.client_id = cfg.client_id
+    dest.client_secret = cfg.client_secret
+    dest.page_id = ""
+    dest.is_active = True
+    dest.save()
+    return dest
+
+
+def oauth_youtube_callback(request):
+    state = request.GET.get("state", "")
+    code = request.GET.get("code", "")
+    expected = request.session.get("oauth_state", "")
+    if not state or state != expected:
+        result_payload = {"type": "oauth-error", "message": "state ไม่ถูกต้อง"}
+        return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
+    try:
+        tokens = youtube_oauth.exchange_code_for_tokens(code)
+        title = youtube_oauth.fetch_channel_title(tokens["access_token"])
+        user = request.user if request.user.is_authenticated else None
+        try:
+            cfg = YouTubeAppConfig.get_active()
+        except YouTubeAppConfig.DoesNotExist:
+            cfg = type("Cfg", (), {"client_id": "", "client_secret": ""})()
+        _find_or_create_youtube_destination(title, tokens, cfg, user)
+    except Exception as e:
+        result_payload = {"type": "oauth-error", "message": str(e)}
+        return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
+    result_payload = {"type": "oauth-success"}
+    return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
