import os
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from uploads.views import oauth_youtube_callback

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("uploads.urls")),
    path("api/youtube/callback/", oauth_youtube_callback, name="oauth_youtube_callback_direct"),
]

# In production, serve the React SPA for all non-API routes
if not settings.DEBUG:
    urlpatterns += [
        re_path(r"^(?!api/|admin/|static/).*$", TemplateView.as_view(template_name="index.html")),
    ]
