import os
from unittest import mock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from uploads.models import Destination, UploadJob


@pytest.mark.django_db
def test_login_success(raw_client, user):
    res = raw_client.post("/api/auth/login/", {"username": "admin", "password": "pass1234"})
    assert res.status_code == 200


@pytest.mark.django_db
def test_login_fail(raw_client):
    res = raw_client.post("/api/auth/login/", {"username": "admin", "password": "wrong"})
    assert res.status_code == 400


@pytest.mark.django_db
def test_logout_clears_cookies(raw_client, user):
    raw_client.login(username="admin", password="pass1234")
    res = raw_client.post("/api/auth/logout/")
    assert res.status_code == 200
    assert "sessionid" in res.cookies
    assert "csrftoken" in res.cookies
    assert res.cookies["sessionid"]["max-age"] == 0
    assert res.cookies["csrftoken"]["max-age"] == 0


@pytest.mark.django_db
def test_login_csrf_exempt(raw_client, user):
    res = raw_client.post(
        "/api/auth/login/",
        data='{"username":"admin","password":"pass1234"}',
        content_type="application/json",
    )
    assert res.status_code == 200


@pytest.mark.django_db
def test_logout_csrf_exempt(raw_client):
    res = raw_client.post("/api/auth/logout/")
    assert res.status_code == 200


@pytest.mark.django_db
def test_create_destination(api_client):
    res = api_client.post("/api/destinations/", {
        "platform": "youtube",
        "name": "Ch A",
        "access_token": "tok123",
    })
    assert res.status_code == 201
    assert Destination.objects.count() == 1


@pytest.mark.django_db
def test_list_destinations(api_client, user):
    Destination.objects.create(
        platform="youtube", name="Ch A", access_token="tok",
        created_by=user, updated_by=user,
    )
    res = api_client.get("/api/destinations/")
    assert res.status_code == 200
    assert len(res.data) == 1


@pytest.mark.django_db
def test_soft_delete(api_client, user):
    dest = Destination.objects.create(
        platform="youtube", name="Ch A", access_token="tok",
        created_by=user, updated_by=user,
    )
    res = api_client.delete(f"/api/destinations/{dest.id}/")
    assert res.status_code == 204
    dest.refresh_from_db()
    assert not dest.is_active


@pytest.mark.django_db
def test_create_destination_with_oauth_fields(api_client):
    res = api_client.post("/api/destinations/", {
        "platform": "youtube",
        "name": "Ch A",
        "access_token": "tok123",
        "client_id": "cid",
        "client_secret": "csec",
        "refresh_token": "rtok",
    })
    assert res.status_code == 201
    assert res.data["client_id"] == "cid"
    assert res.data["client_secret"] == "csec"
    assert res.data["refresh_token"] == "rtok"


@pytest.mark.django_db
def test_list_uploads(api_client, user):
    dest = Destination.objects.create(
        platform="youtube", name="Ch A", access_token="tok",
        created_by=user, updated_by=user,
    )
    UploadJob.objects.create(
        destination=dest, filename="v.mp4", file_path="/tmp/v.mp4",
        title="V", created_by=user, updated_by=user,
    )
    res = api_client.get("/api/uploads/")
    assert res.status_code == 200


@pytest.mark.django_db
def test_cancel_upload(api_client, user):
    dest = Destination.objects.create(
        platform="youtube", name="Ch A", access_token="tok",
        created_by=user, updated_by=user,
    )
    job = UploadJob.objects.create(
        destination=dest, filename="v.mp4", file_path="/tmp/v.mp4",
        title="V", status="uploading", created_by=user, updated_by=user,
    )
    res = api_client.post(f"/api/uploads/{job.id}/cancel/")
    assert res.status_code == 200
    job.refresh_from_db()
    assert job.status == "failed"


@pytest.mark.django_db
def test_process_upload_uses_refreshed_token(api_client, user, monkeypatch):
    dest = Destination.objects.create(
        platform="youtube", name="Ch A", access_token="tok",
        created_by=user, updated_by=user,
    )
    dest.refresh_token = "rtok"
    dest.client_id = "cid"
    dest.client_secret = "csec"
    dest.save()
    job = UploadJob.objects.create(
        destination=dest, filename="v.mp4", file_path="/tmp/v.mp4",
        title="V", created_by=user, updated_by=user,
    )
    upload_mock = mock.Mock(return_value="vid123")
    refresh_mock = mock.Mock(return_value="new_tok")
    monkeypatch.setattr("uploads.services.token_refresh.refresh_youtube_access_token", refresh_mock)
    monkeypatch.setattr("uploads.views.upload_to_youtube", upload_mock)

    from uploads import views
    views._process_upload(job.id)

    # Verify upload_to_youtube was called with "new_tok" (not "tok")
    args, _ = upload_mock.call_args
    assert args[5] == "new_tok"
    assert refresh_mock.called
    job.refresh_from_db()
    assert job.status == "success"


@pytest.mark.django_db
def test_create_gives_each_job_a_unique_file_path(api_client, user, monkeypatch):
    # multi-destination: same file uploaded twice must not share a path,
    # or the first finished job deletes the file out from under the second
    dest = Destination.objects.create(
        platform="youtube", name="Ch A", access_token="tok",
        created_by=user, updated_by=user,
    )
    monkeypatch.setattr("threading.Thread.start", mock.Mock())
    res1 = api_client.post("/api/uploads/", {
        "destination_id": dest.id, "title": "V", "file": SimpleUploadedFile("a.mp4", b"abc"),
    }, format="multipart")
    res2 = api_client.post("/api/uploads/", {
        "destination_id": dest.id, "title": "V", "file": SimpleUploadedFile("a.mp4", b"abc"),
    }, format="multipart")
    assert res1.status_code == 201
    assert res2.status_code == 201
    p1 = UploadJob.objects.get(id=res1.data["id"]).file_path
    p2 = UploadJob.objects.get(id=res2.data["id"]).file_path
    assert p1 != p2
    assert os.path.exists(p1)
    assert os.path.exists(p2)
    os.remove(p1)
    os.remove(p2)
