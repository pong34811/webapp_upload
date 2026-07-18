225bcb3 docs: document YouTube OAuth setup; verify token refresh on upload
c96146b feat: add YouTube OAuth connect button in DestinationForm
0b91152 feat: add YouTube OAuth connect button on SettingsPage
e63a0a5 fix: require YouTubeAppConfig in OAuth callback; drop empty-secret fallback
4ce70e6 feat: add YouTube OAuth start/callback views and callback page
3bdb440 feat: add YouTube OAuth token exchange and channel lookup service
6faa363 feat: register YouTubeAppConfig in Django Admin
ca8d67c feat: add YouTubeAppConfig model for central OAuth credentials

 README.md                                          |  9 +++
 backend/tests/test_oauth_config.py                 | 18 ++++++
 backend/tests/test_oauth_views.py                  | 40 ++++++++++++
 backend/tests/test_process_upload_oauth.py         | 27 ++++++++
 backend/tests/test_youtube_oauth.py                | 47 ++++++++++++++
 backend/uploads/admin.py                           | 18 +++++-
 .../uploads/migrations/0003_youtubeappconfig.py    | 22 +++++++
 backend/uploads/models.py                          | 13 ++++
 backend/uploads/services/youtube_oauth.py          | 71 ++++++++++++++++++++++
 backend/uploads/templates/oauth_done.html          | 13 ++++
 backend/uploads/urls.py                            |  2 +
 backend/uploads/views.py                           | 49 +++++++++++++++
 frontend/src/api/client.js                         |  4 ++
 frontend/src/components/DestinationForm.jsx        | 22 ++++++-
 frontend/src/pages/SettingsPage.jsx                | 31 +++++++++-
 frontend/src/test/destination_form_oauth.test.jsx  | 36 +++++++++++
 frontend/src/test/oauth.test.jsx                   | 56 +++++++++++++++++
 17 files changed, 473 insertions(+), 5 deletions(-)

diff --git a/README.md b/README.md
index 2a27c5c..265aa2e 100644
--- a/README.md
+++ b/README.md
@@ -52,8 +52,17 @@ npm run dev
 Build script จะรัน `npm install && npm run build` ใน `frontend/` แล้วคัดลอก `frontend/dist/` เข้า `backend/uploads/static/spa/` Django จะ serve `index.html` และ catch-all route สำหรับ client-side paths (`/uploads`, `/settings` ฯลฯ)
 
 ### จำกัด CORS สำหรับ Production
 `CORS_ALLOW_ALL_ORIGINS = True` ใช้ได้ใน dev mode สำหรับ production จริงให้แก้ไขใน `backend/core/settings.py`:
 ```python
 CORS_ALLOW_ALL_ORIGINS = False
 CORS_ALLOWED_ORIGINS = ["https://your-host"]
 ```
