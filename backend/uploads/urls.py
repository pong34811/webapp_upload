from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("destinations", views.DestinationViewSet, basename="destination")
router.register("uploads", views.UploadJobViewSet, basename="upload")

urlpatterns = [
    path("auth/login/", views.api_login, name="api_login"),
    path("auth/logout/", views.api_logout, name="api_logout"),
    path("auth/me/", views.api_me, name="api_me"),
    path("", include(router.urls)),
]
