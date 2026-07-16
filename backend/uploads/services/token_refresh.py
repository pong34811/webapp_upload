import requests


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def refresh_youtube_access_token(client_id, client_secret, refresh_token):
    resp = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def get_valid_access_token(destination):
    if destination.platform == "youtube" and destination.refresh_token:
        return refresh_youtube_access_token(
            destination.client_id,
            destination.client_secret,
            destination.refresh_token,
        )
    return destination.access_token
