import os
import json
import secrets
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
from .services import youtube_oauth
from django.shortcuts import render
from .models import YouTubeAppConfig


@csrf_exempt
def api_login(request):
    if request.method != "POST":
        return JsonResponse({"error": "method not allowed"}, status=405)
    try:
        data = json.loads(request.body)
    except Exception:
        data = request.POST
    username = data.get("username")
    password = data.get("password")
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return JsonResponse({"message": "ok", "username": user.username})
    return JsonResponse({"error": "invalid credentials"}, status=400)


@csrf_exempt
def api_logout(request):
    if request.method != "POST":
        return JsonResponse({"error": "method not allowed"}, status=405)
    request.session.flush()
    resp = JsonResponse({"message": "ok"})
    resp.set_cookie(
        "sessionid",
        "",
        max_age=0,
        expires="Thu, 01 Jan 1970 00:00:00 GMT",
        path=getattr(settings, "SESSION_COOKIE_PATH", "/"),
        domain=getattr(settings, "SESSION_COOKIE_DOMAIN", None),
        secure=getattr(settings, "SESSION_COOKIE_SECURE", False),
        httponly=getattr(settings, "SESSION_COOKIE_HTTPONLY", True),
        samesite=getattr(settings, "SESSION_COOKIE_SAMESITE", "Lax"),
    )
    resp.set_cookie(
        "csrftoken",
        "",
        max_age=0,
        expires="Thu, 01 Jan 1970 00:00:00 GMT",
        path=getattr(settings, "CSRF_COOKIE_PATH", "/"),
        domain=getattr(settings, "CSRF_COOKIE_DOMAIN", None),
        secure=getattr(settings, "CSRF_COOKIE_SECURE", False),
        httponly=False,
        samesite=getattr(settings, "CSRF_COOKIE_SAMESITE", "Lax"),
    )
    return resp


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
            return Response({"error": "destination not found"}, status=400)

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "no file"}, status=400)

        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext not in settings.ALLOWED_VIDEO_EXTENSIONS:
            return Response({"error": f"unsupported format: {ext}"}, status=400)

        if uploaded_file.size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
            return Response({"error": "file too large"}, status=400)

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

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        job = self.get_object()
        if job.status in ("pending", "uploading"):
            job.status = "failed"
            job.error_message = "cancelled"
            job.save()
            return Response({"message": "cancelled"})
        return Response({"error": "cannot cancel"}, status=400)


def _process_upload(job_id):
    try:
        job = UploadJob.objects.get(id=job_id)
        dest = job.destination
        access_token = get_valid_access_token(dest)
        if dest.platform == "youtube":
            video_id = upload_to_youtube(
                job.file_path, job.title, job.description, job.tags,
                job.privacy, access_token, job.scheduled_time,
            )
        elif dest.platform == "facebook":
            video_id = upload_to_facebook(
                job.file_path, job.title, job.description,
                access_token, dest.page_id, job.scheduled_time,
            )
        else:
            raise ValueError(f"unknown platform: {dest.platform}")

        job.platform_video_id = video_id
        job.status = "success"
        job.progress = 100
        job.save()
    except Exception as e:
        try:
            job = UploadJob.objects.get(id=job_id)
            job.status = "failed"
            job.error_message = str(e)
            job.save()
        except Exception:
            pass
    finally:
        try:
            job = UploadJob.objects.get(id=job_id)
            if os.path.exists(job.file_path):
                os.remove(job.file_path)
        except Exception:
            pass


def _read_index():
    index_path = Path(settings.SPA_DIR) / "index.html"
    if not index_path.exists():
        return None
    return index_path.read_text(encoding="utf-8")


def spa_index(request):
    html = _read_index()
    if html is None:
        return HttpResponse("SPA not built. Run the build step.", status=404)
    return HttpResponse(html)


def spa_catchall(request, path=""):
    return spa_index(request)


def oauth_youtube_start(request):
    state = secrets.token_urlsafe(16)
    request.session["oauth_state"] = state
    auth_url = youtube_oauth.build_auth_url(state)
    return JsonResponse({"auth_url": auth_url})


def _find_or_create_youtube_destination(title, tokens, cfg, user):
    dest = Destination.objects.filter(platform="youtube").first()
    if dest is None:
        dest = Destination(platform="youtube", created_by=user, updated_by=user)
    dest.name = title
    dest.access_token = tokens.get("access_token", "")
    dest.refresh_token = tokens.get("refresh_token", "")
    dest.client_id = cfg.client_id
    dest.client_secret = cfg.client_secret
    dest.page_id = ""
    dest.is_active = True
    dest.save()
    return dest


def oauth_youtube_callback(request):
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
        cfg = YouTubeAppConfig.get_active()
        _find_or_create_youtube_destination(title, tokens, cfg, user)
    except YouTubeAppConfig.DoesNotExist:
        result_payload = {"type": "oauth-error", "message": "ยังไม่ได้ตั้งค่า YouTubeAppConfig ใน Admin"}
        return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
    except Exception as e:
        result_payload = {"type": "oauth-error", "message": str(e)}
        return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
    result_payload = {"type": "oauth-success"}
    return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
