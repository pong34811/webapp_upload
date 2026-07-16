# Web Upload — แผน Implement

> **สำหรับ agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development หรือ superpowers:executing-plans เพื่อ implement plan นี้ทีละ task

**Goal:** สร้างเว็บแอปอัปโหลดคลิปวิดีโอไป YouTube/Facebook Page สำหรับ Admin คนเดียว

**Architecture:** Django REST API + React SPA แยกกัน Frontend คุยกับ Backend ผ่าน REST API

**Tech Stack:** Django, DRF, SQLite, Vite, React, google-api-python-client, requests

---

## โครงสร้างไฟล์ทั้งหมด

```
web_upload/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── core/
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   └── urls.py
│   ├── uploads/
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── admin.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── youtube.py
│   │       └── facebook.py
│   └── tests/
│       ├── __init__.py
│       ├── test_models.py
│       └── test_views.py
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── client.js
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── Navbar.jsx
│       │   ├── ProgressBar.jsx
│       │   └── DestinationForm.jsx
│       └── pages/
│           ├── LoginPage.jsx
│           ├── UploadPage.jsx
│           ├── SettingsPage.jsx
│           └── HistoryPage.jsx
└── README.md
```

---

## Task 1: สร้าง Django Project

**Files:**
- Create: `backend/manage.py`, `backend/requirements.txt`, `backend/core/__init__.py`, `backend/core/settings.py`, `backend/core/urls.py`

- [ ] สร้างไฟล์ `backend/requirements.txt`

```
django>=4.2,<5.0
djangorestframework>=3.14
django-cors-headers>=4.3
google-api-python-client>=2.100
requests>=2.31
```

- [ ] สร้าง `backend/manage.py`

```python
#!/usr/bin/env python
import os
import sys

def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()
```

- [ ] สร้าง `backend/core/__init__.py` (ว่าง)

- [ ] สร้าง `backend/core/settings.py`

```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "dev-secret-key-change-in-production"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "uploads",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "th"
TIME_ZONE = "Asia/Bangkok"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

UPLOAD_DIR = BASE_DIR / "media" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm"]
MAX_UPLOAD_SIZE_MB = 5000
```

- [ ] สร้าง `backend/core/urls.py`

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("django.contrib.auth.urls")),
    path("api/", include("uploads.urls")),
]
```

- [ ] รัน migrate เพื่อตรวจสอบว่าตั้งค่าถูกต้อง

Run: `cd backend; python manage.py migrate`
Expected: สำเร็จ ไม่มี error

- [ ] Commit

```bash
git add backend/
git commit -m "feat: setup django project with settings"
```

---

## Task 2: สร้างโมเดล (Destination, UploadJob)

**Files:**
- Create: `backend/uploads/__init__.py`, `backend/uploads/apps.py`, `backend/uploads/models.py`, `backend/uploads/admin.py`
- Test: `backend/tests/__init__.py`, `backend/tests/test_models.py`

- [ ] สร้าง `backend/uploads/__init__.py` (ว่าง)

- [ ] สร้าง `backend/uploads/apps.py`

```python
from django.apps import AppConfig

class UploadsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "uploads"
```

- [ ] สร้าง `backend/uploads/models.py`

```python
from django.db import models
from django.contrib.auth.models import User


class Destination(models.Model):
    PLATFORM_CHOICES = [
        ("youtube", "YouTube"),
        ("facebook", "Facebook"),
    ]
    platform = models.CharField(max_length=10, choices=PLATFORM_CHOICES)
    name = models.CharField(max_length=255)
    access_token = models.TextField()
    page_id = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="destinations_created")
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="destinations_updated")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.platform}: {self.name}"


class UploadJob(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("uploading", "Uploading"),
        ("success", "Success"),
        ("failed", "Failed"),
        ("scheduled", "Scheduled"),
    ]
    PRIVACY_CHOICES = [
        ("public", "Public"),
        ("private", "Private"),
        ("unlisted", "Unlisted"),
    ]
    destination = models.ForeignKey(Destination, on_delete=models.CASCADE, related_name="upload_jobs")
    filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    tags = models.TextField(blank=True, default="")
    privacy = models.CharField(max_length=10, choices=PRIVACY_CHOICES, default="private")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    progress = models.IntegerField(default=0)
    scheduled_time = models.DateTimeField(null=True, blank=True)
    platform_video_id = models.CharField(max_length=255, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="uploads_created")
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="uploads_updated")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} → {self.destination}"
```

- [ ] สร้าง `backend/uploads/admin.py`

```python
from django.contrib import admin
from .models import Destination, UploadJob

