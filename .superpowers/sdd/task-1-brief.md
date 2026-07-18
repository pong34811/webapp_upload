# Task 1: YouTubeAppConfig model + migration

**Files:**
- Create: `backend/uploads/models.py` (modify: add `YouTubeAppConfig` class)
- Create: `backend/uploads/migrations/0003_youtubeappconfig.py`
- Test: `backend/tests/test_oauth_config.py`

**Interfaces:**
- Produces: `YouTubeAppConfig` model with `client_id`, `client_secret`, `redirect_uri`, `get_active()` classmethod returning the single config row (or raising if missing).

- [ ] **Step1: Write the failing test**

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

- [ ] **Step2: Run test to verify it fails**

Run: `cd backend && python manage.py test tests.test_oauth_config`
Expected: FAIL — `YouTubeAppConfig` does not exist.

- [ ] **Step3: Write minimal implementation**

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

- [ ] **Step4: Run test to verify it passes**

Run: `cd backend && python manage.py test tests.test_oauth_config`
Expected: PASS (2 tests).

- [ ] **Step5: Commit**

```bash
git add backend/uploads/models.py backend/uploads/migrations/0003_youtubeappconfig.py backend/tests/test_oauth_config.py
git commit -m "feat: add YouTubeAppConfig model for central OAuth credentials"
```
