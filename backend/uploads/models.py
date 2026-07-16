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
    client_id = models.CharField(max_length=255, blank=True, default="")
    client_secret = models.TextField(blank=True, default="")
    refresh_token = models.TextField(blank=True, default="")
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
