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

@app.route("/exchange_token")
def exchange_token():
    auth_code = request.args.get("code")
    response = requests.post(
        "https://www.strava.com/api/v3/oauth/token",
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
            "https://www.strava.com/api/v3/athlete/activities",
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
        f"https://www.strava.com/api/v3/activities/{activity_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()

def get_activity_detail(activity_id, token=None):
    token = token or get_access_token()
    
    response = requests.get(
        f"https://www.strava.com/api/v3/activities/{activity_id}/streams",
        params={"keys": "time,latlng,altitude,heartrate,cadence,velocity_smooth", "key_by_type": "true"},
        headers={"Authorization": f"Bearer {token}"}
    )
    response.raise_for_status()
    return response.json()
