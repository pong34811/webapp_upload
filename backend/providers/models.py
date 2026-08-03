from django.db import models

class BaseProviderConfig(models.Model):
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class YouTubeConfig(BaseProviderConfig):
    client_id = models.CharField(max_length=255, help_text="Google OAuth Client ID")
    client_secret = models.TextField(help_text="Google OAuth Client Secret")
    redirect_uri = models.URLField(help_text="Google OAuth Redirect URI")

    class Meta:
        verbose_name = "YouTube Configuration"
        verbose_name_plural = "YouTube Configurations"

    def __str__(self):
        return f"YouTube Config ({self.client_id})"



class TikTokConfig(BaseProviderConfig):
    client_key = models.CharField(max_length=255, help_text="TikTok Client Key")
    client_secret = models.TextField(help_text="TikTok Client Secret")
    redirect_uri = models.URLField(help_text="TikTok Redirect URI")
    
    class Meta:
        verbose_name = "TikTok Configuration"
        verbose_name_plural = "TikTok Configurations"

    def __str__(self):
        return f"TikTok Config ({self.client_key})"