admin.site.register(Destination)
admin.site.register(UploadJob)
```

- [ ] สร้าง `backend/tests/__init__.py` (ว่าง)

- [ ] สร้าง `backend/tests/test_models.py`

```python
from django.test import TestCase
from django.contrib.auth.models import User
from uploads.models import Destination, UploadJob


class DestinationModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")

    def test_create_destination(self):
        dest = Destination.objects.create(
            platform="youtube",
            name="Test Channel",
            access_token="tok_abc",
            created_by=self.user,
            updated_by=self.user,
        )
        self.assertEqual(dest.platform, "youtube")
        self.assertTrue(dest.is_active)

    def test_soft_delete(self):
        dest = Destination.objects.create(
            platform="facebook",
            name="Test Page",
            access_token="tok_fb",
            created_by=self.user,
            updated_by=self.user,
        )
        dest.is_active = False
        dest.save()
        dest.refresh_from_db()
        self.assertFalse(dest.is_active)


class UploadJobModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")
        self.dest = Destination.objects.create(
            platform="youtube",
            name="Ch A",
            access_token="tok",
            created_by=self.user,
            updated_by=self.user,
        )

    def test_create_job(self):
        job = UploadJob.objects.create(
            destination=self.dest,
            filename="test.mp4",
            file_path="/tmp/test.mp4",
            title="My Video",
            status="pending",
            created_by=self.user,
            updated_by=self.user,
        )
        self.assertEqual(job.status, "pending")
        self.assertEqual(job.progress, 0)
```

- [ ] รัน test

Run: `cd backend; python manage.py test tests -v 2`
Expected: 3 tests PASS

- [ ] Commit

```bash
git add backend/uploads/ backend/tests/
git commit -m "feat: add Destination and UploadJob models"
```

---

## Task 3: Serializers

**Files:**
- Create: `backend/uploads/serializers.py`

- [ ] สร้าง `backend/uploads/serializers.py`

```python
from rest_framework import serializers
from .models import Destination, UploadJob


class DestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = ["id", "platform", "name", "access_token", "page_id", "is_active",
                  "created_by", "updated_by", "created_at", "updated_at"]
        read_only_fields = ["created_by", "updated_by", "created_at", "updated_at"]


class UploadJobSerializer(serializers.ModelSerializer):
    destination_name = serializers.CharField(source="destination.name", read_only=True)

    class Meta:
        model = UploadJob
        fields = ["id", "destination", "destination_name", "filename", "title",
                  "description", "tags", "privacy", "status", "progress",
                  "scheduled_time", "platform_video_id", "error_message",
                  "is_active", "created_by", "updated_by", "created_at", "updated_at"]
        read_only_fields = ["status", "progress", "platform_video_id", "error_message",
                            "created_by", "updated_by", "created_at", "updated_at"]


class UploadCreateSerializer(serializers.Serializer):
    destination_id = serializers.IntegerField()
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, default="")
    tags = serializers.CharField(required=False, default="")
    privacy = serializers.ChoiceField(choices=UploadJob.PRIVACY_CHOICES, default="private")
    scheduled_time = serializers.DateTimeField(required=False, allow_null=True)
```

- [ ] Commit

```bash
git add backend/uploads/serializers.py
git commit -m "feat: add DRF serializers for Destination and UploadJob"
```

---

## Task 4: Views + URLs (CRUD Destinations)

**Files:**
- Create: `backend/uploads/views.py`, `backend/uploads/urls.py`

- [ ] สร้าง `backend/uploads/views.py`

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from .models import Destination, UploadJob
from .serializers import DestinationSerializer, UploadJobSerializer, UploadCreateSerializer


@api_view(["POST"])
@permission_classes([AllowAny])
def api_login(request):
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return Response({"message": "ok", "username": user.username})
    return Response({"error": "用户名或密码错误"}, status=400)


@api_view(["POST"])
def api_logout(request):
    logout(request)
    return Response({"message": "ok"})


@api_view(["GET"])
def api_me(request):
    return Response({"username": request.user.username})


class DestinationViewSet(viewsets.ModelViewSet):
    serializer_class = DestinationSerializer

    def get_queryset(self):
        return Destination.objects.filter(is_active=True)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        dest = self.get_object()
        dest.is_active = False
        dest.updated_by = request.user
        dest.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UploadJobViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UploadJobSerializer

    def get_queryset(self):
        return UploadJob.objects.all().order_by("-created_at")

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        job = self.get_object()
        if job.status in ("pending", "uploading"):
            job.status = "failed"
            job.error_message = "取消上传"
            job.save()
            return Response({"message": "已取消"})
        return Response({"error": "无法取消"}, status=400)
```

