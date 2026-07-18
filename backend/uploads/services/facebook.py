import os
import requests
import logging

logger = logging.getLogger(__name__)

GRAPH_API_URL = "https://graph.facebook.com/v19.0"


def _raise_fb_error(stage, resp):
    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text}
    err = body.get("error", {})
    code = err.get("code")
    msg = err.get("message", resp.text)
    logger.error("Facebook API error [%s]: %s", stage, body)
    if code == 190 or "expired" in msg.lower() or "session" in msg.lower():
        raise ValueError(
            "Access Token ของ Facebook หมดอายุหรือไม่ถูกต้อง กรุณาสร้าง Page Access Token ใหม่ใน Graph Explorer แล้วแก้ไขในหน้า Destinations"
        )
    if code == 100 or "pages_manage_posts" in msg or "publish_video" in msg:
        raise ValueError(
            "Access Token ไม่มีสิทธิ์โพสต์วิดีโอ (ต้องการ pages_manage_posts + publish_video) กรุณาสร้าง Token ใหม่โดยติ๊กสิทธิ์ให้ครบ"
        )
    raise ValueError(f"Facebook API ล้มเหลว ({stage}): {msg}")


def upload_to_facebook(file_path, title, description, access_token, page_id, scheduled_time=None):
    session_url = f"{GRAPH_API_URL}/{page_id}/videos"
    chunk_size = 1024 * 1024 * 4  # 4MB

    file_size = os.path.getsize(file_path)

    resp = requests.post(session_url, data={
        "upload_phase": "start",
        "access_token": access_token,
        "file_size": file_size,
    })
    if resp.status_code != 200:
        _raise_fb_error("start", resp)
    session = resp.json()
    upload_session_id = session.get("upload_session_id")
    if not upload_session_id:
        _raise_fb_error("start_no_session", resp)

    offset = 0
    with open(file_path, "rb") as f:
        while offset < file_size:
            chunk = f.read(chunk_size)
            r = requests.post(session_url, data={
                "upload_phase": "transfer",
                "access_token": access_token,
                "upload_session_id": upload_session_id,
                "start_offset": offset,
            }, files={"video_file_chunk": chunk})
            if r.status_code != 200:
                _raise_fb_error("transfer", r)
            offset += len(chunk)

    finish_data = {
        "upload_phase": "finish",
        "access_token": access_token,
        "upload_session_id": upload_session_id,
        "title": title,
        "description": description,
    }

    if scheduled_time:
        finish_data["scheduled_publish_time"] = int(scheduled_time.timestamp())

    resp = requests.post(session_url, data=finish_data)
    if resp.status_code != 200:
        _raise_fb_error("finish", resp)
    return resp.json().get("id", "")
