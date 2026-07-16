# Token Auto-Refresh (#3) + Serve Frontend from Django (#4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-destination YouTube token refresh so uploads survive token expiry, then make Django serve the built React SPA directly for local/prod runs.

**Architecture:** Phase 1 adds optional `client_id`/`client_secret`/`refresh_token` fields to `Destination` and a `token_refresh` service that mints a fresh YouTube access token before upload, falling back to the stored token when no refresh data is present. Phase 2 builds the frontend, copies `dist/` into Django static, and adds a catch-all view serving `index.html`.

**Tech Stack:** Django 5.2 + DRF 3.14 (backend), React 18 + Vite (frontend), `google-auth`/`google-api-python-client` (already in requirements), `requests` for token endpoint, Django `TestCase` for tests.

## Global Constraints

- Django must stay `>=5.2,<5.3` (Python 3.14 compatible) — do not downgrade.
- New `Destination` fields must be nullable/blank with defaults so existing rows migrate cleanly.
- Keep the existing "paste access_token" flow working — no OAuth redirect/consent screen is added.
- CORS stays `CORS_ALLOW_ALL_ORIGINS = True` for dev; README documents how to narrow for prod.
- SPA catch-all must NOT intercept `/api/`, `/admin/`, or `/static/`.
- Project goal remains single-machine / local-run.

---

## Phase 1 — Issue #3: Auto-refresh tokens

### Task 1: Add OAuth refresh fields to Destination model

**Files:**
- Modify: `backend/uploads/models.py:5-21` (Destination class)
- Test: `backend/tests/test_models.py` (append to DestinationModelTest)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Destination.client_id`, `Destination.client_secret`, `Destination.refresh_token` (all `""` default, blank=True).

- [ ] **Step 1: Write the failing test**

Append to `DestinationModelTest` in `backend/tests/test_models.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python manage.py test tests.test_models.DestinationModelTest.test_oauth_fields_default_blank`
Expected: FAIL with `AttributeError: 'Destination' object has no attribute 'client_id'`

- [ ] **Step 3: Write minimal implementation**

In `backend/uploads/models.py`, add three fields to `Destination` (after `page_id`, before `is_active`):

```python
    client_id = models.CharField(max_length=255, blank=True, default="")
    client_secret = models.TextField(blank=True, default="")
    refresh_token = models.TextField(blank=True, default="")
```

- [ ] **Step 4: Create and run the migration**

Run: `cd backend && python manage.py makemigrations uploads && python manage.py migrate`
Expected: new migration `uploads/migrations/0002_*.py` created, migrate succeeds.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python manage.py test tests.test_models`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/uploads/models.py backend/uploads/migrations/ backend/tests/test_models.py
git commit -m "feat(#3): add client_id/client_secret/refresh_token to Destination"
```

### Task 2: Expose new fields via serializer

**Files:**
- Modify: `backend/uploads/serializers.py:8-9` (DestinationSerializer fields)

**Interfaces:**
- Consumes: `Destination` fields added in Task 1.
- Produces: `DestinationSerializer` now includes `client_id`, `client_secret`, `refresh_token` in API responses/requests.

- [ ] **Step 1: Write the failing test**

Append to `DestinationTest` in `backend/tests/test_views.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python manage.py test tests.test_views.DestinationTest.test_create_destination_with_oauth_fields`
Expected: FAIL — response `client_id` is `""` (field not accepted).

- [ ] **Step 3: Write minimal implementation**

In `backend/uploads/serializers.py`, update `DestinationSerializer.Meta.fields`:

```python
        fields = ["id", "platform", "name", "access_token", "page_id",
                  "client_id", "client_secret", "refresh_token", "is_active",
                  "created_by", "updated_by", "created_at", "updated_at"]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python manage.py test tests.test_views`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/uploads/serializers.py backend/tests/test_views.py
git commit -m "feat(#3): expose oauth fields in Destination serializer"
```

### Task 3: Implement token refresh service

