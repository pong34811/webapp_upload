import pytest
from uploads.models import Destination, UploadJob


@pytest.mark.django_db
def test_create_destination(user):
    dest = Destination.objects.create(
        platform="youtube",
        name="Test Channel",
        access_token="tok_abc",
        created_by=user,
        updated_by=user,
    )
    assert dest.platform == "youtube"
    assert dest.is_active


@pytest.mark.django_db
def test_soft_delete(user):
    dest = Destination.objects.create(
        platform="facebook",
        name="Test Page",
        access_token="tok_fb",
        created_by=user,
        updated_by=user,
    )
    dest.is_active = False
    dest.save()
    dest.refresh_from_db()
    assert not dest.is_active


@pytest.mark.django_db
def test_oauth_fields_default_blank(user):
    dest = Destination.objects.create(
        platform="youtube",
        name="Ch OAuth",
        access_token="tok",
        created_by=user,
        updated_by=user,
    )
    assert dest.client_id == ""
    assert dest.client_secret == ""
    assert dest.refresh_token == ""


@pytest.mark.django_db
def test_oauth_fields_stored(user):
    dest = Destination.objects.create(
        platform="youtube",
        name="Ch OAuth",
        access_token="tok",
        client_id="cid",
        client_secret="csec",
        refresh_token="rtok",
        created_by=user,
        updated_by=user,
    )
    assert dest.client_id == "cid"
    assert dest.client_secret == "csec"
    assert dest.refresh_token == "rtok"


@pytest.mark.django_db
def test_create_job(user):
    dest = Destination.objects.create(
        platform="youtube",
        name="Ch A",
        access_token="tok",
        created_by=user,
        updated_by=user,
    )
    job = UploadJob.objects.create(
        destination=dest,
        filename="test.mp4",
        file_path="/tmp/test.mp4",
        title="My Video",
        status="pending",
        created_by=user,
        updated_by=user,
    )
    assert job.status == "pending"
    assert job.progress == 0
