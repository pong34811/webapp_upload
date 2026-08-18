from unittest import mock

import pytest
from uploads.services import youtube_oauth


def _fake_config():
    cfg = mock.Mock()
    cfg.client_id = "cid"
    cfg.client_secret = "sec"
    cfg.redirect_uri = "http://localhost:8000/api/oauth/youtube/callback/"
    return cfg


def _fake_response(json_payload=None, error=None):
    resp = mock.Mock()
    if error:
        resp.raise_for_status.side_effect = error
    else:
        resp.raise_for_status.return_value = None
    resp.json.return_value = json_payload or {}
    return resp


def test_build_auth_url_contains_state_and_scope(monkeypatch):
    monkeypatch.setattr(youtube_oauth, "_config", mock.Mock(return_value=_fake_config()))
    url = youtube_oauth.build_auth_url("abc123")
    assert "state=abc123" in url
    assert "youtube.upload" in url
    assert "access_type=offline" in url


def test_exchange_code_for_tokens(monkeypatch):
    monkeypatch.setattr(
        "uploads.services.youtube_oauth.requests.post",
        mock.Mock(return_value=_fake_response({"access_token": "atok", "refresh_token": "rtok"})),
    )
    monkeypatch.setattr(youtube_oauth, "_config", mock.Mock(return_value=_fake_config()))
    tokens = youtube_oauth.exchange_code_for_tokens("code123")
    assert tokens["access_token"] == "atok"
    assert tokens["refresh_token"] == "rtok"


def test_fetch_channel_title(monkeypatch):
    monkeypatch.setattr(
        "uploads.services.youtube_oauth.requests.get",
        mock.Mock(return_value=_fake_response({"items": [{"snippet": {"title": "ช่องทดสอบ"}}]})),
    )
    assert youtube_oauth.fetch_channel_title("atok") == "ช่องทดสอบ"


def test_exchange_raises_on_error(monkeypatch):
    monkeypatch.setattr(
        "uploads.services.youtube_oauth.requests.post",
        mock.Mock(return_value=_fake_response(error=Exception("invalid_grant"))),
    )
    monkeypatch.setattr(youtube_oauth, "_config", mock.Mock(return_value=_fake_config()))
    with pytest.raises(ValueError):
        youtube_oauth.exchange_code_for_tokens("bad")