**Files:**
- Create: `backend/uploads/services/token_refresh.py`
- Test: `backend/tests/test_token_refresh.py` (new file)

**Interfaces:**
- Consumes: nothing (pure functions; uses `requests`).
- Produces:
  - `refresh_youtube_access_token(client_id: str, client_secret: str, refresh_token: str) -> str`
  - `get_valid_access_token(destination: Destination) -> str`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_token_refresh.py`:

```python
from unittest import mock
from django.test import TestCase
from django.contrib.auth.models import User
from uploads.models import Destination
from uploads.services.token_refresh import (
    refresh_youtube_access_token,
    get_valid_access_token,
)


class TokenRefreshTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="admin", password="pass1234")

    def test_refresh_youtube_access_token(self):
        fake_resp = mock.Mock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {"access_token": "new_tok"}
        with mock.patch("uploads.services.token_refresh.requests.post", return_value=fake_resp):
            tok = refresh_youtube_access_token("cid", "csec", "rtok")
        self.assertEqual(tok, "new_tok")

    def test_refresh_youtube_access_token_raises_on_error(self):
        fake_resp = mock.Mock()
        fake_resp.raise_for_status.side_effect = Exception("bad")
        with mock.patch("uploads.services.token_refresh.requests.post", return_value=fake_resp):
            with self.assertRaises(Exception):
                refresh_youtube_access_token("cid", "csec", "rtok")

    def test_get_valid_access_token_uses_refresh(self):
        dest = Destination.objects.create(
            platform="youtube", name="Ch", access_token="old",
            client_id="cid", client_secret="csec", refresh_token="rtok",
            created_by=self.user, updated_by=self.user,
        )
        fake_resp = mock.Mock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {"access_token": "fresh"}
        with mock.patch("uploads.services.token_refresh.requests.post", return_value=fake_resp):
            tok = get_valid_access_token(dest)
        self.assertEqual(tok, "fresh")

    def test_get_valid_access_token_legacy_fallback(self):
        dest = Destination.objects.create(
            platform="youtube", name="Ch", access_token="legacy",
            created_by=self.user, updated_by=self.user,
        )
        tok = get_valid_access_token(dest)
        self.assertEqual(tok, "legacy")

    def test_get_valid_access_token_facebook_legacy(self):
        dest = Destination.objects.create(
            platform="facebook", name="Pg", access_token="fbtok",
            created_by=self.user, updated_by=self.user,
        )
        self.assertEqual(get_valid_access_token(dest), "fbtok")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python manage.py test tests.test_token_refresh`
Expected: FAIL with `ModuleNotFoundError: No module named 'uploads.services.token_refresh'`

- [ ] **Step 3: Write minimal implementation**

Create `backend/uploads/services/token_refresh.py`:

```python
import requests


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def refresh_youtube_access_token(client_id, client_secret, refresh_token):
    resp = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def get_valid_access_token(destination):
    if destination.platform == "youtube" and destination.refresh_token:
        return refresh_youtube_access_token(
            destination.client_id,
            destination.client_secret,
            destination.refresh_token,
        )
    return destination.access_token
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python manage.py test tests.test_token_refresh`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/uploads/services/token_refresh.py backend/tests/test_token_refresh.py
git commit -m "feat(#3): add token refresh service for YouTube"
```

### Task 4: Wire token refresh into upload processing

**Files:**
- Modify: `backend/uploads/views.py:120-135` (`_process_upload`)

**Interfaces:**
- Consumes: `get_valid_access_token(destination)` from Task 3.
- Produces: uploads use refreshed token when available; legacy flow unchanged.

- [ ] **Step 1: Write the failing test**

Append to `UploadJobTest` in `backend/tests/test_views.py`:

