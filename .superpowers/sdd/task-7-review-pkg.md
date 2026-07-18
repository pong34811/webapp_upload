225bcb3 docs: document YouTube OAuth setup; verify token refresh on upload

 README.md                                  |  9 +++++++++
 backend/tests/test_process_upload_oauth.py | 27 +++++++++++++++++++++++++++
 2 files changed, 36 insertions(+)

diff --git a/README.md b/README.md
index 2a27c5c..265aa2e 100644
--- a/README.md
+++ b/README.md
@@ -50,10 +50,19 @@ npm run dev
 3. เปิด http://localhost:8000 — SPA จะถูกเสิร์ฟจาก Django โดยตรง
 
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
