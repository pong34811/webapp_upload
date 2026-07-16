from django.test import TestCase
from django.contrib.auth.models import User
from uploads.models import Destination, UploadJob


class DestinationModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")

    def test_create_destination(self):
        dest = Destination.objects.create(
            platform="youtube",
            name="Test Channel",
            access_token="tok_abc",
            created_by=self.user,
            updated_by=self.user,
        )
        self.assertEqual(dest.platform, "youtube")
        self.assertTrue(dest.is_active)

    def test_soft_delete(self):
        dest = Destination.objects.create(
            platform="facebook",
            name="Test Page",
            access_token="tok_fb",
            created_by=self.user,
            updated_by=self.user,
        )
        dest.is_active = False
        dest.save()
        dest.refresh_from_db()
        self.assertFalse(dest.is_active)


    def test_oauth_fields_default_blank(self):
        dest = Destination.objects.create(
            platform="youtube",
            name="Ch OAuth",
            access_token="tok",
            created_by=self.user,
            updated_by=self.user,
        )
        self.assertEqual(dest.client_id, "")
        self.assertEqual(dest.client_secret, "")
        self.assertEqual(dest.refresh_token, "")

    def test_oauth_fields_stored(self):
        dest = Destination.objects.create(
            platform="youtube",
            name="Ch OAuth",
            access_token="tok",
            client_id="cid",
            client_secret="csec",
            refresh_token="rtok",
            created_by=self.user,
            updated_by=self.user,
        )
        self.assertEqual(dest.client_id, "cid")
        self.assertEqual(dest.client_secret, "csec")
        self.assertEqual(dest.refresh_token, "rtok")


class UploadJobModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")
        self.dest = Destination.objects.create(
            platform="youtube",
            name="Ch A",
            access_token="tok",
            created_by=self.user,
            updated_by=self.user,
        )

    def test_create_job(self):
        job = UploadJob.objects.create(
            destination=self.dest,
            filename="test.mp4",
            file_path="/tmp/test.mp4",
            title="My Video",
            status="pending",
            created_by=self.user,
            updated_by=self.user,
        )
        self.assertEqual(job.status, "pending")
        self.assertEqual(job.progress, 0)
