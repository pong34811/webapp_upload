from django.contrib import admin
from django.urls import path, include, re_path
from uploads.views import spa_catchall

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("uploads.urls")),
    re_path(r"^(?!api/|admin/|static/).*$", spa_catchall),
]
