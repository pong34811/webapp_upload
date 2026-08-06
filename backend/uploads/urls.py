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
    path("oauth/facebook/start/", views.oauth_facebook_start, name="oauth_fb_start"),
    path("oauth/facebook/callback/", views.oauth_facebook_callback, name="oauth_fb_callback"),
    path("", include(router.urls)),
]
