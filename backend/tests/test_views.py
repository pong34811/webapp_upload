from unittest import mock
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from uploads.models import Destination, UploadJob


class AuthTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="admin", password="pass1234")

    def test_login_success(self):
        res = self.client.post("/api/auth/login/", {"username": "admin", "password": "pass1234"})
        self.assertEqual(res.status_code, 200)

    def test_login_fail(self):
        res = self.client.post("/api/auth/login/", {"username": "admin", "password": "wrong"})
        self.assertEqual(res.status_code, 400)


class DestinationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="admin", password="pass1234")
        self.client.force_authenticate(user=self.user)

    def test_create_destination(self):
        res = self.client.post("/api/destinations/", {
            "platform": "youtube",
            "name": "Ch A",
            "access_token": "tok123",
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Destination.objects.count(), 1)

    def test_list_destinations(self):
        Destination.objects.create(platform="youtube", name="Ch A", access_token="tok", created_by=self.user, updated_by=self.user)
        res = self.client.get("/api/destinations/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)

    def test_soft_delete(self):
        dest = Destination.objects.create(platform="youtube", name="Ch A", access_token="tok", created_by=self.user, updated_by=self.user)
        res = self.client.delete(f"/api/destinations/{dest.id}/")
        self.assertEqual(res.status_code, 204)
        dest.refresh_from_db()
        self.assertFalse(dest.is_active)

    def test_create_destination_with_oauth_fields(self):
        res = self.client.post("/api/destinations/", {
            "platform": "youtube",
            "name": "Ch A",
            "access_token": "tok123",
            "client_id": "cid",
            "client_secret": "csec",
            "refresh_token": "rtok",
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["client_id"], "cid")
        self.assertEqual(res.data["client_secret"], "csec")
        self.assertEqual(res.data["refresh_token"], "rtok")


class UploadJobTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="admin", password="pass1234")
        self.client.force_authenticate(user=self.user)
        self.dest = Destination.objects.create(platform="youtube", name="Ch A", access_token="tok", created_by=self.user, updated_by=self.user)

    def test_list_uploads(self):
        UploadJob.objects.create(destination=self.dest, filename="v.mp4", file_path="/tmp/v.mp4", title="V", created_by=self.user, updated_by=self.user)
        res = self.client.get("/api/uploads/")
        self.assertEqual(res.status_code, 200)

    def test_cancel_upload(self):
        job = UploadJob.objects.create(destination=self.dest, filename="v.mp4", file_path="/tmp/v.mp4", title="V", status="uploading", created_by=self.user, updated_by=self.user)
        res = self.client.post(f"/api/uploads/{job.id}/cancel/")
        self.assertEqual(res.status_code, 200)
        job.refresh_from_db()
        self.assertEqual(job.status, "failed")

    def test_process_upload_uses_refreshed_token(self):
        self.dest.refresh_token = "rtok"
        self.dest.client_id = "cid"
        self.dest.client_secret = "csec"
        self.dest.save()
        job = UploadJob.objects.create(
            destination=self.dest, filename="v.mp4", file_path="/tmp/v.mp4",
            title="V", created_by=self.user, updated_by=self.user,
        )
        with mock.patch("uploads.services.token_refresh.refresh_youtube_access_token", return_value="new_tok") as refresh_mock, \
             mock.patch("uploads.views.upload_to_youtube", return_value="vid123") as upload_mock:
            from uploads import views
            views._process_upload(job.id)
        # Verify upload_to_youtube was called with "new_tok" (not "tok")
        args, _ = upload_mock.call_args
        self.assertEqual(args[5], "new_tok")
        self.assertTrue(refresh_mock.called)
        job.refresh_from_db()
        self.assertEqual(job.status, "success")
