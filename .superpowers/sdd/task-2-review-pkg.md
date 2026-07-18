6faa363 feat: register YouTubeAppConfig in Django Admin

 backend/uploads/admin.py | 18 +++++++++++++++---
 1 file changed, 15 insertions(+), 3 deletions(-)

diff --git a/backend/uploads/admin.py b/backend/uploads/admin.py
index 44333ae..3938996 100644
--- a/backend/uploads/admin.py
+++ b/backend/uploads/admin.py
@@ -1,5 +1,17 @@
 from django.contrib import admin
-from .models import Destination, UploadJob
+from .models import Destination, UploadJob, YouTubeAppConfig
 
-admin.site.register(Destination)
-admin.site.register(UploadJob)
+
+@admin.register(Destination)
+class DestinationAdmin(admin.ModelAdmin):
+    list_display = ("platform", "name", "is_active", "created_at")
+
+
+@admin.register(UploadJob)
+class UploadJobAdmin(admin.ModelAdmin):
+    list_display = ("title", "destination", "status", "created_at")
+
+
+@admin.register(YouTubeAppConfig)
+class YouTubeAppConfigAdmin(admin.ModelAdmin):
+    list_display = ("client_id", "redirect_uri")