```python
    def test_process_upload_uses_refreshed_token(self):
        from unittest import mock
        from uploads.services import youtube as yt
        self.dest.refresh_token = "rtok"
        self.dest.client_id = "cid"
        self.dest.client_secret = "csec"
        self.dest.save()
        job = UploadJob.objects.create(
            destination=self.dest, filename="v.mp4", file_path="/tmp/v.mp4",
            title="V", created_by=self.user, updated_by=self.user,
        )
        with mock.patch.object(yt, "upload_to_youtube", return_value="vid123") as m:
            from uploads import views
            views._process_upload(job.id)
        args, kwargs = m.call_args
        self.assertEqual(args[5], "new_tok")
        job.refresh_from_db()
        self.assertEqual(job.status, "success")
```

Note: this requires `refresh_youtube_access_token` to be patched in `uploads.services.token_refresh`. Add patch:

```python
    def test_process_upload_uses_refreshed_token(self):
        from unittest import mock
        from uploads.services import youtube as yt
        from uploads import services
        self.dest.refresh_token = "rtok"
        self.dest.client_id = "cid"
        self.dest.client_secret = "csec"
        self.dest.save()
        job = UploadJob.objects.create(
            destination=self.dest, filename="v.mp4", file_path="/tmp/v.mp4",
            title="V", created_by=self.user, updated_by=self.user,
        )
        with mock.patch.object(yt, "upload_to_youtube", return_value="vid123"), \
             mock.patch.object(services.token_refresh, "refresh_youtube_access_token", return_value="new_tok"):
            from uploads import views
            views._process_upload(job.id)
        job.refresh_from_db()
        self.assertEqual(job.status, "success")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python manage.py test tests.test_views.UploadJobTest.test_process_upload_uses_refreshed_token`
Expected: FAIL — `upload_to_youtube` called with `args[5] == "tok"` (legacy token), assertion error.

- [ ] **Step 3: Write minimal implementation**

In `backend/uploads/views.py`, add import at top (after line 13):

```python
from .services.token_refresh import get_valid_access_token
```

In `_process_upload`, replace the `dest.access_token` usages:

```python
def _process_upload(job_id):
    try:
        job = UploadJob.objects.get(id=job_id)
        dest = job.destination
        access_token = get_valid_access_token(dest)
        if dest.platform == "youtube":
            video_id = upload_to_youtube(
                job.file_path, job.title, job.description, job.tags,
                job.privacy, access_token, job.scheduled_time,
            )
        elif dest.platform == "facebook":
            video_id = upload_to_facebook(
                job.file_path, job.title, job.description,
                access_token, dest.page_id, job.scheduled_time,
            )
        else:
            raise ValueError(f"unknown platform: {dest.platform}")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python manage.py test tests.test_views tests.test_token_refresh`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/uploads/views.py backend/tests/test_views.py
git commit -m "feat(#3): use refreshed token in upload processing"
```

### Task 5: Frontend — add OAuth fields to DestinationForm

**Files:**
- Modify: `frontend/src/components/DestinationForm.jsx:1-58`

**Interfaces:**
- Consumes: backend now accepts `client_id`, `client_secret`, `refresh_token` on Destination.
- Produces: form submits those fields; backend serializer persists them.

- [ ] **Step 1: Add fields to form state**

In `frontend/src/components/DestinationForm.jsx`, update `useState` initial object (lines 4-9):

```javascript
  const [form, setForm] = useState({
    platform: 'youtube',
    name: '',
    access_token: '',
    page_id: '',
    client_id: '',
    client_secret: '',
    refresh_token: '',
  })
```

- [ ] **Step 2: Include fields in edit load**

Update the `useEffect` body (lines 12-19):

```javascript
  useEffect(() => {
    if (destination) {
      setForm({
        platform: destination.platform,
        name: destination.name,
        access_token: destination.access_token,
        page_id: destination.page_id || '',
        client_id: destination.client_id || '',
        client_secret: destination.client_secret || '',
        refresh_token: destination.refresh_token || '',
      })
    }
  }, [destination])
```

- [ ] **Step 3: Render the three new inputs (only for youtube)**

After the `access_token` input block (after line 46), and before the facebook `page_id` block, add:

```javascript
        {form.platform === 'youtube' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <input name="client_id" placeholder="Client ID (optional)" value={form.client_id} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <input name="client_secret" placeholder="Client Secret (optional)" value={form.client_secret} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <input name="refresh_token" placeholder="Refresh Token (optional)" value={form.refresh_token} onChange={handleChange} style={{ width: '100%', padding: 8 }} />
            </div>
          </>
        )}
