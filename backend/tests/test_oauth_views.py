from unittest import mock

import pytest
from providers.models import YouTubeConfig
from uploads.models import Destination


@pytest.fixture
def yt_config(db):
    return YouTubeConfig.objects.create(
        client_id="cid", client_secret="csec", redirect_uri="http://localhost/callback"
    )


@pytest.mark.django_db
def test_start_returns_auth_url_and_state(client, yt_config, monkeypatch):
    monkeypatch.setattr(
        "uploads.views.youtube_oauth.build_auth_url", mock.Mock(return_value="http://auth")
    )
    resp = client.get("/api/oauth/youtube/start/")
    assert resp.status_code == 200
    assert resp.json()["auth_url"] == "http://auth"
    assert "oauth_state" in client.session


@pytest.mark.django_db
def test_callback_creates_destination(client, yt_config, monkeypatch):
    monkeypatch.setattr(
        "uploads.views.youtube_oauth.build_auth_url", mock.Mock(return_value="x")
    )
    client.get("/api/oauth/youtube/start/")
    tokens = {"access_token": "atok", "refresh_token": "rtok"}
    monkeypatch.setattr(
        "uploads.views.youtube_oauth.exchange_code_for_tokens",
        mock.Mock(return_value=tokens),
    )
    monkeypatch.setattr(
        "uploads.views.youtube_oauth.fetch_channel_title", mock.Mock(return_value="ช่องA")
    )
    resp = client.get("/api/oauth/youtube/callback/?code=abc&state=" + client.session["oauth_state"])
    assert resp.status_code == 200
    dest = Destination.objects.get(platform="youtube")
    assert dest.name == "ช่องA"
    assert dest.refresh_token == "rtok"
    assert b"oauth-success" in resp.content


@pytest.mark.django_db
def test_callback_rejects_bad_state(client, yt_config, monkeypatch):
    # exchange failure must surface as an oauth-error page, not a 500
    monkeypatch.setattr(
        "uploads.views.youtube_oauth.exchange_code_for_tokens",
        mock.Mock(side_effect=ValueError("bad code")),
    )
    resp = client.get("/api/oauth/youtube/callback/?code=abc&state=wrong")
    assert resp.status_code == 200
    assert b"oauth-error" in resp.content
