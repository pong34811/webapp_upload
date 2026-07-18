# Task 7: Wire token refresh into upload path + end-to-end manual test

**Files:**
- Modify: `backend/uploads/views.py` `_process_upload` (verify only — `get_valid_access_token` already uses stored refresh token; do NOT change logic unless broken).
- Test: `backend/tests/test_process_upload_oauth.py` (integration-style using mocks for Google upload).
- Docs: `README.md` OAuth setup section (manual steps for Admin + Google Console).

**Interfaces:**
- Consumes: `get_valid_access_token(dest)` (existing in `token_refresh.py`); the Destination created by Task 4 now carries a real refresh_token.
- Produces: documentation of how to configure `YouTubeAppConfig` and the matching Google Cloud OAuth client (redirect URI = `http://<host>/api/oauth/youtube/callback/`).

- [ ] **Step1: Write the failing test**

```python
# backend/tests/test_process_upload_oauth.py
from unittest import mock
from django.test import TestCase
from django.contrib.auth.models import User
from uploads.models import Destination, UploadJob
from uploads import views


class ProcessUploadOAuthTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")

    def test_process_upload_refreshes_youtube_token(self):
        dest = Destination.objects.create(
            platform="youtube", name="ช่องA", access_token="old",
            refresh_token="rtok", client_id="cid", client_secret="csec",
            created_by=self.user, updated_by=self.user,
        )
        job = UploadJob.objects.create(
            destination=dest, filename="v.mp4", file_path="/tmp/v.mp4",
            title="V", created_by=self.user, updated_by=self.user,
        )
        with mock.patch("uploads.services.token_refresh.refresh_youtube_access_token", return_value="fresh_tok"), \
             mock.patch("uploads.views.upload_to_youtube", return_value="vid123"):
            views._process_upload(job.id)
        job.refresh_from_db()
        self.assertEqual(job.status, "success")
        self.assertEqual(job.platform_video_id, "vid123")
```

- [ ] **Step2: Run test to verify it passes (logic already in place)**

Run: `cd backend && python manage.py test tests.test_process_upload_oauth`
Expected: PASS — confirms the existing refresh path works with a destination created by the OAuth flow.

- [ ] **Step3: Add README OAuth setup section**

Append to `README.md`:
```markdown
## ตั้งค่า YouTube OAuth

1. ใน Google Cloud Console สร้าง OAuth 2.0 Client ID (ประเภท Web application)
2. เพิ่ม Authorized redirect URI: `http://<host>/api/oauth/youtube/callback/`
   (ตอนพัฒนาใช้ `http://localhost:8000/api/oauth/youtube/callback/`)
3. ใน Django Admin (`/admin`) เพิ่ม YouTubeAppConfig ด้วย client_id, client_secret, redirect_uri จากข้อ 2
4. ที่หน้า "จัดการตั้งค่าช่องทาง" กด "เชื่อมต่อ YouTube" และล็อกอินบัญชี Google
5. ช่องจะถูกเพิ่มพร้อม token ที่ต่ออายุอัตโนมัติ
```

- [ ] **Step4: Run full backend + frontend suites**

Run: `cd backend && python manage.py test` then `cd frontend && cmd /c "npm test"`
Expected: all pass (backend 27+, frontend 10+).

- [ ] **Step5: Commit**

```bash
git add backend/tests/test_process_upload_oauth.py README.md
git commit -m "docs: document YouTube OAuth setup; verify token refresh on upload"
```
