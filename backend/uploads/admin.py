from django.contrib import admin
from .models import Destination, UploadJob, YouTubeAppConfig


@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ("platform", "name", "is_active", "created_at")


@admin.register(UploadJob)
class UploadJobAdmin(admin.ModelAdmin):
    list_display = ("title", "destination", "status", "created_at")


@admin.register(YouTubeAppConfig)
class YouTubeAppConfigAdmin(admin.ModelAdmin):
    list_display = ("client_id", "redirect_uri")
