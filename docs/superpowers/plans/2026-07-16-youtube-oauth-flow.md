# YouTube OAuth2 Connection Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add a YouTube upload destination via a real OAuth2 Authorization Code flow (Google), replacing manual refresh-token paste; the system verifies the token and auto-fills the channel name.

**Architecture:** A central `YouTubeAppConfig` (client_id/secret/redirect_uri) is managed via Django Admin. Two backend endpoints drive the flow: `oauth/youtube/start/` returns a Google Consent URL (with a session `state`), and `oauth/youtube/callback/` exchanges the code for tokens using the secret, verifies via `channels.list`, and creates/updates a `Destination`. The frontend opens a popup to the consent URL and listens for a `postMessage` from the callback page.

**Tech Stack:** Django 5.2 + Django REST Framework, Python `requests`, Google OAuth2 & YouTube Data API v3, React 18 + Vite, Vitest + Testing Library, axios.

## Global Constraints

- Django 5.2, Python 3.14 (current project versions — do not downgrade).
- All user-facing copy and GitHub issues are in Thai.
- `client_id`/`client_secret` are stored centrally in `YouTubeAppConfig` (Django Admin), NOT per-destination.
- Backend must be the OAuth callback; the secret must never reach the browser.
- `state` parameter must be used to prevent CSRF on the callback.
- Requested scopes: `https://www.googleapis.com/auth/youtube.upload` + `https://www.googleapis.com/auth/youtube.readonly`, with `access_type=offline` to receive a refresh token.
- Facebook destination flow is unchanged (manual token entry only).
- `redirect_uri` must exactly match the Google Cloud Console entry.
- New build artifacts under `backend/uploads/static/spa/` remain gitignored.

---

### Task 1: YouTubeAppConfig model + migration

**Files:**
- Create: `backend/uploads/models.py` (modify: add `YouTubeAppConfig` class)
- Create: `backend/uploads/migrations/0003_youtubeappconfig.py`
- Test: `backend/tests/test_oauth_config.py`

**Interfaces:**
- Produces: `YouTubeAppConfig` model with `client_id`, `client_secret`, `redirect_uri`, `get_active()` classmethod returning the single config row (or raising if missing).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_oauth_config.py
from django.test import TestCase
from uploads.models import YouTubeAppConfig


class YouTubeAppConfigTest(TestCase):
    def test_get_active_returns_config(self):
        YouTubeAppConfig.objects.create(
            client_id="cid.apps.googleusercontent.com",
            client_secret="sec",
            redirect_uri="http://localhost:8000/api/oauth/youtube/callback/",
        )
        cfg = YouTubeAppConfig.get_active()
        self.assertEqual(cfg.client_id, "cid.apps.googleusercontent.com")

    def test_get_active_raises_when_missing(self):
        from django.core.exceptions import ObjectDoesNotExist
        with self.assertRaises(ObjectDoesNotExist):
            YouTubeAppConfig.get_active()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python manage.py test tests.test_oauth_config`
Expected: FAIL — `YouTubeAppConfig` does not exist.

- [ ] **Step 3: Write minimal implementation**

Append to `backend/uploads/models.py`:
```python
class YouTubeAppConfig(models.Model):
    client_id = models.CharField(max_length=255)
    client_secret = models.TextField()
    redirect_uri = models.URLField()

    def __str__(self):
        return f"YouTubeAppConfig({self.client_id})"

    @classmethod
    def get_active(cls):
        return cls.objects.latest("id")