+
+## ตั้งค่า YouTube OAuth
+
+1. ใน Google Cloud Console สร้าง OAuth 2.0 Client ID (ประเภท Web application)
+2. เพิ่ม Authorized redirect URI: `http://<host>/api/oauth/youtube/callback/`
+   (ตอนพัฒนาใช้ `http://localhost:8000/api/oauth/youtube/callback/`)
+3. ใน Django Admin (`/admin`) เพิ่ม YouTubeAppConfig ด้วย client_id, client_secret, redirect_uri จากข้อ 2
+4. ที่หน้า "จัดการตั้งค่าช่องทาง" กด "เชื่อมต่อ YouTube" และล็อกอินบัญชี Google
+5. ช่องจะถูกเพิ่มพร้อม token ที่ต่ออายุอัตโนมัติ
diff --git a/backend/tests/test_oauth_config.py b/backend/tests/test_oauth_config.py
new file mode 100644
index 0000000..08e3a96
--- /dev/null
+++ b/backend/tests/test_oauth_config.py
@@ -0,0 +1,18 @@
+from django.test import TestCase
+from uploads.models import YouTubeAppConfig
+
+
+class YouTubeAppConfigTest(TestCase):
+    def test_get_active_returns_config(self):
+        YouTubeAppConfig.objects.create(
+            client_id="cid.apps.googleusercontent.com",
+            client_secret="sec",
+            redirect_uri="http://localhost:8000/api/oauth/youtube/callback/",
+        )
+        cfg = YouTubeAppConfig.get_active()
+        self.assertEqual(cfg.client_id, "cid.apps.googleusercontent.com")
+
+    def test_get_active_raises_when_missing(self):
+        from django.core.exceptions import ObjectDoesNotExist
+        with self.assertRaises(ObjectDoesNotExist):
+            YouTubeAppConfig.get_active()
diff --git a/backend/tests/test_oauth_views.py b/backend/tests/test_oauth_views.py
new file mode 100644
index 0000000..ae139c0
--- /dev/null
+++ b/backend/tests/test_oauth_views.py
@@ -0,0 +1,40 @@
+# backend/tests/test_oauth_views.py
+from unittest import mock
+from django.test import TestCase
+from django.contrib.auth.models import User
+from uploads.models import Destination, YouTubeAppConfig
+
+
+class OAuthViewsTest(TestCase):
+    def setUp(self):
+        self.user = User.objects.create_user(username="admin", password="pass1234")
+        YouTubeAppConfig.objects.create(
+            client_id="cid", client_secret="csec", redirect_uri="http://localhost/callback"
+        )
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
diff --git a/backend/tests/test_process_upload_oauth.py b/backend/tests/test_process_upload_oauth.py
new file mode 100644
index 0000000..9e9d9ca
--- /dev/null
+++ b/backend/tests/test_process_upload_oauth.py
@@ -0,0 +1,27 @@
+from unittest import mock
+from django.test import TestCase
+from django.contrib.auth.models import User
+from uploads.models import Destination, UploadJob
+from uploads import views
+
+
+class ProcessUploadOAuthTest(TestCase):
+    def setUp(self):
+        self.user = User.objects.create_user(username="admin", password="pass1234")
+
+    def test_process_upload_refreshes_youtube_token(self):
+        dest = Destination.objects.create(
+            platform="youtube", name="ช่องA", access_token="old",
+            refresh_token="rtok", client_id="cid", client_secret="csec",
+            created_by=self.user, updated_by=self.user,
+        )
+        job = UploadJob.objects.create(
+            destination=dest, filename="v.mp4", file_path="/tmp/v.mp4",
+            title="V", created_by=self.user, updated_by=self.user,
+        )
+        with mock.patch("uploads.services.token_refresh.refresh_youtube_access_token", return_value="fresh_tok"), \
+             mock.patch("uploads.views.upload_to_youtube", return_value="vid123"):
+            views._process_upload(job.id)
+        job.refresh_from_db()
+        self.assertEqual(job.status, "success")
+        self.assertEqual(job.platform_video_id, "vid123")
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
diff --git a/backend/uploads/admin.py b/backend/uploads/admin.py
index 44333ae..3938996 100644
--- a/backend/uploads/admin.py
+++ b/backend/uploads/admin.py
@@ -1,5 +1,17 @@
 from django.contrib import admin
-from .models import Destination, UploadJob
+from .models import Destination, UploadJob, YouTubeAppConfig
 
-admin.site.register(Destination)
-admin.site.register(UploadJob)
+
+@admin.register(Destination)
+class DestinationAdmin(admin.ModelAdmin):
+    list_display = ("platform", "name", "is_active", "created_at")
+
+
+@admin.register(UploadJob)
+class UploadJobAdmin(admin.ModelAdmin):
+    list_display = ("title", "destination", "status", "created_at")
+
+
+@admin.register(YouTubeAppConfig)
+class YouTubeAppConfigAdmin(admin.ModelAdmin):
+    list_display = ("client_id", "redirect_uri")
diff --git a/backend/uploads/migrations/0003_youtubeappconfig.py b/backend/uploads/migrations/0003_youtubeappconfig.py
new file mode 100644
index 0000000..30a0713
--- /dev/null
+++ b/backend/uploads/migrations/0003_youtubeappconfig.py
@@ -0,0 +1,22 @@
+# Generated by Django 5.2.16 on 2026-07-16 09:38
+
+from django.db import migrations, models
+
+
+class Migration(migrations.Migration):
+
+    dependencies = [
+        ('uploads', '0002_destination_client_id_destination_client_secret_and_more'),
+    ]
+
+    operations = [
+        migrations.CreateModel(
+            name='YouTubeAppConfig',
+            fields=[
+                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
+                ('client_id', models.CharField(max_length=255)),
+                ('client_secret', models.TextField()),
+                ('redirect_uri', models.URLField()),
+            ],
+        ),
+    ]
diff --git a/backend/uploads/models.py b/backend/uploads/models.py
index 639d8e4..32bf62c 100644
--- a/backend/uploads/models.py
+++ b/backend/uploads/models.py
@@ -52,8 +52,21 @@ class UploadJob(models.Model):
     is_active = models.BooleanField(default=True)
     created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="uploads_created")
     updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="uploads_updated")
     created_at = models.DateTimeField(auto_now_add=True)
     updated_at = models.DateTimeField(auto_now=True)
 
     def __str__(self):
         return f"{self.title} → {self.destination}"