```

- [ ] **Step 4: Build to verify no errors**

Run: `cd frontend && npm run build`
Expected: build succeeds (dist/ generated), no compile errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DestinationForm.jsx
git commit -m "feat(#3): add optional OAuth fields to destination form"
```

---

## Phase 2 — Issue #4: Serve frontend from Django

### Task 6: Configure Django static for SPA

**Files:**
- Modify: `backend/core/settings.py:66-67` (STATIC config)

**Interfaces:**
- Consumes: nothing.
- Produces: `SPA_DIR` and `STATICFILES_DIRS` pointing at built SPA assets.

- [ ] **Step 1: Add SPA static config**

In `backend/core/settings.py`, after `STATIC_URL = "static/"` (line 66) add:

```python
STATIC_ROOT = BASE_DIR / "staticfiles"
SPA_DIR = BASE_DIR / "uploads" / "static" / "spa"

STATICFILES_DIRS = [SPA_DIR] if SPA_DIR.exists() else []
```

- [ ] **Step 2: Verify settings load**

Run: `cd backend && python manage.py check`
Expected: System check passed; no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/core/settings.py
git commit -m "feat(#4): configure Django static dirs for built SPA"
```

### Task 7: Add SPA catch-all views

**Files:**
- Modify: `backend/uploads/views.py` (append views + import)
- Modify: `backend/core/urls.py:1-7`
- Test: `backend/tests/test_spa.py` (new file)

**Interfaces:**
- Consumes: `SPA_DIR` from settings (Task 6).
- Produces:
  - `spa_index(request) -> HttpResponse` serving `index.html`
  - `spa_catchall(request, path) -> HttpResponse` (same)
  - URL `re_path(r"^(?!api/|admin/|static/).*$", spa_catchall)` registered last.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_spa.py`:

```python
from django.test import TestCase
from django.test.utils import override_settings
from pathlib import Path


class SpaServingTest(TestCase):
    @override_settings(SPA_DIR=Path(__file__).parent)
    def test_root_serves_index(self):
        # Only meaningful when index.html exists in SPA_DIR; skip otherwise.
        from django.conf import settings
        if not (settings.SPA_DIR / "index.html").exists():
            self.skipTest("no built SPA present")
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)

    @override_settings(SPA_DIR=Path(__file__).parent)
    def test_catchall_serves_index(self):
        from django.conf import settings
        if not (settings.SPA_DIR / "index.html").exists():
            self.skipTest("no built SPA present")
        resp = self.client.get("/settings")
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "<div id=\"root\">")
```

- [ ] **Step 2: Run test to verify it skips/fails gracefully**

Run: `cd backend && python manage.py test tests.test_spa`
Expected: both tests skipped (no built SPA) — passes with skips.

- [ ] **Step 3: Write minimal implementation**

In `backend/uploads/views.py`, add imports at top:

```python
from django.http import HttpResponse
from django.conf import settings
from pathlib import Path
```

Append at end of file:

```python
def _read_index():
    index_path = Path(settings.SPA_DIR) / "index.html"
    if not index_path.exists():
        return None
    return index_path.read_text(encoding="utf-8")


def spa_index(request):
    html = _read_index()
    if html is None:
        return HttpResponse("SPA not built. Run the build step.", status=404)
    return HttpResponse(html)


def spa_catchall(request, path):
    return spa_index(request)
```

In `backend/core/urls.py`, update:

```python
from django.contrib import admin
from django.urls import path, include, re_path
from uploads.views import spa_catchall

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("uploads.urls")),
    re_path(r"^(?!api/|admin/|static/).*$", spa_catchall),
]
```

- [ ] **Step 4: Run tests**

Run: `cd backend && python manage.py test tests.test_spa`
Expected: still skipped (no built SPA) — passes.