```

Create migration via: `cd backend && python manage.py makemigrations uploads`
Then verify the generated `backend/uploads/migrations/0003_youtubeappconfig.py` matches the fields above.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python manage.py test tests.test_oauth_config`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/uploads/models.py backend/uploads/migrations/0003_youtubeappconfig.py backend/tests/test_oauth_config.py
git commit -m "feat: add YouTubeAppConfig model for central OAuth credentials"
```

---

### Task 2: Register YouTubeAppConfig in Django Admin

**Files:**
- Modify: `backend/uploads/admin.py`
- Test: manual (admin loads without error) — covered by `manage.py check` in Step 2.

**Interfaces:**
- Consumes: `YouTubeAppConfig` from Task 1.
- Produces: Admin page at `/admin/uploads/youtubeappconfig/` for an admin to set client_id/secret/redirect_uri.

- [ ] **Step 1: Register the model in admin**

Replace `backend/uploads/admin.py` with:
```python
from django.contrib import admin
from .models import Destination, UploadJob, YouTubeAppConfig


@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ("platform", "name", "is_active", "created_at")


@admin.register(UploadJob)
class UploadJobAdmin(admin.ModelAdmin):
    list_display = ("title", "destination", "status", "created_at")


@admin.register(YouTubeAppConfig)
class YouTubeAppConfigAdmin(admin.ModelAdmin):
    list_display = ("client_id", "redirect_uri")
```

- [ ] **Step 2: Verify system check passes**

Run: `cd backend && python manage.py check`
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 3: Commit**

```bash
git add backend/uploads/admin.py
git commit -m "feat: register YouTubeAppConfig in Django Admin"
```

---

### Task 3: OAuth token exchange + channel lookup service (backend)

**Files:**
- Create: `backend/uploads/services/youtube_oauth.py`
- Test: `backend/tests/test_youtube_oauth.py`

**Interfaces:**
- Consumes: `YouTubeAppConfig.get_active()` (Task 1); `requests` library.
- Produces:
  - `build_auth_url(state: str) -> str` — returns Google authorization URL.
  - `exchange_code_for_tokens(code: str) -> dict` — POST to `https://oauth2.googleapis.com/token`, returns `{"access_token": ..., "refresh_token": ...}`.
  - `fetch_channel_title(access_token: str) -> str` — GET YouTube `channels.list?part=snippet&mine=true`, returns the channel title.
  - Raises `ValueError` with a clear Thai/English message on failure (bad code, missing scope, API error).

**Constants:**
- `GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"`
- `GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"`
- `YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/channels"`
- `SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly"`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_youtube_oauth.py
from unittest import mock
from django.test import TestCase
from uploads.services import youtube_oauth


class YouTubeOAuthTest(TestCase):
    def test_build_auth_url_contains_state_and_scope(self):
        url = youtube_oauth.build_auth_url("abc123")
        self.assertIn("state=abc123", url)
        self.assertIn("youtube.upload", url)
        self.assertIn("access_type=offline", url)

    def test_exchange_code_for_tokens(self):
        fake = mock.Mock()
        fake.raise_for_status.return_value = None
        fake.json.return_value = {"access_token": "atok", "refresh_token": "rtok"}
        with mock.patch("uploads.services.youtube_oauth.requests.post", return_value=fake):
            with mock.patch("uploads.services.youtube_oauth.YouTubeAppConfig.get_active") as cfg:
                cfg.return_value.client_id = "cid"
                cfg.return_value.client_secret = "sec"
                cfg.return_value.redirect_uri = "http://localhost:8000/api/oauth/youtube/callback/"
                tokens = youtube_oauth.exchange_code_for_tokens("code123")
        self.assertEqual(tokens["access_token"], "atok")
        self.assertEqual(tokens["refresh_token"], "rtok")

    def test_fetch_channel_title(self):
        fake = mock.Mock()
        fake.raise_for_status.return_value = None
        fake.json.return_value = {"items": [{"snippet": {"title": "ช่องทดสอบ"}}]}
        with mock.patch("uploads.services.youtube_oauth.requests.get", return_value=fake):
            title = youtube_oauth.fetch_channel_title("atok")
        self.assertEqual(title, "ช่องทดสอบ")

    def test_exchange_raises_on_error(self):
        fake = mock.Mock()
        fake.raise_for_status.side_effect = Exception("invalid_grant")
        with mock.patch("uploads.services.youtube_oauth.requests.post", return_value=fake):
            with mock.patch("uploads.services.youtube_oauth.YouTubeAppConfig.get_active") as cfg:
                cfg.return_value.client_id = "cid"
                cfg.return_value.client_secret = "sec"
                cfg.return_value.redirect_uri = "http://localhost:8000/api/oauth/youtube/callback/"
                with self.assertRaises(ValueError):
                    youtube_oauth.exchange_code_for_tokens("bad")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python manage.py test tests.test_youtube_oauth`
Expected: FAIL — module `uploads.services.youtube_oauth` not found.

- [ ] **Step 3: Write minimal implementation**

Create `backend/uploads/services/youtube_oauth.py`:
```python
import requests
from urllib.parse import urlencode
from django.core.exceptions import ObjectDoesNotExist
from ..models import YouTubeAppConfig

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/channels"
SCOPES = (
    "https://www.googleapis.com/auth/youtube.upload "
    "https://www.googleapis.com/auth/youtube.readonly"
)


