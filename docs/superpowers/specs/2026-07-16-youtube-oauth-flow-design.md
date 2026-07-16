# OAuth2 YouTube Connection Flow — Design

Date: 2026-07-16

## Goal
Allow users to add a YouTube upload destination via a real OAuth2 Authorization
Code flow (Google), instead of manually pasting a refresh token. After
connecting, the system verifies the token by fetching the channel name and
stores it automatically.

## Decisions (from brainstorming)
1. **Client credentials stored centrally** at the system level (Django Admin),
   not per-destination. Every YouTube destination shares one OAuth app.
2. **Backend is the OAuth callback** — the Django server exchanges the
   authorization code for tokens using the secret from Admin. The secret never
   reaches the browser.
3. **Two entry points in the UI**:
   - (A) A "เชื่อมต่อ YouTube" button on SettingsPage that creates a destination
     automatically after a successful connection.
   - (B) A "เชื่อมต่อ Google" button inside DestinationForm that fills the
     token fields after a successful connection.
4. **Verify + auto-fill channel name**: after obtaining the token, call
   YouTube `channels.list` to confirm validity and pull the channel name as the
   default destination name.

## Architecture

### 1. Data Model & Admin (backend/uploads/models.py)
New model `YouTubeAppConfig` (single row):
- `client_id` (CharField)
- `client_secret` (TextField)
- `redirect_uri` (URLField) — must exactly match the Google Console value
Scopes requested: `https://www.googleapis.com/auth/youtube.upload` and
`https://www.googleapis.com/auth/youtube.readonly`.
Registered in `admin.py` so an admin can configure it in the Django admin site.

`Destination` keeps its existing per-channel fields (`refresh_token`,
`access_token`, `client_id`, `client_secret`) so each connected channel stores
its own tokens.

### 2. Backend OAuth Endpoints (backend/uploads/urls.py + views.py)
- `GET /api/oauth/youtube/start/` → returns JSON `{ "auth_url": "..." }`.
  Generates a random `state`, stores it in the session, and builds the Google
  authorization URL with `client_id`, `redirect_uri`, `scope`, `state`, and
  `access_type=offline` (to receive a refresh token).
- `GET /api/oauth/youtube/callback/?code=...&state=...`:
  1. Validate `state` against the session (CSRF protection).
  2. Load `YouTubeAppConfig`; exchange `code` at
     `https://oauth2.googleapis.com/token` for `access_token` + `refresh_token`.
  3. Call YouTube `channels.list?part=snippet&mine=true` with the access token
     to fetch the channel title.
  4. Create or update a `Destination` (platform=youtube, name=channel title,
     access_token, refresh_token, client_id/secret from config).
  5. Return a small HTML page that `postMessage`s `{type:'oauth-success'}`
     (or `{type:'oauth-error', message:...}`) to the opener and closes itself.

### 3. Frontend UI (frontend/src)
- `api/client.js`: add `oauthAPI: { start: () => api.get('/oauth/youtube/start/') }`.
- `SettingsPage.jsx` (entry A): add "เชื่อมต่อ YouTube" button. On click, call
  `oauthAPI.start()`, open `window.open(auth_url, '_blank', 'width=600,height=700')`,
  and listen via `window.addEventListener('message')`. On `oauth-success` close
  the popup, `load()` the table, and show a success toast; on `oauth-error` show
  an error toast.
- `DestinationForm.jsx` (entry B): when platform=youtube, show a
  "เชื่อมต่อ Google" button that triggers the same popup flow and, on success,
  fills `client_id`, `client_secret`, `refresh_token`, `access_token` into the
  form (name defaults to the fetched channel title if empty).

### 4. Error Handling & Security
- `state` parameter prevents CSRF on the callback.
- `redirect_uri` must match the Google Console entry exactly.
- Backend handles: state mismatch, token exchange failure, missing
  `youtube.upload` scope, and channel fetch failure — each returns an error
  page that posts `oauth-error` back to the popup opener.
- Frontend detects a manually closed popup (before completion) and shows
  "ยกเลิกการเชื่อมต่อ".

### 5. Testing
- Backend (pytest): mock Google token + channels API; verify callback creates
  the correct Destination and that error cases return errors.
- Frontend (Vitest): mock `oauthAPI.start`; verify the button opens the popup
  and handles success/error messages.
- Manual: configure one real client_id/secret in Admin and connect a real
  channel end-to-end.

## Out of scope
- Multiple distinct OAuth apps per destination (central config only).
- Facebook OAuth (unchanged manual token entry).
- Token auto-rotation storage beyond what Google returns on exchange.
