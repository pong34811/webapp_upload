import requests
from urllib.parse import urlencode
from providers.models import FacebookConfig

FB_AUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth"
FB_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
FB_GRAPH_URL = "https://graph.facebook.com/v19.0"
# pages_manage_posts lets us publish videos; pages_show_list lists the pages
SCOPES = "pages_manage_posts,pages_show_list"


def _config():
    try:
        return FacebookConfig.objects.filter(is_active=True).latest("id")
    except FacebookConfig.DoesNotExist:
        raise ValueError("ยังไม่ได้ตั้งค่า Facebook Config ใน Admin")


def build_auth_url(state):
    cfg = _config()
    params = {
        "client_id": cfg.client_id,
        "redirect_uri": cfg.redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
    }
    return f"{FB_AUTH_URL}?{urlencode(params)}"


def exchange_code_for_user_token(code):
    # https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
    cfg = _config()
    resp = requests.get(FB_TOKEN_URL, params={
        "client_id": cfg.client_id,
        "redirect_uri": cfg.redirect_uri,
        "client_secret": cfg.client_secret,
        "code": code,
    })
    try:
        resp.raise_for_status()
    except Exception as e:
        raise ValueError(f"แลกเปลี่ยน token ล้มเหลว: {e}")
    token = resp.json().get("access_token")
    if not token:
        raise ValueError("ไม่ได้รับ access_token จาก Facebook")

    long_resp = requests.get(FB_TOKEN_URL, params={
        "grant_type": "fb_exchange_token",
        "client_id": cfg.client_id,
        "client_secret": cfg.client_secret,
        "fb_exchange_token": token,
    })
    try:
        long_resp.raise_for_status()
    except Exception as e:
        raise ValueError(f"แลกเปลี่ยน long-lived token ล้มเหลว: {e}")
    long_token = long_resp.json().get("access_token")
    if not long_token:
        raise ValueError("ไม่ได้รับ long-lived token จาก Facebook")
    return long_token


def fetch_pages(user_token):
    # /me/accounts returns pages the user manages; tokens here are long-lived
    resp = requests.get(f"{FB_GRAPH_URL}/me/accounts", params={
        "access_token": user_token,
        "fields": "id,name,access_token",
    })
    try:
        resp.raise_for_status()
    except Exception as e:
        raise ValueError(f"ดึงข้อมูล Page ล้มเหลว: {e}")
    data = resp.json().get("data") or []
    if not data:
        raise ValueError("ไม่พบ Page ที่บัญชีนี้เป็น Admin")
    return data
