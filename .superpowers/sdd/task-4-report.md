# Task 4 Report — YouTube OAuth start/callback views

## Status
DONE_WITH_CONCERNS

## Commit
`4ce70e6947a7c274b21637b8d148a6eeda51cf31`

## Test output (final run — `python manage.py test tests.test_oauth_views`)
```
Found 3 test(s).
System check identified no issues (0 silenced).
...
----------------------------------------------------------------------
Ran 3 tests in 0.483s

OK
```

Tests:
- `test_start_returns_auth_url_and_state` — PASS
- `test_callback_creates_destination` — PASS
- `test_callback_rejects_bad_state` — PASS

Initial run (before implementation) failed as expected: 404 on routes + `module 'uploads.views' has no attribute 'youtube_oauth'`.

## Summary
Added `oauth_youtube_start`, `oauth_youtube_callback`, and helper `_find_or_create_youtube_destination` to `views.py`, two `path(...)` routes to `urls.py`, and the `oauth_done.html` template using `{{ result_json|safe }}` (resolved the brief's result_json inconsistency). All 3 tests pass and the change was committed to `main`.

## Concerns
1. **Brief inconsistency (test vs. implementation):** `test_callback_creates_destination` mocks `exchange_code_for_tokens`/`fetch_channel_title` but does NOT create a `YouTubeAppConfig` record nor mock `YouTubeAppConfig.get_active()`. The brief's callback view calls `cfg = YouTubeAppConfig.get_active()` directly, which raises `DoesNotExist` when no config row exists, sending the flow into the error branch and preventing the `Destination` from being created — the test would fail. `test_oauth_config.py::test_get_active_raises_when_missing` also requires `get_active()` to keep raising when no config exists, so the model could not be changed. To make the test pass without modifying it, the callback wraps `get_active()` in a try/except and falls back to a lightweight default object (`client_id=""`, `client_secret=""`) when no config is present. This is a minor production-tolerance behavior (config optional) but deviates slightly from the brief's literal code. Flagged for review.
2. CRLF line-ending warnings from Git on the two new text files (test and template); cosmetic only, no functional impact.

## Fix

Addressed the reviewer's Important defect: removed the empty-secret fallback in `oauth_youtube_callback`. The callback now calls `YouTubeAppConfig.get_active()` directly and surfaces a clear error (`ยังไม่ได้ตั้งค่า YouTubeAppConfig ใน Admin`) via the existing `oauth-error` render path when no config exists. Also moved `import secrets` to module top-level. The prior fallback default object with empty `client_id`/`client_secret` is fully removed — no empty secret remains anywhere.

### Fallback removed / config required
- `backend/uploads/views.py` `oauth_youtube_callback`: the `try/except YouTubeAppConfig.DoesNotExist` that built a default Cfg object is gone. `cfg = YouTubeAppConfig.get_active()` is called directly; `DoesNotExist` is caught separately and rendered as an `oauth-error` with the Thai/English message.

### Test fix
`backend/tests/test_oauth_views.py::test_callback_creates_destination` now creates a real `YouTubeAppConfig` row in `setUp` (`client_id="cid"`, `client_secret="csec"`) so the callback can succeed without the fallback. It still asserts `Destination` name `"ช่องA"`, `refresh_token` `"rtok"`, and `oauth-success` in the response. `test_callback_rejects_bad_state` is unchanged.

### Test command + output (`python manage.py test tests.test_oauth_views`)
```
Found 3 test(s).
System check identified no issues (0 silenced).
...
----------------------------------------------------------------------
Ran 3 tests in 0.498s

OK
```

### Full suite + check
- `python manage.py test` → Ran 34 tests, OK (skipped=3). No regressions (test_oauth_config, test_youtube_oauth pass).
- `python manage.py check` → System check identified no issues (0 silenced).

### Commit
`e63a0a5` — "fix: require YouTubeAppConfig in OAuth callback; drop empty-secret fallback"

This resolves the Concern #1 from the original report (the fallback deviation).
