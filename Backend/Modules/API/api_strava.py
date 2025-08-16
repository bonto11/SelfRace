import os
import json
import webbrowser
from flask import Flask, request
import requests
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()
CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
REDIRECT_URI = os.getenv("STRAVA_REDIRECT_URI")
TOKENS_FILE = os.getenv("TOKENS_FILE", "data/tokens.json")
STRAVA_BASE = "https://www.strava.com/api/v3"

app = Flask(__name__)

def save_tokens(tokens):
    os.makedirs(os.path.dirname(TOKENS_FILE), exist_ok=True)
    with open(TOKENS_FILE, "w") as f:
        json.dump(tokens, f)
    print("💾 Tokeny uložené.")

def load_tokens():
    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, "r") as f:
            return json.load(f)
    return None

def refresh_access_token():
    tokens = load_tokens()
    if not tokens:
        return None

    print("🔄 Obnovujem access token...")
    response = requests.post(
        "https://www.strava.com/api/v3/oauth/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": tokens["refresh_token"]
        }
    )
    response.raise_for_status()
    new_tokens = response.json()
    save_tokens(new_tokens)
    return new_tokens["access_token"]

def get_access_token():
    tokens = load_tokens()
    if tokens:
        if datetime.now(timezone.utc).timestamp() < tokens["expires_at"]:
            return tokens["access_token"]
        else:
            return refresh_access_token()
    return None

def _auth_headers(token=None):
    token = token or get_access_token()
    if not token:
        raise RuntimeError("Chýba Strava access token.")
    return {"Authorization": f"Bearer {token}"}

@app.route("/exchange_token")
def exchange_token():
    auth_code = request.args.get("code")
    response = requests.post(
        STRAVA_BASE + "/oauth/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": auth_code,
            "grant_type": "authorization_code"
        }
    )
    response.raise_for_status()
    tokens = response.json()
    save_tokens(tokens)
    return "✅ Prihlásenie úspešné! Môžeš zatvoriť okno."

def authorize_user():
    url = (
        f"https://www.strava.com/oauth/authorize?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code&scope=activity:read_all"
    )
    print("🌐 Otváram Strava prihlasenie v prehliadači...")
    webbrowser.open(url)
    app.run(port=5000)

def get_activities(token=None, after_timestamp=None):
    token = token or get_access_token()
    if not token:
        print("🔑 Nie si prihlásený, spúšťam autorizáciu...")
        authorize_user()
        token = get_access_token()
        if not token:
            raise RuntimeError("❌ Nepodarilo sa získať access token.")

    all_activities = []
    page = 1
    per_page = 200

    while True:
        params = {"per_page": per_page, "page": page}
        if after_timestamp:
            params["after"] = int(after_timestamp)

        response = requests.get(
            "{STRAVA_BASE}/athlete/activities",
            headers={"Authorization": f"Bearer {token}"},
            params=params
        )
        response.raise_for_status()
        activities = response.json()

        if not activities:
            break

        all_activities.extend(activities)
        if len(activities) < per_page:
            break
        page += 1

    return all_activities

def get_activity_data(activity_id, token=None):
    token = token or get_access_token()
    response = requests.get(
        f"{STRAVA_BASE}/activities/{activity_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()

def get_activity_detail(activity_id, token=None):
    token = token or get_access_token()
    
    response = requests.get(
        f"{STRAVA_BASE}/activities/{activity_id}/streams",
        params={"keys": "time,latlng,altitude,heartrate,cadence,velocity_smooth", "key_by_type": "true"},
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()

def get_activity_full(activity_id: int, include_all_efforts: bool = True, token=None):
    """Kompletný JSON detail aktivity (nie streams)."""
    headers = _auth_headers(token)
    resp = requests.get(
        f"{STRAVA_BASE}/activities/{activity_id}",
        headers=headers,
        params={"include_all_efforts": "true" if include_all_efforts else "false"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()

def get_activity_streams_all(activity_id: int, token=None):
    """
    Streamy – Strava vyžaduje zoznam kľúčov; dáme 'široký' set.
    Kľúče, ktoré bežne existujú: time, latlng, distance, altitude, velocity_smooth,
    heartrate, cadence, watts, temp, grade_smooth, moving.
    """
    headers = _auth_headers(token)
    keys = [
        "time", "latlng", "distance", "altitude", "velocity_smooth",
        "heartrate", "cadence", "watts", "temp", "grade_smooth", "moving"
    ]
    resp = requests.get(
        f"{STRAVA_BASE}/activities/{activity_id}/streams",
        headers=headers,
        params={"keys": ",".join(keys), "key_by_type": "true"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()

def get_activity_laps(activity_id: int, token=None):
    headers = _auth_headers(token)
    resp = requests.get(f"{STRAVA_BASE}/activities/{activity_id}/laps", headers=headers, timeout=30)
    
     # Špeciálne ošetrenie prémiových dát
    if resp.status_code == 402:
        # nemáš prístup k zones – vrátime None a necháme volajúceho pokračovať
        return None
    
    resp.raise_for_status()
    return resp.json()

def get_activity_zones(activity_id: int, token=None):
    headers = _auth_headers(token)
    resp = requests.get(f"{STRAVA_BASE}/activities/{activity_id}/zones", headers=headers, timeout=30)
    
     # Špeciálne ošetrenie prémiových dát
    if resp.status_code == 402:
        # nemáš prístup k zones – vrátime None a necháme volajúceho pokračovať
        return None
    
    resp.raise_for_status()
    return resp.json()