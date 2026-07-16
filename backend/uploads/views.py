from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
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


class UploadJobViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UploadJobSerializer

    def get_queryset(self):
        return UploadJob.objects.all().order_by("-created_at")

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        job = self.get_object()
        if job.status in ("pending", "uploading"):
            job.status = "failed"
            job.error_message = "cancelled"
            job.save()
            return Response({"message": "cancelled"})
        return Response({"error": "cannot cancel"}, status=400)
