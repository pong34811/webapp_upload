from pathlib import Path

import pytest

_SPA_DIR = Path(__file__).parent


def _spa_available():
    return (_SPA_DIR / "index.html").exists()


_SPA_SKIP = pytest.mark.skipif(not _spa_available(), reason="no built SPA present")


@_SPA_SKIP
@pytest.mark.django_db
def test_root_serves_index(settings, client):
    settings.SPA_DIR = _SPA_DIR
    resp = client.get("/")
    assert resp.status_code == 200


@_SPA_SKIP
@pytest.mark.django_db
def test_catchall_serves_index(settings, client):
    settings.SPA_DIR = _SPA_DIR
    resp = client.get("/settings")
    assert resp.status_code == 200
    assert b"# setting" in resp.content
