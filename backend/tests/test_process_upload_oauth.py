from unittest import mock
from django.test import TestCase
from django.contrib.auth.models import User
from uploads.models import Destination, UploadJob
from uploads import views


class ProcessUploadOAuthTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")

    def test_process_upload_refreshes_youtube_token(self):
        dest = Destination.objects.create(
            platform="youtube", name="ช่องA", access_token="old",
            refresh_token="rtok", client_id="cid", client_secret="csec",
            created_by=self.user, updated_by=self.user,
        )
        job = UploadJob.objects.create(
            destination=dest, filename="v.mp4", file_path="/tmp/v.mp4",
            title="V", created_by=self.user, updated_by=self.user,
        )
        with mock.patch("uploads.services.token_refresh.refresh_youtube_access_token", return_value="fresh_tok"), \
             mock.patch("uploads.views.upload_to_youtube", return_value="vid123"):
            views._process_upload(job.id)
        job.refresh_from_db()
        self.assertEqual(job.status, "success")
        self.assertEqual(job.platform_video_id, "vid123")
