from django.contrib import admin
from django.urls import path, include
from uploads.views import oauth_youtube_callback

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("uploads.urls")),
    path("api/youtube/callback/", oauth_youtube_callback, name="oauth_youtube_callback_direct"),
]