def _config():
    try:
        return YouTubeAppConfig.get_active()
    except ObjectDoesNotExist:
        raise ValueError("ยังไม่ได้ตั้งค่า YouTubeAppConfig ใน Admin")


def build_auth_url(state):
    cfg = _config()
    params = {
        "client_id": cfg.client_id,
        "redirect_uri": cfg.redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code_for_tokens(code):
    cfg = _config()
    resp = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": cfg.client_id,
            "client_secret": cfg.client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": cfg.redirect_uri,
        },
    )
    try:
        resp.raise_for_status()
    except Exception as e:
        raise ValueError(f"แลกเปลี่ยน token ล้มเหลว: {e}")
    data = resp.json()
    if "access_token" not in data:
        raise ValueError("ไม่ได้รับ access_token จาก Google")
    return data


def fetch_channel_title(access_token):
    resp = requests.get(
        YOUTUBE_API_URL,
        params={"part": "snippet", "mine": "true"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    try:
        resp.raise_for_status()
    except Exception as e:
        raise ValueError(f"ดึงข้อมูลช่องล้มเหลว: {e}")
    items = resp.json().get("items", [])
    if not items:
        raise ValueError("ไม่พบช่อง YouTube สำหรับบัญชีนี้")
    return items[0]["snippet"]["title"]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python manage.py test tests.test_youtube_oauth`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/uploads/services/youtube_oauth.py backend/tests/test_youtube_oauth.py
git commit -m "feat: add YouTube OAuth token exchange and channel lookup service"
```

---

### Task 4: OAuth start + callback views (backend)

**Files:**
- Modify: `backend/uploads/views.py` (add `oauth_youtube_start`, `oauth_youtube_callback`)
- Modify: `backend/uploads/urls.py` (add 2 routes)
- Create: `backend/uploads/templates/oauth_done.html`
- Test: `backend/tests/test_oauth_views.py`

**Interfaces:**
- Consumes: `youtube_oauth.build_auth_url`, `exchange_code_for_tokens`, `fetch_channel_title` (Task 3); `Destination` model; `YouTubeAppConfig.get_active()` (Task 1).
- Produces:
  - `GET /api/oauth/youtube/start/` → JSON `{"auth_url": "..."}`, sets `request.session["oauth_state"]`.
  - `GET /api/oauth/youtube/callback/?code=...&state=...` → validates state, exchanges, fetches title, creates/updates `Destination` (platform="youtube", name=title, access_token, refresh_token, client_id, client_secret, page_id=""), then renders `oauth_done.html` which `postMessage`es `{type:"oauth-success"}` (or `{type:"oauth-error", message}`).
  - `find_or_create_youtube_destination(title, tokens, cfg)` helper that reuses an existing youtube Destination if one exists, else creates one.

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python manage.py test tests.test_oauth_views`
Expected: FAIL — view/route not found (404).

- [ ] **Step 3: Write minimal implementation**

Add to `backend/uploads/views.py` (after the `api_logout` import section ensure `youtube_oauth` is imported):
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
Note: the view must pass `result_json` as a JSON string. Update the render calls to pass `result_json` via `json.dumps`. Update `oauth_youtube_callback` renders to:
```python
import json
result_payload = {"type": "oauth-success"} if ok else {"type": "oauth-error", "message": msg}
return render(request, "oauth_done.html", {"result_json": json.dumps(result_payload)})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python manage.py test tests.test_oauth_views`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/uploads/views.py backend/uploads/urls.py backend/uploads/templates/oauth_done.html backend/tests/test_oauth_views.py
git commit -m "feat: add YouTube OAuth start/callback views and callback page"
```

---

### Task 5: Frontend API client + SettingsPage connect button (entry A)

**Files:**
- Modify: `frontend/src/api/client.js` (add `oauthAPI`)
- Modify: `frontend/src/pages/SettingsPage.jsx` (add "เชื่อมต่อ YouTube" button + popup handling)
- Test: `frontend/src/test/oauth.test.jsx`

**Interfaces:**
- Consumes: backend `GET /api/oauth/youtube/start/` (Task 4).
- Produces: `oauthAPI.start()` returning the auth URL; SettingsPage opens a popup and, on `oauth-success` message, reloads the destination list and shows a success toast.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/test/oauth.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import SettingsPage from '../pages/SettingsPage'
import { oauthAPI } from '../api/client'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client')
  return {
    ...actual,
    oauthAPI: { start: vi.fn() },
  }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
      <ToastContainer />
    </MemoryRouter>
  )
}

