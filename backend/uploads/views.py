import os
import threading
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from .models import Destination, UploadJob
from .serializers import DestinationSerializer, UploadJobSerializer, UploadCreateSerializer
from .services.youtube import upload_to_youtube
from .services.facebook import upload_to_facebook


@api_view(["POST"])
@permission_classes([AllowAny])
def api_login(request):
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return Response({"message": "ok", "username": user.username})
    return Response({"error": "invalid credentials"}, status=400)


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


def _process_upload(job_id):
    try:
        job = UploadJob.objects.get(id=job_id)
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
