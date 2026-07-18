# Task 2: Register YouTubeAppConfig in Django Admin

**Files:**
- Modify: `backend/uploads/admin.py`
- Test: manual (admin loads without error) — covered by `manage.py check` in Step2.

**Interfaces:**
- Consumes: `YouTubeAppConfig` from Task 1.
- Produces: Admin page at `/admin/uploads/youtubeappconfig/` for an admin to set client_id/secret/redirect_uri.

- [ ] **Step1: Register the model in admin**

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

- [ ] **Step2: Verify system check passes**

Run: `cd backend && python manage.py check`
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step3: Commit**

```bash
git add backend/uploads/admin.py
git commit -m "feat: register YouTubeAppConfig in Django Admin"
```
