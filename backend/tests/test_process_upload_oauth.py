from unittest import mock

import pytest
from uploads.models import Destination, UploadJob
from uploads import views


@pytest.mark.django_db
def test_process_upload_refreshes_youtube_token(user, monkeypatch):
    dest = Destination.objects.create(
        platform="youtube", name="ช่องA", access_token="old",
        refresh_token="rtok", client_id="cid", client_secret="csec",
        created_by=user, updated_by=user,
    )
    job = UploadJob.objects.create(
        destination=dest, filename="v.mp4", file_path="/tmp/v.mp4",
        title="V", created_by=user, updated_by=user,
    )
    monkeypatch.setattr(
        "uploads.services.token_refresh.refresh_youtube_access_token",
        mock.Mock(return_value="fresh_tok"),
    )
    monkeypatch.setattr("uploads.views.upload_to_youtube", mock.Mock(return_value="vid123"))

    views._process_upload(job.id)

    job.refresh_from_db()
    assert job.status == "success"
    assert job.platform_video_id == "vid123"
