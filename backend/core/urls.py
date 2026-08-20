import os
from pathlib import Path
from django.contrib import admin
from django.http import HttpResponse
from django.urls import path, include, re_path
from django.conf import settings
from uploads.views import oauth_youtube_callback


def serve_spa(request):
    """Serve the React SPA index.html for all client-side routes."""
    index_path = settings.FRONTEND_BUILD_DIR / "index.html"
    if index_path.exists():
        html = index_path.read_text(encoding="utf-8")
        return HttpResponse(html, content_type="text/html")
    return HttpResponse("<h1>Frontend not built</h1>", status=404)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("uploads.urls")),
    path("api/youtube/callback/", oauth_youtube_callback, name="oauth_youtube_callback_direct"),
]

# In production, serve the React SPA for all non-API routes
if not settings.DEBUG:
    urlpatterns += [
        re_path(r"^(?!api/|admin/|static/).*$", serve_spa),
    ]