- [ ] สร้าง `backend/uploads/urls.py`

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("destinations", views.DestinationViewSet, basename="destination")
router.register("uploads", views.UploadJobViewSet, basename="upload")

urlpatterns = [
    path("auth/login/", views.api_login, name="api_login"),
    path("auth/logout/", views.api_logout, name="api_logout"),
    path("auth/me/", views.api_me, name="api_me"),
    path("", include(router.urls)),
]
```

- [ ] รัน server ทดสอบ

Run: `cd backend; python manage.py runserver`
Expected: server ขึ้น port 8000 ไม่มี error

- [ ] Commit

```bash
git add backend/uploads/views.py backend/uploads/urls.py
git commit -m "feat: add views and URL routing for auth, destinations, uploads"
```

---

## Task 5: YouTube Upload Service

**Files:**
- Create: `backend/uploads/services/__init__.py`, `backend/uploads/services/youtube.py`

- [ ] สร้าง `backend/uploads/services/__init__.py` (ว่าง)

- [ ] สร้าง `backend/uploads/services/youtube.py`

```python
import os
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2.credentials import Credentials


def upload_to_youtube(file_path, title, description, tags, privacy, access_token, scheduled_time=None):
    credentials = Credentials(token=access_token)
    youtube = build("youtube", "v3", credentials=credentials)

    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": [t.strip() for t in tags.split(",") if t.strip()],
        },
        "status": {
            "privacyStatus": "private" if scheduled_time else privacy,
        },
    }

    if scheduled_time:
        from django.utils import timezone
        import datetime
        body["status"]["privacyStatus"] = "private"
        body["status"]["publishAt"] = scheduled_time.isoformat()

    media = MediaFileUpload(file_path, mimetype="video/mp4", resumable=True)

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    response = None
    while response is None:
        status_info, response = request.next_chunk()

    return response["id"]
```

- [ ] Commit

```bash
git add backend/uploads/services/
git commit -m "feat: add YouTube upload service with resumable upload"
```

---

## Task 6: Facebook Upload Service

**Files:**
- Create: `backend/uploads/services/facebook.py`

- [ ] สร้าง `backend/uploads/services/facebook.py`

```python
import os
import requests

GRAPH_API_URL = "https://graph.facebook.com/v19.0"


def upload_to_facebook(file_path, title, description, access_token, page_id, scheduled_time=None):
    session_url = f"{GRAPH_API_URL}/{page_id}/videos"
    chunk_size = 1024 * 1024 * 4  # 4MB

    file_size = os.path.getsize(file_path)

    resp = requests.post(session_url, data={
        "upload_phase": "start",
        "access_token": access_token,
        "file_size": file_size,
    })
    resp.raise_for_status()
    session = resp.json()
    upload_session_id = session["upload_session_id"]

    offset = 0
    with open(file_path, "rb") as f:
        while offset < file_size:
            chunk = f.read(chunk_size)
            requests.post(session_url, data={
                "upload_phase": "transfer",
                "access_token": access_token,
                "upload_session_id": upload_session_id,
                "start_offset": offset,
            }, files={"video_file_chunk": chunk})
            offset += len(chunk)

    finish_data = {
        "upload_phase": "finish",
        "access_token": access_token,
        "upload_session_id": upload_session_id,
        "title": title,
        "description": description,
    }

    if scheduled_time:
        import calendar
        finish_data["scheduled_publish_time"] = int(scheduled_time.timestamp())

    resp = requests.post(session_url, data=finish_data)
    resp.raise_for_status()
    return resp.json().get("id", "")
