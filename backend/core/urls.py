from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from django.conf import settings
from uploads.views import spa_catchall

SPA_ASSETS = str(settings.SPA_DIR / "assets")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("uploads.urls")),
    re_path(r"^assets/(?P<path>.*)$", serve, {"document_root": SPA_ASSETS}),
    re_path(r"^(?!api/|admin$|admin/|static/|assets/).*$", spa_catchall),
]
