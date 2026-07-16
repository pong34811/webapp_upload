import os
import requests

GRAPH_API_URL = "https://graph.facebook.com/v19.0"


def upload_to_facebook(file_path, title, description, access_token, page_id, scheduled_time=None):
    session_url = f"{GRAPH_API_URL}/{page_id}/videos"
    chunk_size = 1024 * 1024 * 4  # 4MB

    file_size = os.path.getsize(file_path)

    resp = requests.post(session_url, data={
        "upload_phase": "start",
        "access_token": access_token,
        "file_size": file_size,
    })
    resp.raise_for_status()
    session = resp.json()
    upload_session_id = session["upload_session_id"]

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
            r.raise_for_status()
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
    resp.raise_for_status()
    return resp.json().get("id", "")
