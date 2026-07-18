# Task 4: OAuth start + callback views (backend)

**Files:**
- Modify: `backend/uploads/views.py` (add `oauth_youtube_start`, `oauth_youtube_callback`, helper `_find_or_create_youtube_destination`)
- Modify: `backend/uploads/urls.py` (add 2 routes)
- Create: `backend/uploads/templates/oauth_done.html`
- Test: `backend/tests/test_oauth_views.py`

**Interfaces:**
- Consumes: `youtube_oauth.build_auth_url`, `exchange_code_for_tokens`, `fetch_channel_title` (Task 3); `Destination` model; `YouTubeAppConfig.get_active()` (Task 1).
- Produces:
  - `GET /api/oauth/youtube/start/` → JSON `{"auth_url": "..."}`, sets `request.session["oauth_state"]`.
  - `GET /api/oauth/youtube/callback/?code=...&state=...` → validates state, exchanges, fetches title, creates/updates `Destination` (platform="youtube", name=title, access_token, refresh_token, client_id, client_secret, page_id=""), then renders `oauth_done.html` which `postMessage`s `{type:"oauth-success"}` (or `{type:"oauth-error", message}`).
  - `find_or_create_youtube_destination(title, tokens, cfg)` helper reuses an existing youtube Destination if one exists, else creates one.

- [ ] **Step1: Write the failing test**

```python
# backend/tests/test_oauth_views.py
from unittest import mock
from django.test import TestCase
from django.contrib.auth.models import User
from uploads.models import Destination


class OAuthViewsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")

    def test_start_returns_auth_url_and_state(self):
        from uploads import views
        with mock.patch("uploads.views.youtube_oauth.build_auth_url", return_value="http://auth"):
            resp = self.client.get("/api/oauth/youtube/start/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["auth_url"], "http://auth")
        self.assertIn("oauth_state", self.client.session)

    def test_callback_creates_destination(self):
        from uploads import views
        with mock.patch("uploads.views.youtube_oauth.build_auth_url", return_value="x"):
            self.client.get("/api/oauth/youtube/start/")
        tokens = {"access_token": "atok", "refresh_token": "rtok"}
        with mock.patch("uploads.views.youtube_oauth.exchange_code_for_tokens", return_value=tokens), \
             mock.patch("uploads.views.youtube_oauth.fetch_channel_title", return_value="ช่องA"):
            resp = self.client.get("/api/oauth/youtube/callback/?code=abc&state=" + self.client.session["oauth_state"])
        self.assertEqual(resp.status_code, 200)
        dest = Destination.objects.get(platform="youtube")
        self.assertEqual(dest.name, "ช่องA")
        self.assertEqual(dest.refresh_token, "rtok")
        self.assertIn("oauth-success", resp.content.decode())

    def test_callback_rejects_bad_state(self):
        resp = self.client.get("/api/oauth/youtube/callback/?code=abc&state=wrong")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("oauth-error", resp.content.decode())
```

- [ ] **Step2: Run test to verify it fails**

Run: `cd backend && python manage.py test tests.test_oauth_views`
Expected: FAIL — view/route not found (404).

- [ ] **Step3: Write minimal implementation**

Add to `backend/uploads/views.py` (ensure `youtube_oauth` is imported):
```python
from .services import youtube_oauth
from django.shortcuts import render
from django.conf import settings


def oauth_youtube_start(request):
    import secrets
    state = secrets.token_urlsafe(16)
    request.session["oauth_state"] = state
    auth_url = youtube_oauth.build_auth_url(state)
    return JsonResponse({"auth_url": auth_url})


def _find_or_create_youtube_destination(title, tokens, cfg, user):
    dest = Destination.objects.filter(platform="youtube").first()
    if dest is None:
        dest = Destination(platform="youtube", created_by=user, updated_by=user)
    dest.name = title
    dest.access_token = tokens.get("access_token", "")
    dest.refresh_token = tokens.get("refresh_token", "")
    dest.client_id = cfg.client_id
    dest.client_secret = cfg.client_secret
    dest.page_id = ""
    dest.is_active = True
    dest.save()
    return dest


def oauth_youtube_callback(request):
    state = request.GET.get("state", "")
    code = request.GET.get("code", "")
    expected = request.session.get("oauth_state", "")
    if not state or state != expected:
        return render(request, "oauth_done.html", {"result": "error", "message": "state ไม่ถูกต้อง"})
    try:
        tokens = youtube_oauth.exchange_code_for_tokens(code)
        title = youtube_oauth.fetch_channel_title(tokens["access_token"])
        user = request.user if request.user.is_authenticated else None
        cfg = YouTubeAppConfig.get_active()
        _find_or_create_youtube_destination(title, tokens, cfg, user)
    except Exception as e:
        return render(request, "oauth_done.html", {"result": "error", "message": str(e)})
    return render(request, "oauth_done.html", {"result": "success", "message": ""})
```

IMPORTANT — resolve the `result_json` inconsistency in the brief: the `oauth_done.html` template uses `{{ result_json|safe }}`, so the callback view must render with `result_json` (a JSON string), NOT `result`/`message`. Rewrite the two render calls in `oauth_youtube_callback` to:
```python
import json
# on error:
result_payload = {"type": "oauth-error", "message": "state ไม่ถูกต้อง"}
return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
# on exception:
result_payload = {"type": "oauth-error", "message": str(e)}
return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
# on success:
result_payload = {"type": "oauth-success"}
return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
```
(Keep the helper function unchanged.)

Add to `backend/uploads/urls.py` (inside `urlpatterns`):
```python
path("oauth/youtube/start/", views.oauth_youtube_start, name="oauth_start"),
path("oauth/youtube/callback/", views.oauth_youtube_callback, name="oauth_callback"),
```

Create `backend/uploads/templates/oauth_done.html`:
```html
<!doctype html>
<html lang="th">
<head><meta charset="UTF-8"><title>OAuth Done</title></head>
<body>
<script>
  const result = {{ result_json|safe }};
  if (window.opener) {
    window.opener.postMessage(result, window.location.origin);
  }
  window.close();
</script>
</body>
</html>
```

- [ ] **Step4: Run test to verify it passes**

Run: `cd backend && python manage.py test tests.test_oauth_views`
Expected: PASS (3 tests).

- [ ] **Step5: Commit**

```bash
git add backend/uploads/views.py backend/uploads/urls.py backend/uploads/templates/oauth_done.html backend/tests/test_oauth_views.py
git commit -m "feat: add YouTube OAuth start/callback views and callback page"
```
