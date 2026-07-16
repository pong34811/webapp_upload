# Web Upload — Video Uploader to YouTube & Facebook Page

**Date:** 2026-07-16
**Status:** Approved Design (pending implementation plan)

## Overview

A local web application that lets a single Admin upload video clips to multiple
YouTube channels and Facebook Pages. Each destination stores its own access
token. Uploads are sent one clip at a time, with full metadata (title,
description, tags, privacy, schedule) and a real-time progress bar plus an
upload history view.

## Tech Stack

- **Backend:** Django + Django REST Framework, SQLite
- **Frontend:** Vite + React (separate, talks to backend via REST API)
- **Architecture:** Approach A — Django REST API + React SPA (frontend separate)
- **Run mode:** Local / LAN only (no public deployment required)

## Project Structure

```
web_upload/
├── backend/                 # Django project
│   ├── manage.py
│   ├── core/                # Django settings, urls
│   ├── uploads/             # app: models, views (API), tasks
│   ├── requirements.txt
│   └── db.sqlite3
├── frontend/                # Vite + React
│   ├── src/
│   │   ├── components/
│   │   ├── pages/           # Upload, Settings, History, Login
│   │   └── api/             # axios calls
│   ├── package.json
│   └── vite.config.js
└── README.md
```

**Run modes:**
- Dev: Django on `:8000`, React (Vite) on `:5173` (proxy `/api` to `:8000`)
- Prod: `npm run build` → output copied to `backend/uploads/static` → Django serves it

## Data Models (SQLite)

### Destination (upload targets — channels / pages)
| Field | Type | Notes |
|-------|------|-------|
| id | PK | |
| platform | Char | `youtube` or `facebook` |
| name | Char | display name for selection (e.g. "Channel A") |
| access_token | Text | token pasted by Admin |
| page_id | Char | Facebook page id (FB only) |
| is_active | Boolean | active or not |
| created_by | FK → User | creator |
| updated_by | FK → User | last editor |
| created_at | DateTime | |
| updated_at | DateTime | |

### UploadJob (upload history)
| Field | Type | Notes |
|-------|------|-------|
| id | PK | |
| destination | FK → Destination | where it was sent |
| filename | Char | original file name |
| title, description, tags | Text | clip metadata |
| privacy | Char | public / private / unlisted |
| status | Char | pending / uploading / success / failed / scheduled |
| progress | Int | 0–100 |
| scheduled_time | DateTime | optional publish schedule |
| platform_video_id | Char | returned video id |
| error_message | Text | set on failure |
| is_active | Boolean | |
| created_by | FK → User | |
| updated_by | FK → User | |
| created_at, updated_at | DateTime | |

**Users:** Django built-in User; a single Admin user is created during setup.

## API Endpoints (DRF)

**Auth (session-based for single Admin)**
- `POST /api/auth/login` — log in
- `POST /api/auth/logout` — log out

**Destinations**
- `GET /api/destinations/` — list active destinations
- `POST /api/destinations/` — add destination
- `PUT /api/destinations/{id}/` — edit
- `DELETE /api/destinations/{id}/` — deactivate (soft delete: `is_active=False`)

**Uploads**
- `POST /api/uploads/` — receive file (multipart) + metadata → create UploadJob
- `GET /api/uploads/` — list history
- `GET /api/uploads/{id}/` — status / progress
- `POST /api/uploads/{id}/cancel/` — cancel an in-progress upload

### Progress mechanism
1. Frontend uploads the file to Django via `XMLHttpRequest` → shows % during send.
2. Django receives the file and starts uploading to YouTube/FB, updating
   `progress` on the UploadJob.
3. Frontend polls `GET /api/uploads/{id}/` every 1–2 s to update the progress bar
   until `success` / `failed`.

## Upload Flow (YouTube / Facebook)

### YouTube (YouTube Data API v3)
- Library: `google-api-python-client`
- `videos.insert` with **resumable upload** (chunked → readable progress %)
- Sends: `access_token` (from Destination), title, description, tags,
  `privacyStatus`
- Returns: `videoId` → stored in `platform_video_id`

### Facebook Page (Graph API)
- Library: `requests`
- Video upload to a Page:
  1. `POST /{page_id}/videos` (`upload_phase=start`) → `upload_session_id`
  2. send file (`upload_phase=transfer`) in chunks → update progress
  3. `upload_phase=finish` + title/description
- Uses Page access token from Destination

### Tokens (manual entry)
- Admin pastes the token into the Destination.
- YouTube tokens expire; start with plain Access Tokens and let Admin re-paste
  when expired. A `refresh_token` field / auto-refresh is a future extension.

### Scheduled upload
- If `scheduled_time` is in the future, the time is passed to the platform so it
  handles publishing itself:
  - **YouTube:** `privacyStatus="private"` + `publishAt=<time>` → YT publishes automatically
  - **Facebook Page:** `scheduled_publish_time=<timestamp>` with the upload
- The job gets `status=success` immediately after upload completes; the platform
  publishes later. **No OS scheduler needed.**

## Frontend Pages & Components

**Pages**
1. **Login** — Admin login form
2. **Upload** (main) — select destination (dropdown), choose video file, fill
   title/description/tags/privacy/schedule, **progress bar**, cancel button
3. **Settings** — manage YouTube channels / FB pages: table + add/edit/deactivate,
   token form
4. **History** — table of uploads with status, progress, time, link

**Components**
- `Layout` / `Navbar`
- `LoginForm`
- `UploadForm` + `ProgressBar`
- `DestinationForm` (modal)
- `HistoryTable`
- `api/client.js` (axios + auth token interceptor)

## Error Handling

- **Token expired/invalid:** catch 401 from API → set `status=failed` +
  `error_message="Token ไม่ถูกต้องหรือหมดอายุ"` → notify Admin to re-paste in Settings
- **Wrong file type / too large:** validate before upload (allow .mp4/.mov etc.,
  size limit) → do not create a Job if invalid
- **Network failure during upload:** YouTube resumable supports resume → retry
  automatically 1–2 times
- **Inactive destination:** hide / disable Destination with `is_active=False`
- **Frontend:** show toast notifications on success / failure

## Testing

- **Backend:** Django tests (`unittest`/`pytest`)
  - Models: save / soft-delete correct
  - API: login, Destination CRUD, UploadJob creation
  - Mock YouTube/FB upload (no real API calls in tests)
- **Frontend:** component tests with `Vitest` + `React Testing Library` (basic)
- **Manual checklist:** login → add channel → upload 1 real clip → check history

## Out of Scope (YAGNI)
- Multiple user accounts
- OAuth flow (manual token entry chosen)
- Cloud storage for videos
- Public/deployed hosting
