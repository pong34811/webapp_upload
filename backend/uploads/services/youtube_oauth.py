import requests
from urllib.parse import urlencode
from django.core.exceptions import ObjectDoesNotExist
from ..models import YouTubeAppConfig

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/channels"
SCOPES = (
    "https://www.googleapis.com/auth/youtube.upload "
    "https://www.googleapis.com/auth/youtube.readonly"
)


def _config():
    try:
        return YouTubeAppConfig.get_active()
    except ObjectDoesNotExist:
        raise ValueError("ยังไม่ได้ตั้งค่า YouTubeAppConfig ใน Admin")


def build_auth_url(state):
    cfg = _config()
    params = {
        "client_id": cfg.client_id,
        "redirect_uri": cfg.redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code_for_tokens(code):
    cfg = _config()
    resp = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": cfg.client_id,
            "client_secret": cfg.client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": cfg.redirect_uri,
        },
    )
    try:
        resp.raise_for_status()
    except Exception as e:
        raise ValueError(f"แลกเปลี่ยน token ล้มเหลว: {e}")
    data = resp.json()
    if "access_token" not in data:
        raise ValueError("ไม่ได้รับ access_token จาก Google")
    return data


def fetch_channel_title(access_token):
    resp = requests.get(
        YOUTUBE_API_URL,
        params={"part": "snippet", "mine": "true"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    try:
        resp.raise_for_status()
    except Exception as e:
        raise ValueError(f"ดึงข้อมูลช่องล้มเหลว: {e}")
    items = resp.json().get("items", [])
    if not items:
        raise ValueError("ไม่พบช่อง YouTube สำหรับบัญชีนี้")
    return items[0]["snippet"]["title"]
