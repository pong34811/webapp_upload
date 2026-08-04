from django.contrib import admin
from .models import YouTubeConfig

@admin.register(YouTubeConfig)
class YouTubeConfigAdmin(admin.ModelAdmin):
    list_display = ("client_id", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("client_id",)