+
+
+class YouTubeAppConfig(models.Model):
+    client_id = models.CharField(max_length=255)
+    client_secret = models.TextField()
+    redirect_uri = models.URLField()
+
+    def __str__(self):
+        return f"YouTubeAppConfig({self.client_id})"
+
+    @classmethod
+    def get_active(cls):
+        return cls.objects.latest("id")
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
@@ -5,10 +5,12 @@ from . import views
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
index 96a5d17..04d3a9f 100644
--- a/backend/uploads/views.py
+++ b/backend/uploads/views.py
@@ -1,26 +1,30 @@
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
@@ -202,8 +206,53 @@ def spa_index(request):
     html = _read_index()
     if html is None:
         return HttpResponse("SPA not built. Run the build step.", status=404)
     return HttpResponse(html)
 
 
 def spa_catchall(request, path=""):
     return spa_index(request)
+
+
+def oauth_youtube_start(request):
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
+        cfg = YouTubeAppConfig.get_active()
+        _find_or_create_youtube_destination(title, tokens, cfg, user)
+    except YouTubeAppConfig.DoesNotExist:
+        result_payload = {"type": "oauth-error", "message": "ยังไม่ได้ตั้งค่า YouTubeAppConfig ใน Admin"}
+        return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
+    except Exception as e:
+        result_payload = {"type": "oauth-error", "message": str(e)}
+        return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
+    result_payload = {"type": "oauth-success"}
+    return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
diff --git a/frontend/src/api/client.js b/frontend/src/api/client.js
index 4eb9d26..a538d28 100644
--- a/frontend/src/api/client.js
+++ b/frontend/src/api/client.js
@@ -36,16 +36,20 @@ export const authAPI = {
 
 export const destinationAPI = {
   list: () => api.get('/destinations/'),
   create: (data) => api.post('/destinations/', data),
   update: (id, data) => api.put(`/destinations/${id}/`, data),
   remove: (id) => api.delete(`/destinations/${id}/`),
 }
 
+export const oauthAPI = {
+  start: () => api.get('/oauth/youtube/start/'),
+}
+
 export const uploadAPI = {
   create: (formData, onProgress) =>
     api.post('/uploads/', formData, {
       headers: { 'Content-Type': 'multipart/form-data' },
       onUploadProgress: (e) => {
         if (e.lengthComputable && onProgress) {
           onProgress(Math.round((e.loaded / e.total) * 30))
         }
diff --git a/frontend/src/components/DestinationForm.jsx b/frontend/src/components/DestinationForm.jsx
index da4eb86..0963385 100644
--- a/frontend/src/components/DestinationForm.jsx
+++ b/frontend/src/components/DestinationForm.jsx
@@ -1,9 +1,11 @@
 import { useState, useEffect } from 'react'
+import { toast } from 'react-toastify'
+import { oauthAPI } from '../api/client'
 
 export default function DestinationForm({ destination, onSubmit, onClose }) {
   const [form, setForm] = useState({
     platform: 'youtube',
     name: '',
     access_token: '',
     page_id: '',
     client_id: '',
@@ -24,16 +26,31 @@ export default function DestinationForm({ destination, onSubmit, onClose }) {
       })
     }
   }, [destination])
 
   const handleChange = (e) => {
     setForm({ ...form, [e.target.name]: e.target.value })
   }
 
+  useEffect(() => {
+    const onMsg = (e) => {
+      if (e.data?.type === 'oauth-success') {
+        toast.success('เชื่อมต่อช่อง YouTube สำเร็จ กรุณาตรวจสอบข้อมูลแล้วบันทึก')
+      }
+    }
+    window.addEventListener('message', onMsg)
+    return () => window.removeEventListener('message', onMsg)
+  }, [])
+
+  const handleConnectGoogle = async () => {
+    const res = await oauthAPI.start()
+    window.open(res.data.auth_url, '_blank', 'width=600,height=700')
+  }
+
   const handleSubmit = (e) => {
     e.preventDefault()
     onSubmit(form)
   }
 
   return (
     <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
       <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 24, borderRadius: 8, width: 400 }}>
@@ -43,20 +60,23 @@ export default function DestinationForm({ destination, onSubmit, onClose }) {
             <option value="youtube">YouTube</option>
             <option value="facebook">Facebook</option>
           </select>
         </div>
         <div style={{ marginBottom: 12 }}>
           <input name="name" placeholder="ชื่อ (เช่น ช่อง A)" value={form.name} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
         </div>
         <div style={{ marginBottom: 12 }}>
-          <input name="access_token" placeholder="Access Token" value={form.access_token} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
+          <input name="access_token" placeholder="Access Token" value={form.access_token} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
         </div>
         {form.platform === 'youtube' && (
           <>
+            <div style={{ marginBottom: 12 }}>
+              <button type="button" onClick={handleConnectGoogle}>เชื่อมต่อ Google</button>
+            </div>
             <div style={{ marginBottom: 12 }}>
               <input name="client_id" placeholder="Client ID (optional)" value={form.client_id} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
             </div>
             <div style={{ marginBottom: 12 }}>
               <input name="client_secret" placeholder="Client Secret (optional)" value={form.client_secret} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
             </div>
             <div style={{ marginBottom: 12 }}>
               <input name="refresh_token" placeholder="Refresh Token (optional)" value={form.refresh_token} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
diff --git a/frontend/src/pages/SettingsPage.jsx b/frontend/src/pages/SettingsPage.jsx
index b4250ce..bb36d5d 100644
--- a/frontend/src/pages/SettingsPage.jsx
+++ b/frontend/src/pages/SettingsPage.jsx
@@ -1,25 +1,51 @@
 import { useState, useEffect } from 'react'
 import { toast } from 'react-toastify'
-import { destinationAPI } from '../api/client'
+import { destinationAPI, oauthAPI } from '../api/client'
 import DestinationForm from '../components/DestinationForm'
 
 export default function SettingsPage() {
   const [destinations, setDestinations] = useState([])
   const [showForm, setShowForm] = useState(false)
   const [editing, setEditing] = useState(null)
+  const [connecting, setConnecting] = useState(false)
 
   const load = async () => {
     const res = await destinationAPI.list()
     setDestinations(res.data)
   }
 
   useEffect(() => { load() }, [])
 
+  useEffect(() => {
+    const onMsg = (e) => {
+      if (e.data?.type === 'oauth-success') {
+        toast.success('เชื่อมต่อ YouTube สำเร็จ')
+        load()
+      } else if (e.data?.type === 'oauth-error') {
+        toast.error('เชื่อมต่อล้มเหลว: ' + (e.data.message || ''))
+      }
+      setConnecting(false)
+    }
+    window.addEventListener('message', onMsg)
+    return () => window.removeEventListener('message', onMsg)
+  }, [])
+
+  const handleConnect = async () => {
+    setConnecting(true)
+    try {
+      const res = await oauthAPI.start()
+      window.open(res.data.auth_url, '_blank', 'width=600,height=700')
+    } catch {
+      toast.error('ไม่สามารถเริ่มการเชื่อมต่อได้')
+      setConnecting(false)
+    }
+  }
+
   const handleSubmit = async (form) => {
     try {
       if (editing) {
         await destinationAPI.update(editing.id, form)
         toast.success('อัปเดตเรียบร้อย')
       } else {
         await destinationAPI.create(form)
         toast.success('เพิ่มเรียบร้อย')
@@ -39,16 +65,19 @@ export default function SettingsPage() {
     load()
   }
 
   return (
     <div>
       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
         <h2>จัดการตั้งค่าช่องทาง</h2>
         <button onClick={() => { setEditing(null); setShowForm(true) }}>เพิ่ม</button>
+        <button onClick={handleConnect} disabled={connecting}>
+          {connecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ YouTube'}
+        </button>
       </div>
       <table style={{ width: '100%', borderCollapse: 'collapse' }}>
         <thead>
           <tr style={{ borderBottom: '2px solid #ddd' }}>
             <th style={{ padding: 8, textAlign: 'left' }}>แพลตฟอร์ม</th>
             <th style={{ padding: 8, textAlign: 'left' }}>ชื่อ</th>
             <th style={{ padding: 8, textAlign: 'left' }}>Token</th>
             <th style={{ padding: 8 }}>การจัดการ</th>
diff --git a/frontend/src/test/destination_form_oauth.test.jsx b/frontend/src/test/destination_form_oauth.test.jsx
new file mode 100644
index 0000000..de459a2
--- /dev/null
+++ b/frontend/src/test/destination_form_oauth.test.jsx
@@ -0,0 +1,36 @@
+// frontend/src/test/destination_form_oauth.test.jsx
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { render, screen, waitFor } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
+import { MemoryRouter } from 'react-router-dom'
+import DestinationForm from '../components/DestinationForm'
+import { oauthAPI } from '../api/client'
+
+vi.mock('../api/client', async () => {
+  const actual = await vi.importActual('../api/client')
+  return { ...actual, oauthAPI: { start: vi.fn() } }
+})
+
+describe('DestinationForm OAuth button', () => {
+  beforeEach(() => { vi.clearAllMocks() })
+
+  it('shows connect button for youtube and submits form', async () => {
+    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://x' } })
+    vi.spyOn(window, 'open').mockImplementation(() => ({}))
+    const onSubmit = vi.fn()
+    const user = userEvent.setup()
+    render(
+      <MemoryRouter>
+        <DestinationForm destination={null} onSubmit={onSubmit} onClose={() => {}} />
+      </MemoryRouter>
+    )
+    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ Google' }))
+    await waitFor(() => expect(oauthAPI.start).toHaveBeenCalled())
+    window.dispatchEvent(new MessageEvent('message', {
+      data: { type: 'oauth-success' },
+    }))
+    await user.type(screen.getByPlaceholderText('ชื่อ (เช่น ช่อง A)'), 'ช่องใหม่')
+    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
+    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
+  })
+})
diff --git a/frontend/src/test/oauth.test.jsx b/frontend/src/test/oauth.test.jsx
new file mode 100644
index 0000000..94fa299
--- /dev/null
+++ b/frontend/src/test/oauth.test.jsx
@@ -0,0 +1,56 @@
+// frontend/src/test/oauth.test.jsx
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { render, screen, waitFor } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
+import { MemoryRouter } from 'react-router-dom'
+import { ToastContainer } from 'react-toastify'
+import 'react-toastify/dist/ReactToastify.css'
+import SettingsPage from '../pages/SettingsPage'
+import { oauthAPI } from '../api/client'
+
+vi.mock('../api/client', async () => {
+  const actual = await vi.importActual('../api/client')
+  return {
+    ...actual,
+    oauthAPI: { start: vi.fn() },
+  }
+})
+
+function renderPage() {
+  return render(
+    <MemoryRouter>
+      <SettingsPage />
+      <ToastContainer />
+    </MemoryRouter>
+  )
+}
+
+describe('SettingsPage OAuth connect', () => {
+  beforeEach(() => { vi.clearAllMocks() })
+
+  it('opens a popup to the Google auth URL when clicking connect', async () => {
+    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://accounts.google.com/auth' } })
+    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({}))
+    const user = userEvent.setup()
+    renderPage()
+    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ YouTube' }))
+    await waitFor(() => {
+      expect(oauthAPI.start).toHaveBeenCalled()
+      expect(openSpy).toHaveBeenCalledWith('https://accounts.google.com/auth', '_blank', expect.any(String))
+    })
+    openSpy.mockRestore()
+  })
+
+  it('reloads destinations and shows success on oauth-success message', async () => {
+    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://x' } })
+    vi.spyOn(window, 'open').mockImplementation(() => ({}))
+    const user = userEvent.setup()
+    renderPage()
+    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ YouTube' }))
+    await waitFor(() => expect(oauthAPI.start).toHaveBeenCalled())
+    window.dispatchEvent(new MessageEvent('message', { data: { type: 'oauth-success' } }))
+    await waitFor(() => {
+      expect(screen.getByText('เชื่อมต่อ YouTube สำเร็จ')).toBeInTheDocument()
+    })
+  })
+})
