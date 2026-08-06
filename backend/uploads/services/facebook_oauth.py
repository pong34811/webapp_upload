import requests
from providers.models import FacebookConfig

FB_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
FB_GRAPH_URL = "https://graph.facebook.com/v19.0"


def _config():
    try:
        return FacebookConfig.objects.filter(is_active=True).latest("id")
    except FacebookConfig.DoesNotExist:
        raise ValueError("ยังไม่ได้ตั้งค่า Facebook Config ใน Admin")


def extend_token(cfg, token):
    # server-to-server: no OAuth redirect needed, works on local PC
    resp = requests.get(FB_TOKEN_URL, params={
        "grant_type": "fb_exchange_token",
        "client_id": cfg.client_id,
        "client_secret": cfg.client_secret,
        "fb_exchange_token": token,
    })
    try:
        resp.raise_for_status()
    except Exception as e:
        raise ValueError(f"ยืดอายุ token ล้มเหลว: {e}")
    data = resp.json()
    long_token = data.get("access_token")
    if not long_token:
        raise ValueError("ยืดอายุ token ไม่สำเร็จ: " + str(data))
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


def fetch_page_from_token(page_token):
    # when the token already IS a page token, /me resolves to that page
    resp = requests.get(f"{FB_GRAPH_URL}/me", params={
        "access_token": page_token,
        "fields": "id,name",
    })
    try:
        resp.raise_for_status()
    except Exception as e:
        raise ValueError(f"ตรวจสอบ Page ล้มเหลว: {e}")
    data = resp.json()
    if "id" not in data:
        raise ValueError("ไม่พบ Page จาก token นี้")
    return data
