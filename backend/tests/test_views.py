from unittest import mock
import os
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from uploads.models import Destination, UploadJob
from django.core.files.uploadedfile import SimpleUploadedFile


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

    def test_logout_clears_cookies(self):
        self.client.login(username="admin", password="pass1234")
        res = self.client.post("/api/auth/logout/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("sessionid", res.cookies)
        self.assertIn("csrftoken", res.cookies)
        self.assertEqual(res.cookies["sessionid"]["max-age"], 0)
        self.assertEqual(res.cookies["csrftoken"]["max-age"], 0)

    def test_login_csrf_exempt(self):
        res = self.client.post("/api/auth/login/", data='{"username":"admin","password":"pass1234"}', content_type="application/json")
        self.assertEqual(res.status_code, 200)

    def test_logout_csrf_exempt(self):
        res = self.client.post("/api/auth/logout/")
        self.assertEqual(res.status_code, 200)


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

    def test_create_gives_each_job_a_unique_file_path(self):
        # multi-destination: same file uploaded twice must not share a path,
        # or the first finished job deletes the file out from under the second
        with mock.patch("threading.Thread.start"):
            res1 = self.client.post("/api/uploads/", {
                "destination_id": self.dest.id, "title": "V", "file": SimpleUploadedFile("a.mp4", b"abc"),
            }, format="multipart")
            res2 = self.client.post("/api/uploads/", {
                "destination_id": self.dest.id, "title": "V", "file": SimpleUploadedFile("a.mp4", b"abc"),
            }, format="multipart")
        self.assertEqual(res1.status_code, 201)
        self.assertEqual(res2.status_code, 201)
        p1 = UploadJob.objects.get(id=res1.data["id"]).file_path
        p2 = UploadJob.objects.get(id=res2.data["id"]).file_path
        self.assertNotEqual(p1, p2)
        self.assertTrue(os.path.exists(p1))
        self.assertTrue(os.path.exists(p2))
        os.remove(p1)
        os.remove(p2)