```

- [ ] Commit

```bash
git add backend/uploads/services/facebook.py
git commit -m "feat: add Facebook Graph API upload service"
```

---

## Task 7: Upload Processing View (รับไฟล์ → อัปโหลดไป YT/FB)

**Files:**
- Modify: `backend/uploads/views.py`

- [ ] เพิ่ม `UploadViewSet` ใน `backend/uploads/views.py`

```python
import os
import threading
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import Destination, UploadJob
from .serializers import UploadJobSerializer, UploadCreateSerializer
from .services.youtube import upload_to_youtube
from .services.facebook import upload_to_facebook


class UploadViewSet(viewsets.ModelViewSet):
    serializer_class = UploadJobSerializer

    def get_queryset(self):
        return UploadJob.objects.all().order_by("-created_at")

    def create(self, request):
        serializer = UploadCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        dest = Destination.objects.filter(id=data["destination_id"], is_active=True).first()
        if not dest:
            return Response({"error": "找不到指定的上传目标"}, status=400)

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "未选择文件"}, status=400)

        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext not in settings.ALLOWED_VIDEO_EXTENSIONS:
            return Response({"error": f"不支持的文件格式: {ext}"}, status=400)

        if uploaded_file.size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            return Response({"error": "文件太大"}, status=400)

        save_path = settings.UPLOAD_DIR / uploaded_file.name
        with open(save_path, "wb+") as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)

        job = UploadJob.objects.create(
            destination=dest,
            filename=uploaded_file.name,
            file_path=str(save_path),
            title=data["title"],
            description=data.get("description", ""),
            tags=data.get("tags", ""),
            privacy=data.get("privacy", "private"),
            scheduled_time=data.get("scheduled_time"),
            status="uploading",
            created_by=request.user,
            updated_by=request.user,
        )

        thread = threading.Thread(target=_process_upload, args=(job.id,))
        thread.start()

        return Response(UploadJobSerializer(job).data, status=201)


def _process_upload(job_id):
    from django.db import transaction
    try:
        job = UploadJob.objects.select_for_update().get(id=job_id)
        with transaction.atomic():
            dest = job.destination
            if dest.platform == "youtube":
                video_id = upload_to_youtube(
                    job.file_path, job.title, job.description, job.tags,
                    job.privacy, dest.access_token, job.scheduled_time,
                )
            elif dest.platform == "facebook":
                video_id = upload_to_facebook(
                    job.file_path, job.title, job.description,
                    dest.access_token, dest.page_id, job.scheduled_time,
                )
            else:
                raise ValueError(f"未知平台: {dest.platform}")

            job.platform_video_id = video_id
            job.status = "success"
            job.progress = 100
            job.save()
    except Exception as e:
        job = UploadJob.objects.get(id=job_id)
        job.status = "failed"
        job.error_message = str(e)
        job.save()
    finally:
        if os.path.exists(job.file_path):
            os.remove(job.file_path)
```

- [ ] อัปเดต `backend/uploads/urls.py` — เพิ่ม UploadViewSet

```python
router.register("uploads", views.UploadViewSet, basename="upload")
```

(ลบ UploadJobViewSet เดิมออก ใช้ UploadViewSet แทน)

- [ ] Commit

```bash
git add backend/uploads/views.py backend/uploads/urls.py
git commit -m "feat: add upload processing with YouTube/Facebook services"
```

---

## Task 8: Frontend Setup (Vite + React)

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`, `frontend/src/main.jsx`, `frontend/src/App.jsx`

- [ ] รันคำสั่งสร้าง project

Run: `cd frontend; npm create vite@latest . -- --template react`

- [ ] ติดตั้ง dependencies

Run: `cd frontend; npm install axios react-router-dom react-toastify`

- [ ] แก้ไข `frontend/vite.config.js`

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

- [ ] สร้าง `frontend/src/App.jsx`

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import UploadPage from './pages/UploadPage'
import SettingsPage from './pages/SettingsPage'
import HistoryPage from './pages/HistoryPage'

function App() {
  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<UploadPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

- [ ] แก้ไข `frontend/src/main.jsx`

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] Commit

```bash
git add frontend/
git commit -m "feat: setup Vite + React frontend with routing"
```

---

## Task 9: API Client (Axios)

