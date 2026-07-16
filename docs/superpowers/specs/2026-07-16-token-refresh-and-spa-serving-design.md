# Design: Token Auto-Refresh (#3) + Serve Frontend from Django (#4)

Date: 2026-07-16
Related issues: #3, #4

## Goal

Two enhancements for the local/single-machine web upload app:

1. **#3 Auto-refresh tokens** — store a `refresh_token` (plus per-destination
   `client_id`/`client_secret`) for YouTube destinations and mint a fresh access
   token automatically before each upload, so uploads keep working after the
   short-lived access token expires.
2. **#4 Serve frontend from Django** — in production/local-run mode, build the
   React app and serve `index.html` + static assets directly from Django
   (instead of relying on the Vite dev server), with a catch-all view for
   client-side routing.

Work order: **#3 first, then #4.**

---

## Phase 1 — Issue #3: Auto-refresh tokens

### Problem
Destinations store a manually-pasted `access_token`. YouTube access tokens expire
(~1h). When expired, uploads fail with 401 and an admin must re-paste a token.

### Approach
Add optional OAuth refresh fields to `Destination` and refresh the access token
right before uploading when those fields are present. This keeps the existing
"paste token" flow working (no OAuth redirect flow added) while allowing
long-lived operation for users who supply a refresh token.

### Data model changes (`backend/uploads/models.py`)
Add fields to `Destination`:
- `client_id` — `CharField(max_length=255, blank=True, default="")`
- `client_secret` — `TextField(blank=True, default="")`
- `refresh_token` — `TextField(blank=True, default="")`

No migration breaking existing rows (all nullable/blank with defaults).

### Serializer changes (`backend/uploads/serializers.py`)
Add the three new fields to `DestinationSerializer.fields`.

### Token refresh logic (new file `backend/uploads/services/token_refresh.py`)
- `refresh_youtube_access_token(client_id, client_secret, refresh_token) -> str`
  - POST to `https://oauth2.googleapis.com/token` with
    `grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`.
  - Return `access_token` from response.
  - Raise on non-2xx.
- `get_valid_access_token(destination) -> str`
  - If `destination.refresh_token` is set and platform is `youtube`:
    return a freshly minted token.
  - Otherwise return `destination.access_token` unchanged (legacy flow).

### Wiring (`backend/uploads/views.py` `_process_upload`)
Before calling `upload_to_youtube`, resolve the token via
`get_valid_access_token(dest)` and pass the result instead of
`dest.access_token`. Facebook path unchanged (uses long-lived Page tokens).

### Frontend (`frontend/src/components/DestinationForm.jsx`)
Add three optional inputs (only relevant for youtube): `client_id`,
`client_secret`, `refresh_token`. Include them in the form state and submit
payload. Keep `access_token` required (still the primary credential).

### Tests (`backend/tests/test_views.py` or new `test_services.py`)
- Unit test `refresh_youtube_access_token` with a mocked HTTP response.
- Test `get_valid_access_token` returns refresh path vs legacy path.

---

## Phase 2 — Issue #4: Serve frontend from Django

### Problem
Dev mode uses Vite (5173) proxying `/api` to Django (8000). For a local/LAN
production run we want Django to serve the built SPA directly.

### Approach (matches original proposal)
1. Add build step: `npm run build` in `frontend/` produces `frontend/dist/`.
2. Copy `dist/` into `backend/uploads/static/spa/`.
3. Django serves `index.html` + hashed static assets, with a catch-all view
   for client-side routes (so `/uploads`, `/settings`, etc. return index.html).
4. Document steps in `README.md`.

### Backend changes
- `backend/core/settings.py`:
  - `STATICFILES_DIRS` to include the SPA static dir.
  - Add `SPA_DIR` pointing to `BASE_DIR / "uploads" / "static" / "spa"`.
- New view in `backend/uploads/views.py` (or `core`):
  - `spa_index(request)` — `render`/`FileResponse` of `index.html`.
  - `spa_catchall(request, path)` — same index for any non-`/api`, non-`/admin`,
    non-static path.
- `backend/core/urls.py`:
  - Add `re_path(r"^(?!api/|admin/|static/).*$", spa_catchall)` last.
- Keep CORS as-is for dev; note in README how to narrow for prod.

### Frontend build config (`frontend/vite.config.js`)
- Set `base: "/"` (or appropriate) so assets resolve under Django static.
- Keep dev proxy for development.

### Deploy script (new `backend/build_spa.sh` / `.ps1` or Makefile target)
- `cd frontend && npm install && npm run build`
- copy `frontend/dist/*` → `backend/uploads/static/spa/`

### README
Add "Production / local run" section:
- how to build, copy, run `python manage.py runserver`,
- note CORS narrowing, single-machine goal.

### Tests
- Django test asserting `/` returns 200 and contains the SPA markup
  (only meaningful after a build; mark with skip if dist missing).

---

## Non-goals (YAGNI)
- No OAuth authorization redirect / consent screen flow.
- No automatic long-lived token exchange UI.
- No Docker / multi-server deployment.