- [ ] **Step 5: Commit**

```bash
git add backend/uploads/views.py backend/core/urls.py backend/tests/test_spa.py
git commit -m "feat(#4): add SPA index + catch-all views"
```

### Task 8: Build script to produce and copy SPA

**Files:**
- Create: `backend/build_spa.ps1` (Windows) and `backend/build_spa.sh` (POSIX)

**Interfaces:**
- Consumes: `frontend/` source.
- Produces: `frontend/dist/` copied into `backend/uploads/static/spa/`.

- [ ] **Step 1: Write the Windows build script**

Create `backend/build_spa.ps1`:

```powershell
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontend = Join-Path $root "..\frontend"
$spaDest = Join-Path $root "uploads\static\spa"

Write-Output "Building frontend..."
Push-Location $frontend
npm install
npm run build
Pop-Location

Write-Output "Copying dist -> $spaDest"
if (Test-Path $spaDest) { Remove-Item $spaDest -Recurse -Force }
New-Item -ItemType Directory -Path $spaDest | Out-Null
Copy-Item (Join-Path $frontend "dist\*") $spaDest -Recurse -Force
Write-Output "Done."
```

- [ ] **Step 2: Write the POSIX build script**

Create `backend/build_spa.sh`:

```sh
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/../frontend"
SPA_DEST="$ROOT/uploads/static/spa"

echo "Building frontend..."
( cd "$FRONTEND" && npm install && npm run build )

echo "Copying dist -> $SPA_DEST"
rm -rf "$SPA_DEST"
mkdir -p "$SPA_DEST"
cp -r "$FRONTEND/dist/." "$SPA_DEST/"
echo "Done."
```

- [ ] **Step 3: Run the Windows script to produce SPA**

Run: `cd backend && powershell -ExecutionPolicy Bypass -File build_spa.ps1`
Expected: frontend builds, `backend/uploads/static/spa/index.html` exists.

- [ ] **Step 4: Verify Django serves it**

Run (in one terminal): `cd backend && python manage.py runserver`
Then: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/`
Expected: `200`

- [ ] **Step 5: Commit**

```bash
git add backend/build_spa.ps1 backend/build_spa.sh
git commit -m "feat(#4): add build script to build and copy SPA into Django"
```

### Task 9: Update README with production/local-run steps

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: build script from Task 8.
- Produces: documented deploy steps.

- [ ] **Step 1: Add production section to README**

Append to `README.md`:

```markdown
## Production / Local-run (serve frontend from Django)

Instead of running the Vite dev server, build the React app and let Django
serve it:

1. From `backend/`, run the build script for your platform:
   - Windows: `powershell -ExecutionPolicy Bypass -File build_spa.ps1`
   - macOS/Linux: `bash build_spa.sh`
2. Start Django: `python manage.py runserver`
3. Open http://localhost:8000 — the SPA is served directly.

The script runs `npm install && npm run build` in `frontend/`, then copies
`frontend/dist/` into `backend/uploads/static/spa/`. Django serves
`index.html` and a catch-all route for client-side paths (`/uploads`,
`/settings`, etc.).

### Narrowing CORS for production
`CORS_ALLOW_ALL_ORIGINS = True` is fine for local dev. For a real deployment,
replace it in `backend/core/settings.py` with an explicit
`CORS_ALLOWED_ORIGINS = ["https://your-host"]`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(#4): document serving SPA from Django"
```

### Task 10: Final full test run and smoke check

**Files:** none (verification only).

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && python manage.py test`
Expected: all tests PASS (SPA tests skip if no dist at test time).

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 3: Smoke-test served SPA**

Run: `cd backend && python manage.py runserver` (background), then
`curl -s http://localhost:8000/ | findstr "root"` (or grep on POSIX).
Expected: HTML containing `<div id="root">`.

- [ ] **Step 4: Commit any leftover**

```bash
git add -A
git commit -m "chore: final verification for #3 and #4" || echo "nothing to commit"
```
