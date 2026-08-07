from django.contrib import admin
from .models import Destination, UploadJob, UploadTemplate


@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ("platform", "name", "is_active", "created_at")


@admin.register(UploadJob)
class UploadJobAdmin(admin.ModelAdmin):
    list_display = ("title", "destination", "status", "created_at")


@admin.register(UploadTemplate)
class UploadTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "tags", "created_by", "created_at")
