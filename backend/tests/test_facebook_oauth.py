from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import mock

import pytest
import requests
from providers.models import FacebookConfig
from uploads.models import Destination
from uploads.services.facebook_oauth import data_access_expiry


@pytest.fixture
def fb_config():
    return SimpleNamespace(client_id="appid", client_secret="appsecret")


@pytest.mark.django_db
def test_auth_url_returns_implicit_dialog(client, db):
    FacebookConfig.objects.create(client_id="appid", client_secret="appsecret")
    resp = client.get("/api/oauth/facebook/auth-url/")
    assert resp.status_code == 200
    url = resp.json()["auth_url"]
    assert "https://www.facebook.com/v25.0/dialog/oauth" in url
    assert "response_type=token" in url
    assert "client_id=appid" in url
    assert "facebook-token" in url


@pytest.mark.django_db
def test_extend_creates_destination_per_page(client, fb_config, monkeypatch):
    pages = [
        {"id": "111", "name": "PageA", "access_token": "longA"},
        {"id": "222", "name": "PageB", "access_token": "longB"},
    ]
    monkeypatch.setattr("uploads.views.facebook_oauth._config", mock.Mock(return_value=fb_config))
    monkeypatch.setattr("uploads.views.facebook_oauth.extend_token", mock.Mock(return_value=("longtok", 5184000)))
    monkeypatch.setattr("uploads.views.facebook_oauth.data_access_expiry", mock.Mock(return_value=None))
    monkeypatch.setattr("uploads.views.facebook_oauth.fetch_pages", mock.Mock(return_value=pages))

    resp = client.post("/api/oauth/facebook/extend/", {"access_token": "short"}, content_type="application/json")

    assert resp.status_code == 200
    dests = Destination.objects.filter(platform="facebook")
    assert dests.count() == 2
    assert dests.get(page_id="111").name == "PageA"
    assert dests.get(page_id="111").access_token == "longA"
    assert dests.get(page_id="111").client_id == "appid"


@pytest.mark.django_db
def test_extend_handles_page_token_via_me(client, fb_config, monkeypatch):
    monkeypatch.setattr("uploads.views.facebook_oauth._config", mock.Mock(return_value=fb_config))
    monkeypatch.setattr("uploads.views.facebook_oauth.extend_token", mock.Mock(return_value=("longtok", 5184000)))
    monkeypatch.setattr("uploads.views.facebook_oauth.data_access_expiry", mock.Mock(return_value=None))
    monkeypatch.setattr("uploads.views.facebook_oauth.fetch_pages", mock.Mock(side_effect=ValueError("no pages")))
    monkeypatch.setattr(
        "uploads.views.facebook_oauth.fetch_page_from_token",
        mock.Mock(return_value={"id": "999", "name": "MyPage"}),
    )

    resp = client.post("/api/oauth/facebook/extend/", {"access_token": "short"}, content_type="application/json")

    assert resp.status_code == 200
    dest = Destination.objects.get(platform="facebook", page_id="999")
    assert dest.name == "MyPage"
    assert dest.access_token == "longtok"


@pytest.mark.django_db
def test_extend_stores_data_access_expiry(client, fb_config, monkeypatch):
    pages = [{"id": "111", "name": "PageA", "access_token": "longA"}]
    exp = datetime(2026, 11, 8, 0, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("uploads.views.facebook_oauth._config", mock.Mock(return_value=fb_config))
    monkeypatch.setattr("uploads.views.facebook_oauth.extend_token", mock.Mock(return_value=("longtok", 5184000)))
    monkeypatch.setattr("uploads.views.facebook_oauth.data_access_expiry", mock.Mock(return_value=exp))
    monkeypatch.setattr("uploads.views.facebook_oauth.fetch_pages", mock.Mock(return_value=pages))

    resp = client.post("/api/oauth/facebook/extend/", {"access_token": "short"}, content_type="application/json")

    assert resp.status_code == 200
    dest = Destination.objects.get(platform="facebook", page_id="111")
    assert dest.data_access_expires_at == exp


@pytest.mark.django_db
def test_extend_requires_token(client):
    resp = client.post("/api/oauth/facebook/extend/", {}, content_type="application/json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_extend_surfaces_config_error(client, monkeypatch):
    monkeypatch.setattr(
        "uploads.views.facebook_oauth._config",
        mock.Mock(side_effect=ValueError("ยังไม่ได้ตั้งค่า Facebook Config ใน Admin")),
    )
    resp = client.post("/api/oauth/facebook/extend/", {"access_token": "x"}, content_type="application/json")
    assert resp.status_code == 400
    assert "ยังไม่ได้ตั้งค่า" in resp.json()["error"]


def _fake_resp(payload=None, status_error=None):
    resp = mock.Mock()
    if status_error:
        resp.raise_for_status.side_effect = status_error
    else:
        resp.raise_for_status.return_value = None
    resp.json.return_value = payload or {}
    return resp


def test_data_access_expiry_parses_timestamp(fb_config, monkeypatch):
    exp = 1768000000
    monkeypatch.setattr(
        "uploads.services.facebook_oauth.requests.get",
        mock.Mock(return_value=_fake_resp({"data": {"data_access_expires_at": exp}})),
    )
    assert data_access_expiry(fb_config, "tok") == datetime.fromtimestamp(exp, tz=timezone.utc)


def test_data_access_expiry_returns_none_on_http_error(fb_config, monkeypatch):
    monkeypatch.setattr(
        "uploads.services.facebook_oauth.requests.get",
        mock.Mock(return_value=_fake_resp(status_error=requests.exceptions.HTTPError("400"))),
    )
    assert data_access_expiry(fb_config, "tok") is None


def test_data_access_expiry_returns_none_on_connection_error(fb_config, monkeypatch):
    monkeypatch.setattr(
        "uploads.services.facebook_oauth.requests.get",
        mock.Mock(side_effect=requests.exceptions.ConnectionError("no network")),
    )
    assert data_access_expiry(fb_config, "tok") is None


def test_data_access_expiry_returns_none_when_fb_reports_no_expiry(fb_config, monkeypatch):
    monkeypatch.setattr(
        "uploads.services.facebook_oauth.requests.get",
        mock.Mock(return_value=_fake_resp({"data": {"app_id": "123"}})),
    )
    assert data_access_expiry(fb_config, "tok") is None
