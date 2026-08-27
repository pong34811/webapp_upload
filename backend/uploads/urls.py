from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("destinations", views.DestinationViewSet, basename="destination")
router.register("uploads", views.UploadViewSet, basename="upload")
router.register("templates", views.UploadTemplateViewSet, basename="template")

urlpatterns = [
    path("auth/login/", views.api_login, name="api_login"),
    path("auth/logout/", views.api_logout, name="api_logout"),
    path("auth/me/", views.api_me, name="api_me"),
    path("oauth/youtube/start/", views.oauth_youtube_start, name="oauth_start"),
    path("oauth/youtube/callback/", views.oauth_youtube_callback, name="oauth_callback"),
    path("oauth/facebook/auth-url/", views.facebook_auth_url, name="oauth_fb_auth_url"),
    path("oauth/facebook/extend/", views.facebook_extend_token, name="oauth_fb_extend"),
    path("import/sheets/", views.import_excel_sheets, name="import_excel_sheets"),
    path("import/preview/", views.import_excel_preview, name="import_excel_preview"),
    path("", include(router.urls)),
]
