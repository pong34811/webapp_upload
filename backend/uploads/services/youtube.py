import os
import datetime
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2.credentials import Credentials


def upload_to_youtube(file_path, title, description, tags, privacy, access_token, scheduled_time=None):
    credentials = Credentials(token=access_token)
    youtube = build("youtube", "v3", credentials=credentials)

    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": [t.strip() for t in tags.split(",") if t.strip()],
        },
        "status": {
            "privacyStatus": privacy,
        },
    }

    if scheduled_time:
        from django.utils import timezone
        if timezone.is_naive(scheduled_time):
            scheduled_time = timezone.make_aware(scheduled_time, datetime.timezone.utc)
        body["status"]["privacyStatus"] = "private"
        body["status"]["publishAt"] = scheduled_time.isoformat()

    media = MediaFileUpload(file_path, mimetype="video/mp4", resumable=True)

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    response = None
    while response is None:
        status_info, response = request.next_chunk()

    return response["id"]
