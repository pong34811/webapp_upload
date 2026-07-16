from rest_framework import serializers
from .models import Destination, UploadJob


class DestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = ["id", "platform", "name", "access_token", "page_id", "is_active",
                  "created_by", "updated_by", "created_at", "updated_at"]
        read_only_fields = ["created_by", "updated_by", "created_at", "updated_at"]


class UploadJobSerializer(serializers.ModelSerializer):
    destination_name = serializers.CharField(source="destination.name", read_only=True)

    class Meta:
        model = UploadJob
        fields = ["id", "destination", "destination_name", "filename", "title",
                  "description", "tags", "privacy", "status", "progress",
                  "scheduled_time", "platform_video_id", "error_message",
                  "is_active", "created_by", "updated_by", "created_at", "updated_at"]
        read_only_fields = ["status", "progress", "platform_video_id", "error_message",
                            "created_by", "updated_by", "created_at", "updated_at"]


class UploadCreateSerializer(serializers.Serializer):
    destination_id = serializers.IntegerField()
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, default="")
    tags = serializers.CharField(required=False, default="")
    privacy = serializers.ChoiceField(choices=UploadJob.PRIVACY_CHOICES, default="private")
    scheduled_time = serializers.DateTimeField(required=False, allow_null=True)
