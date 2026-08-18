# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Backend tests migrated to pytest**: Run with `cd backend && python -m pytest` (replaces `python manage.py test`)

## [1.5.0] - 2026-08-07

### Added
- **Template Management System**: Full CRUD for upload templates with title, description, tags
  - `TemplateModal` component for create/edit with prefill from current task
  - `/templates` page with table listing, create, edit, delete
  - Modal reuse across Upload page and Templates page
  - Escape key to close modals, server error message extraction
- **UploadTemplate model**: Added `title` field (char, 255, blank)
- **Upload page integration**: "บันทึกเทมเพลต" button opens modal; apply template fills title/description/tags
- **Navigation**: "เทมเพลต" link in navbar with route `/templates`

### Changed
- **Facebook description format**: Now includes video title and separator:
  ```
  {video_title}
  -----------------
  {description}
  ```
- **Templates table**: Action buttons (แก้ไข/ลบ) display horizontally

### Fixed
- **Modal CSS collision**: Renamed `.modal-*` to `.tpl-modal-*` to avoid conflict with DestinationForm modal
- **Modal field reset**: Fields reset properly when reopening with new initial data

## [1.4.0] - 2026-08-07

### Added
- **Setup Docs page**: 5-step Facebook app configuration guide with screenshots
- **Django Admin**: UploadTemplate registered with list display (name, description, tags, created_by, created_at)

### Changed
- **Docs page**: Removed "Valid OAuth Redirect URIs" step (local-only usage)

## [1.3.0] - 2026-07-16

### Added
- **Facebook OAuth flow**: Implicit token popup connect (no OAuth redirect needed)
  - Facebook API v25.0
  - Long-lived page token exchange
  - Real app credentials stored in DB
- **Settings page**: Connected Facebook accounts table with connected_at dates
- **FacebookTokenPage**: Frontend callback for token exchange

### Fixed
- **Upload retry**: Unique file path per upload; retry tracks new job ID
- **YouTube scheduled upload**: Timezone handling for `publishAt`

## [1.2.0] - 2026-07-10

### Added
- **Template system (backend)**: UploadTemplate model, serializer, ViewSet, admin registration
- **Upload page**: Batch upload with table editor (video_title, description, tags)
- **UI redesign**: Design system with OKLCH tokens, cards, badges, buttons

### Changed
- **Destinations renamed**: "Member Platform Upload" (from Destinations)

### Removed
- **Unused configs**: TikTokConfig, FacebookConfig orphan table

## [1.1.0] - 2026-07-01

### Added
- **YouTube OAuth2 flow**: Full OAuth2 connection with token refresh
  - YouTubeAppConfig for central credentials
  - OAuth start/callback views and callback page
  - Token refresh service for automatic token renewal
  - YouTube OAuth connect button on Settings page and Destination form
- **Facebook extend-token**: No OAuth redirect needed for local-PC usage

### Fixed
- **DestinationForm tests**: Updated to match current OAuth flow
- **Logout cookies**: Clear sessionid and csrftoken cookies
- **SPA routing**: Admin/SPA routing, login session guard

## [1.0.0] - 2026-06-15

### Added
- **Core upload system**: Batch upload with progress bar and polling
- **YouTube upload**: Resumable upload service
- **Facebook upload**: Graph API upload service
- **Authentication**: Django session-based auth with CSRF handling
- **Frontend**: Vite + React with routing, axios API client
- **UI components**: Layout, Navbar, Settings page (Destination CRUD), Upload page, History page
- **Admin login page**
- **SPA serving**: Django static dirs + catch-all views + build script

### Changed
- **Django upgraded**: To 5.2 for Python 3.14 compatibility

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 1.5.0 | 2026-08-07 | Template management, Facebook description format |
| 1.4.0 | 2026-08-07 | Setup docs, UploadTemplate admin |
| 1.3.0 | 2026-07-16 | Facebook OAuth flow, settings connected accounts |
| 1.2.0 | 2026-07-10 | Template system backend, batch upload, UI redesign |
| 1.1.0 | 2026-07-01 | YouTube OAuth2, Facebook extend-token |
| 1.0.0 | 2026-06-15 | Core upload system, auth, frontend, SPA serving |

---

## Contributors

- @pong34811

---

## Links

- [GitHub Repository](https://github.com/pong34811/webapp_upload)
- [Issues](https://github.com/pong34811/webapp_upload/issues)