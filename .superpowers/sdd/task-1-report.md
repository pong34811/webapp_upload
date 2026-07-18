# Task 1 Report: YouTubeAppConfig model + migration

## What was implemented

- Appended a new `YouTubeAppConfig` model to `backend/uploads/models.py` with fields:
  - `client_id` (CharField, max_length=255)
  - `client_secret` (TextField)
  - `redirect_uri` (URLField)
  - `__str__` returning `YouTubeAppConfig({client_id})`
  - `get_active()` classmethod returning `cls.objects.latest("id")`
- Existing `Destination` and `UploadJob` models were NOT modified.
- Generated migration `backend/uploads/migrations/0003_youtubeappconfig.py` via `makemigrations uploads`. Verified it creates exactly the three fields above (plus the auto id PK).
- Added test file `backend/tests/test_oauth_config.py` with the two specified tests.

## Test results

### Step 2 — failing test (before implementation)
```
ImportError: cannot import name 'YouTubeAppConfig' from 'uploads.models'
Ran 1 test in 0.000s
FAILED (errors=1)
```
As expected: FAIL (model did not exist).

### Step 4 — passing test (after implementation)
```
Creating test database for alias 'default'...
..
----------------------------------------------------------------------
Ran 2 tests in 0.004s

OK
Destroying test database for alias 'default'...
Found 2 test(s).
System check identified no issues (0 silenced).
```
PASS — both `test_get_active_returns_config` and `test_get_active_raises_when_missing` pass.

## Commits made

- `ca8d67c494350a5f705def012b87b1722d8e5d41` — `feat: add YouTubeAppConfig model for central OAuth credentials`
  - 3 files changed, 53 insertions(+): `backend/uploads/models.py`, `backend/uploads/migrations/0003_youtubeappconfig.py`, `backend/tests/test_oauth_config.py`
  - Committed directly to `main` as authorized.

## Concerns

- `get_active()` uses `latest("id")`, which returns the most recently created row rather than a strictly "active" singleton. If multiple `YouTubeAppConfig` rows are ever created, this silently returns the last one and will never raise `ObjectDoesNotExist` when rows exist. The brief intentionally defines this behavior (the missing-row case raises via `latest()`), so it matches the spec, but a single-row constraint / `get_or_create` pattern may be warranted in a later task.
- Git warned that `backend/tests/test_oauth_config.py` will have LF converted to CRLF (line-ending normalization). No functional impact.