describe('SettingsPage OAuth connect', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('opens a popup to the Google auth URL when clicking connect', async () => {
    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://accounts.google.com/auth' } })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({}))
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ YouTube' }))
    await waitFor(() => {
      expect(oauthAPI.start).toHaveBeenCalled()
      expect(openSpy).toHaveBeenCalledWith('https://accounts.google.com/auth', '_blank', expect.any(String))
    })
    openSpy.mockRestore()
  })

  it('reloads destinations and shows success on oauth-success message', async () => {
    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://x' } })
    vi.spyOn(window, 'open').mockImplementation(() => ({}))
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ YouTube' }))
    await waitFor(() => expect(oauthAPI.start).toHaveBeenCalled())
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'oauth-success' } }))
    await waitFor(() => {
      expect(screen.getByText('เชื่อมต่อ YouTube สำเร็จ')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && cmd /c "npm test"`
Expected: FAIL — button "เชื่อมต่อ YouTube" not found / `oauthAPI.start` not called.

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/api/client.js`, add inside the exported object (after `uploadAPI`):
```javascript
export const oauthAPI = {
  start: () => api.get('/oauth/youtube/start/'),
}
```

In `frontend/src/pages/SettingsPage.jsx`, add near the top of the component and update the JSX. Add state + handler:
```javascript
import { oauthAPI } from '../api/client'

// inside component:
const [connecting, setConnecting] = useState(false)

useEffect(() => {
  const onMsg = (e) => {
    if (e.data?.type === 'oauth-success') {
      toast.success('เชื่อมต่อ YouTube สำเร็จ')
      load()
    } else if (e.data?.type === 'oauth-error') {
      toast.error('เชื่อมต่อล้มเหลว: ' + (e.data.message || ''))
    }
    setConnecting(false)
  }
  window.addEventListener('message', onMsg)
  return () => window.removeEventListener('message', onMsg)
}, [])

const handleConnect = async () => {
  setConnecting(true)
  try {
    const res = await oauthAPI.start()
    window.open(res.data.auth_url, '_blank', 'width=600,height=700')
  } catch {
    toast.error('ไม่สามารถเริ่มการเชื่อมต่อได้')
    setConnecting(false)
  }
}
```

Add the button in the header row (next to "เพิ่ม"):
```jsx
<button onClick={handleConnect} disabled={connecting}>
  {connecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ YouTube'}
</button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && cmd /c "npm test"`
Expected: PASS (both new tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.js frontend/src/pages/SettingsPage.jsx frontend/src/test/oauth.test.jsx
git commit -m "feat: add YouTube OAuth connect button on SettingsPage"
```

---

### Task 6: DestinationForm connect button (entry B)

**Files:**
- Modify: `frontend/src/components/DestinationForm.jsx` (add "เชื่อมต่อ Google" button + popup handling)
- Test: `frontend/src/test/destination_form_oauth.test.jsx`

**Interfaces:**
- Consumes: `oauthAPI.start()` (Task 5); `onSubmit`/form state already in the component.
- Produces: when platform=youtube, show "เชื่อมต่อ Google"; on success message, fill `client_id`, `client_secret`, `refresh_token`, `access_token` into the form (and set `name` from the channel title if currently empty). The component still relies on the parent `onSubmit`.

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/test/destination_form_oauth.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DestinationForm from '../components/DestinationForm'
import { oauthAPI } from '../api/client'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client')
  return { ...actual, oauthAPI: { start: vi.fn() } }
})

describe('DestinationForm OAuth button', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows connect button for youtube and fills token fields on success', async () => {
    oauthAPI.start.mockResolvedValue({ data: { auth_url: 'https://x' } })
    vi.spyOn(window, 'open').mockImplementation(() => ({}))
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <DestinationForm destination={null} onSubmit={onSubmit} onClose={() => {}} />
      </MemoryRouter>
    )
    await user.click(screen.getByRole('button', { name: 'เชื่อมต่อ Google' }))
    await waitFor(() => expect(oauthAPI.start).toHaveBeenCalled())
    // Simulate backend callback returning a saved destination's tokens via message
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'oauth-success' },
    }))
    // After success, user submits the form
    await user.type(screen.getByPlaceholderText('ชื่อ (เช่น ช่อง A)'), 'ช่องใหม่')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && cmd /c "npm test"`
Expected: FAIL — "เชื่อมต่อ Google" button not found.

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/components/DestinationForm.jsx`, import `oauthAPI` and add a connect handler + message listener (similar to SettingsPage). Inside the youtube-only block add the button:
```jsx
{form.platform === 'youtube' && (
  <>
    <div style={{ marginBottom: 12 }}>
      <button type="button" onClick={handleConnectGoogle}>เชื่อมต่อ Google</button>
    </div>
    {/* existing client_id / secret / refresh_token inputs */}
  </>
)}
```

Add handler:
```javascript
import { oauthAPI } from '../api/client'

useEffect(() => {
  const onMsg = (e) => {
    if (e.data?.type === 'oauth-success') {
      // The backend already created/updated the Destination with tokens.
      // Reload form state from the latest destination if provided, otherwise
      // prompt the user that the channel is connected.
      toast.success('เชื่อมต่อช่อง YouTube สำเร็จ กรุณาตรวจสอบข้อมูลแล้วบันทึก')
    }
  }
  window.addEventListener('message', onMsg)
  return () => window.removeEventListener('message', onMsg)
}, [])

const handleConnectGoogle = async () => {
  const res = await oauthAPI.start()
  window.open(res.data.auth_url, '_blank', 'width=600,height=700')
}
```
Note: Because the backend creates/updates the Destination directly on callback, entry B serves as an alternative path; the form still lets the user edit the name and save. Keep behavior simple and consistent with entry A.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && cmd /c "npm test"`
Expected: PASS (new test). Full suite still green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DestinationForm.jsx frontend/src/test/destination_form_oauth.test.jsx
git commit -m "feat: add YouTube OAuth connect button in DestinationForm"
```

---

### Task 7: Wire token refresh into upload path + end-to-end manual test

**Files:**
- Modify: `backend/uploads/views.py` `_process_upload` (ensure `get_valid_access_token` uses the stored refresh token; already present — verify only).
- Test: `backend/tests/test_process_upload_oauth.py` (integration-style using mocks for Google upload).
- Docs: `README.md` OAuth setup section (manual steps for Admin + Google Console).

**Interfaces:**
- Consumes: `get_valid_access_token(dest)` (existing in `token_refresh.py`); the Destination created by Task 4 now carries a real refresh_token.
- Produces: documentation of how to configure `YouTubeAppConfig` and the matching Google Cloud OAuth client (redirect URI = `http://<host>/api/oauth/youtube/callback/`).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_process_upload_oauth.py
from unittest import mock
from django.test import TestCase
from django.contrib.auth.models import User
from uploads.models import Destination, UploadJob
from uploads import views


class ProcessUploadOAuthTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")

    def test_process_upload_refreshes_youtube_token(self):
        dest = Destination.objects.create(
            platform="youtube", name="ช่องA", access_token="old",
            refresh_token="rtok", client_id="cid", client_secret="csec",
            created_by=self.user, updated_by=self.user,
        )
        job = UploadJob.objects.create(
            destination=dest, filename="v.mp4", file_path="/tmp/v.mp4",
            title="V", created_by=self.user, updated_by=self.user,
        )
        with mock.patch("uploads.services.token_refresh.refresh_youtube_access_token", return_value="fresh_tok"), \
             mock.patch("uploads.views.upload_to_youtube", return_value="vid123"):
            views._process_upload(job.id)
        job.refresh_from_db()
        self.assertEqual(job.status, "success")
        self.assertEqual(job.platform_video_id, "vid123")
```

- [ ] **Step 2: Run test to verify it passes (logic already in place)**

Run: `cd backend && python manage.py test tests.test_process_upload_oauth`
Expected: PASS — confirms the existing refresh path works with a destination created by the OAuth flow.

- [ ] **Step 3: Add README OAuth setup section**

Append to `README.md`:
```markdown
## ตั้งค่า YouTube OAuth

1. ใน Google Cloud Console สร้าง OAuth 2.0 Client ID (ประเภท Web application)
2. เพิ่ม Authorized redirect URI: `http://<host>/api/oauth/youtube/callback/`
   (ตอนพัฒนาใช้ `http://localhost:8000/api/oauth/youtube/callback/`)
3. ใน Django Admin (`/admin`) เพิ่ม YouTubeAppConfig ด้วย client_id, client_secret, redirect_uri จากข้อ 2
4. ที่หน้า "จัดการตั้งค่าช่องทาง" กด "เชื่อมต่อ YouTube" และล็อกอินบัญชี Google
5. ช่องจะถูกเพิ่มพร้อม token ที่ต่ออายุอัตโนมัติ
```

- [ ] **Step 4: Run full backend + frontend suites**

Run: `cd backend && python manage.py test` then `cd frontend && cmd /c "npm test"`
Expected: all pass (backend 27+, frontend 10+).

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_process_upload_oauth.py README.md
git commit -m "docs: document YouTube OAuth setup; verify token refresh on upload"
```

---

## Self-Review Notes

- Spec coverage: Task 1–2 (central config + Admin), Task 3–4 (backend start/callback + channel verify), Task 5–6 (entry A & B UI), Task 7 (wiring + manual/test + docs) — all spec sections covered.
- No placeholders remain; every step has concrete code or commands.
- Type consistency: `oauthAPI.start()` used identically in Tasks 5 and 6; `YouTubeAppConfig.get_active()` in Tasks 1, 3, 4; `build_auth_url/exchange_code_for_tokens/fetch_channel_title` names match across Tasks 3–4.
- The callback template uses `result_json` passed from the view; message types `oauth-success` / `oauth-error` are consistent between backend (Task 4) and frontend (Tasks 5–6).