**Files:**
- Create: `frontend/src/api/client.js`

- [ ] สร้าง `frontend/src/api/client.js`

```javascript
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 403 || err.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  login: (username, password) => api.post('/auth/login/', { username, password }),
  logout: () => api.post('/auth/logout/'),
  me: () => api.get('/auth/me/'),
}

export const destinationAPI = {
  list: () => api.get('/destinations/'),
  create: (data) => api.post('/destinations/', data),
  update: (id, data) => api.put(`/destinations/${id}/`, data),
  remove: (id) => api.delete(`/destinations/${id}/`),
}

export const uploadAPI = {
  create: (formData, onProgress) =>
    api.post('/uploads/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 30))
        }
      },
    }),
  list: () => api.get('/uploads/'),
  get: (id) => api.get(`/uploads/${id}/`),
  cancel: (id) => api.post(`/uploads/${id}/cancel/`),
}

export default api
```

- [ ] Commit

```bash
git add frontend/src/api/
git commit -m "feat: add axios API client with auth interceptor"
```

---

## Task 10: Login Page

**Files:**
- Create: `frontend/src/pages/LoginPage.jsx`

- [ ] สร้าง `frontend/src/pages/LoginPage.jsx`

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { authAPI } from '../api/client'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authAPI.login(username, password)
      toast.success('登录成功')
      navigate('/')
    } catch {
      toast.error('用户名或密码错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 20 }}>
      <h2>管理员登录</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] Commit

```bash
git add frontend/src/pages/LoginPage.jsx
git commit -m "feat: add admin login page"
```

---

## Task 11: Layout + Navbar

**Files:**
- Create: `frontend/src/components/Layout.jsx`, `frontend/src/components/Navbar.jsx`

- [ ] สร้าง `frontend/src/components/Navbar.jsx`

```jsx
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api/client'
import { toast } from 'react-toastify'

export default function Navbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await authAPI.logout()
    toast.success('已退出')
    navigate('/login')
  }

  return (
    <nav style={{ display: 'flex', gap: 20, padding: '12px 20px', background: '#1a1a2e', color: '#fff' }}>
      <Link to="/" style={{ color: '#fff', textDecoration: 'none' }}>上传</Link>
      <Link to="/history" style={{ color: '#fff', textDecoration: 'none' }}>历史</Link>
      <Link to="/settings" style={{ color: '#fff', textDecoration: 'none' }}>设置</Link>
      <button onClick={handleLogout} style={{ marginLeft: 'auto', background: 'none', color: '#fff', border: '1px solid #fff', padding: '4px 12px', cursor: 'pointer' }}>
        退出
      </button>
    </nav>
  )
}
```

- [ ] สร้าง `frontend/src/components/Layout.jsx`

```jsx
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div>
      <Navbar />
      <div style={{ padding: 20 }}>
        <Outlet />
      </div>
    </div>
  )
}
```

- [ ] Commit

```bash
git add frontend/src/components/
git commit -m "feat: add Layout and Navbar components"
```

---

## Task 12: Settings Page (จัดการ Destinations)

**Files:**
- Create: `frontend/src/components/DestinationForm.jsx`, `frontend/src/pages/SettingsPage.jsx`

- [ ] สร้าง `frontend/src/components/DestinationForm.jsx`

```jsx
import { useState, useEffect } from 'react'

export default function DestinationForm({ destination, onSubmit, onClose }) {
  const [form, setForm] = useState({
    platform: 'youtube',
    name: '',
    access_token: '',
    page_id: '',
  })

  useEffect(() => {
    if (destination) {
      setForm({
        platform: destination.platform,
        name: destination.name,
        access_token: destination.access_token,
        page_id: destination.page_id || '',
      })
    }
  }, [destination])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 24, borderRadius: 8, width: 400 }}>
        <h3>{destination ? '编辑目标' : '添加目标'}</h3>
        <div style={{ marginBottom: 12 }}>
          <select name="platform" value={form.platform} onChange={handleChange} style={{ width: '100%', padding: 8 }}>
            <option value="youtube">YouTube</option>
            <option value="facebook">Facebook</option>
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <input name="name" placeholder="名称（如：频道A）" value={form.name} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input name="access_token" placeholder="Access Token" value={form.access_token} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
        </div>
        {form.platform === 'facebook' && (
          <div style={{ marginBottom: 12 }}>
            <input name="page_id" placeholder="Page ID" value={form.page_id} onChange={handleChange} style={{ width: '100%', padding: 8 }} required />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" style={{ flex: 1, padding: 8 }}>保存</button>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 8 }}>取消</button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] สร้าง `frontend/src/pages/SettingsPage.jsx`

```jsx
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { destinationAPI } from '../api/client'
import DestinationForm from '../components/DestinationForm'

export default function SettingsPage() {
  const [destinations, setDestinations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    const res = await destinationAPI.list()
    setDestinations(res.data)
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (form) => {
    try {
      if (editing) {
        await destinationAPI.update(editing.id, form)
        toast.success('已更新')
      } else {
        await destinationAPI.create(form)
        toast.success('已添加')
      }
      setShowForm(false)
      setEditing(null)
      load()
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定停用？')) return
    await destinationAPI.remove(id)
    toast.success('已停用')
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>上传目标管理</h2>
        <button onClick={() => { setEditing(null); setShowForm(true) }}>添加</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: 8, textAlign: 'left' }}>平台</th>
            <th style={{ padding: 8, textAlign: 'left' }}>名称</th>
            <th style={{ padding: 8, textAlign: 'left' }}>Token</th>
            <th style={{ padding: 8 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {destinations.map((d) => (
            <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{d.platform}</td>
              <td style={{ padding: 8 }}>{d.name}</td>
              <td style={{ padding: 8 }}>{d.access_token.slice(0, 20)}...</td>
              <td style={{ padding: 8, textAlign: 'center' }}>
                <button onClick={() => { setEditing(d); setShowForm(true) }} style={{ marginRight: 8 }}>编辑</button>
                <button onClick={() => handleDelete(d.id)}>停用</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showForm && <DestinationForm destination={editing} onSubmit={handleSubmit} onClose={() => { setShowForm(false); setEditing(null) }} />}
    </div>
  )
}
```

- [ ] Commit

```bash
git add frontend/src/components/DestinationForm.jsx frontend/src/pages/SettingsPage.jsx
git commit -m "feat: add Settings page with Destination CRUD"
```

---

## Task 13: Upload Page + Progress Bar

**Files:**
- Create: `frontend/src/components/ProgressBar.jsx`, `frontend/src/pages/UploadPage.jsx`

- [ ] สร้าง `frontend/src/components/ProgressBar.jsx`

```jsx
export default function ProgressBar({ percent }) {
  return (
    <div style={{ width: '100%', background: '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
      <div
        style={{
          width: `${percent}%`,
          background: '#4caf50',
          height: 24,
          textAlign: 'center',
          color: '#fff',
          lineHeight: '24px',
          fontSize: 12,
          transition: 'width 0.3s',
        }}
      >
        {percent}%
      </div>
    </div>
  )
}
```

- [ ] สร้าง `frontend/src/pages/UploadPage.jsx`

```jsx
import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { destinationAPI, uploadAPI } from '../api/client'
import ProgressBar from '../components/ProgressBar'

export default function UploadPage() {
  const [destinations, setDestinations] = useState([])
  const [destinationId, setDestinationId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [privacy, setPrivacy] = useState('private')
  const [scheduledTime, setScheduledTime] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [jobStatus, setJobStatus] = useState('')
  const [jobId, setJobId] = useState(null)
  const pollingRef = useRef(null)

  useEffect(() => {
    destinationAPI.list().then((res) => setDestinations(res.data))
  }, [])

  useEffect(() => {
    if (jobId && (jobStatus === 'uploading' || jobStatus === 'pending')) {
      pollingRef.current = setInterval(async () => {
        const res = await uploadAPI.get(jobId)
        setProgress(res.data.progress)
        setJobStatus(res.data.status)
        if (res.data.status === 'success') {
          clearInterval(pollingRef.current)
          toast.success('上传成功')
          setUploading(false)
        } else if (res.data.status === 'failed') {
          clearInterval(pollingRef.current)
          toast.error(res.data.error_message || '上传失败')
          setUploading(false)
        }
      }, 1500)
    }
    return () => clearInterval(pollingRef.current)
  }, [jobId, jobStatus])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !destinationId || !title) {
      toast.error('请填写必要信息')
      return
    }
    setUploading(true)
    setProgress(0)
    setJobStatus('uploading')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('destination_id', destinationId)
    formData.append('title', title)
    formData.append('description', description)
    formData.append('tags', tags)
    formData.append('privacy', privacy)
    if (scheduledTime) formData.append('scheduled_time', scheduledTime)

    try {
      const res = await uploadAPI.create(formData, (p) => setProgress(p))
      setJobId(res.data.id)
      setJobStatus(res.data.status)
    } catch (err) {
      toast.error(err.response?.data?.error || '上传失败')
      setUploading(false)
    }
  }

  const handleCancel = async () => {
    if (jobId) {
      await uploadAPI.cancel(jobId)
      toast.success('已取消')
      setUploading(false)
      setJobStatus('')
      setProgress(0)
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2>上传视频</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} style={{ width: '100%', padding: 8 }} required>
            <option value="">选择上传目标</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>{d.platform} - {d.name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <input type="file" accept=".mp4,.mov,.avi,.mkv,.webm" onChange={(e) => setFile(e.target.files[0])} style={{ width: '100%', padding: 8 }} required />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 8 }} required />
        </div>
        <div style={{ marginBottom: 12 }}>
          <textarea placeholder="描述" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', padding: 8, height: 80 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input placeholder="标签（逗号分隔）" value={tags} onChange={(e) => setTags(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <select value={privacy} onChange={(e) => setPrivacy(e.target.value)} style={{ width: '100%', padding: 8 }}>
            <option value="public">公开</option>
            <option value="private">私密</option>
            <option value="unlisted">不公开</option>
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <input type="datetime-local" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} style={{ width: '100%', padding: 8 }} />
          <small style={{ color: '#666' }}> 留空则立即上传</small>
        </div>

        {uploading && (
          <div style={{ marginBottom: 12 }}>
            <ProgressBar percent={progress} />
            <button type="button" onClick={handleCancel} style={{ marginTop: 8, background: '#f44336', color: '#fff', border: 'none', padding: '6px 16px', cursor: 'pointer' }}>
              取消上传
            </button>
          </div>
        )}

        <button type="submit" disabled={uploading} style={{ width: '100%', padding: 10, background: uploading ? '#ccc' : '#4caf50', color: '#fff', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer' }}>
          {uploading ? '上传中...' : '开始上传'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] Commit

```bash
git add frontend/src/components/ProgressBar.jsx frontend/src/pages/UploadPage.jsx
git commit -m "feat: add Upload page with progress bar and polling"
```

---

## Task 14: History Page

**Files:**
- Create: `frontend/src/pages/HistoryPage.jsx`

- [ ] สร้าง `frontend/src/pages/HistoryPage.jsx`

```jsx
import { useState, useEffect } from 'react'
import { uploadAPI } from '../api/client'

const STATUS_LABEL = {
  pending: '等待中',
  uploading: '上传中',
  success: '成功',
  failed: '失败',
  scheduled: '已定时',
}

const STATUS_COLOR = {
  pending: '#ff9800',
  uploading: '#2196f3',
  success: '#4caf50',
  failed: '#f44336',
  scheduled: '#9c27b0',
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    uploadAPI.list().then((res) => setJobs(res.data))
  }, [])

  return (
    <div>
      <h2>上传历史</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: 8, textAlign: 'left' }}>标题</th>
            <th style={{ padding: 8, textAlign: 'left' }}>目标</th>
            <th style={{ padding: 8, textAlign: 'left' }}>状态</th>
            <th style={{ padding: 8, textAlign: 'left' }}>进度</th>
            <th style={{ padding: 8, textAlign: 'left' }}>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{job.title}</td>
              <td style={{ padding: 8 }}>{job.destination_name}</td>
              <td style={{ padding: 8 }}>
                <span style={{ color: STATUS_COLOR[job.status], fontWeight: 'bold' }}>
                  {STATUS_LABEL[job.status]}
                </span>
              </td>
              <td style={{ padding: 8 }}>{job.progress}%</td>
              <td style={{ padding: 8 }}>{new Date(job.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] Commit

```bash
git add frontend/src/pages/HistoryPage.jsx
git commit -m "feat: add Upload History page"
```

---

## Task 15: Backend Tests

**Files:**
- Create: `backend/tests/test_views.py`

- [ ] สร้าง `backend/tests/test_views.py`

```python
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from uploads.models import Destination, UploadJob


class AuthTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="admin", password="pass1234")

    def test_login_success(self):
        res = self.client.post("/api/auth/login/", {"username": "admin", "password": "pass1234"})
        self.assertEqual(res.status_code, 200)

    def test_login_fail(self):
        res = self.client.post("/api/auth/login/", {"username": "admin", "password": "wrong"})
        self.assertEqual(res.status_code, 400)


class DestinationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="admin", password="pass1234")
        self.client.force_authenticate(user=self.user)

    def test_create_destination(self):
        res = self.client.post("/api/destinations/", {
            "platform": "youtube",
            "name": "Ch A",
            "access_token": "tok123",
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Destination.objects.count(), 1)

    def test_list_destinations(self):
        Destination.objects.create(platform="youtube", name="Ch A", access_token="tok", created_by=self.user, updated_by=self.user)
        res = self.client.get("/api/destinations/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_soft_delete(self):
        dest = Destination.objects.create(platform="youtube", name="Ch A", access_token="tok", created_by=self.user, updated_by=self.user)
        res = self.client.delete(f"/api/destinations/{dest.id}/")
        self.assertEqual(res.status_code, 204)
        dest.refresh_from_db()
        self.assertFalse(dest.is_active)


class UploadJobTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="admin", password="pass1234")
        self.client.force_authenticate(user=self.user)
        self.dest = Destination.objects.create(platform="youtube", name="Ch A", access_token="tok", created_by=self.user, updated_by=self.user)

    def test_list_uploads(self):
        UploadJob.objects.create(destination=self.dest, filename="v.mp4", file_path="/tmp/v.mp4", title="V", created_by=self.user, updated_by=self.user)
        res = self.client.get("/api/uploads/")
        self.assertEqual(res.status_code, 200)

    def test_cancel_upload(self):
        job = UploadJob.objects.create(destination=self.dest, filename="v.mp4", file_path="/tmp/v.mp4", title="V", status="uploading", created_by=self.user, updated_by=self.user)
        res = self.client.post(f"/api/uploads/{job.id}/cancel/")
        self.assertEqual(res.status_code, 200)
        job.refresh_from_db()
        self.assertEqual(job.status, "failed")
```

- [ ] รัน test ทั้งหมด

Run: `cd backend; python manage.py test tests -v 2`
Expected: ทุก test PASS

- [ ] Commit

```bash
git add backend/tests/test_views.py
git commit -m "feat: add backend API tests for auth, destinations, uploads"
```

---

## Task 16: Final Integration Test (Manual)

**Files:** (ไม่มีไฟล์ใหม่ — ทดสอบแบบ manual)

- [ ] รัน Backend

Run: `cd backend; python manage.py runserver`

- [ ] รัน Frontend

Run: `cd frontend; npm run dev`

- [ ] เปิด http://localhost:5173

- [ ] Checklist:
  1. Login สำเร็จ
  2. ไป Settings → เพิ่ม YouTube Destination (ใส่ Token จริง)
  3. ไป Upload → เลือก Destination, เลือกไฟล์, กรอกข้อมูล, กดอัปโหลด
  4. Progress Bar ทำงาน
  5. ไป History → เห็นรายการอัปโหลด
  6. ไป Settings → แก้ไข / ปิดใช้งาน Destination

- [ ] Commit README

```bash
git add README.md
git commit -m "docs: add project README"
```

---

## สรุป Task

| # | Task | สถานะ |
|---|------|-------|
| 1 | Django Project Setup | pending |
| 2 | Models (Destination, UploadJob) | pending |
| 3 | Serializers | pending |
| 4 | Views + URLs (CRUD) | pending |
| 5 | YouTube Upload Service | pending |
| 6 | Facebook Upload Service | pending |
| 7 | Upload Processing View | pending |
| 8 | Frontend Setup (Vite+React) | pending |
| 9 | API Client (Axios) | pending |
| 10 | Login Page | pending |
| 11 | Layout + Navbar | pending |
| 12 | Settings Page | pending |
| 13 | Upload Page + Progress Bar | pending |
| 14 | History Page | pending |
| 15 | Backend Tests | pending |
| 16 | Manual Integration Test | pending |
