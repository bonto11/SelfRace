import json
import os
import webbrowser
from flask import Flask, request
from datetime import datetime, timezone
import requests
from typing import Optional

from .config import CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, TOKENS_FILE, STRAVA_BASE


def save_tokens(tokens: dict) -> None:
    os.makedirs(os.path.dirname(TOKENS_FILE), exist_ok=True)
    with open(TOKENS_FILE, "w", encoding="utf-8") as f:
        json.dump(tokens, f)
    print("💾 Tokeny uložené.")


def load_tokens() -> Optional[dict]:
    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def refresh_access_token() -> Optional[str]:
    tokens = load_tokens()
    if not tokens:
        return None
    print("🔄 Obnovujem access token...")
    resp = requests.post(
        f"{STRAVA_BASE}/oauth/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": tokens["refresh_token"],
        },
        timeout=30,
    )
    resp.raise_for_status()
    new_tokens = resp.json()
    save_tokens(new_tokens)
    return new_tokens.get("access_token")


def get_access_token() -> Optional[str]:
    tokens = load_tokens()
    if tokens:
        now = datetime.now(timezone.utc).timestamp()
        if now < tokens.get("expires_at", 0):
            return tokens.get("access_token")
        return refresh_access_token()
    return None


def _auth_headers(token: Optional[str] = None) -> dict:
    token = token or get_access_token()
    if not token:
        raise RuntimeError("Chýba Strava access token. Spusť autorizáciu.")
    return {"Authorization": f"Bearer {token}"}


def register_exchange_token_route(app: Flask) -> None:
    @app.route("/exchange_token")
    def exchange_token():
        auth_code = request.args.get("code")
        if not auth_code:
            return "❌ Chýba 'code' v query stringu.", 400

        resp = requests.post(
            f"{STRAVA_BASE}/oauth/token",
            data={
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "code": auth_code,
                "grant_type": "authorization_code",
            },
            timeout=30,
        )
        resp.raise_for_status()
        tokens = resp.json()
        save_tokens(tokens)
        return "✅ Prihlásenie úspešné! Môžeš zatvoriť okno."


def authorize_user() -> None:
    url = (
        "https://www.strava.com/oauth/authorize"
        f"?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=read_all,activity:read_all"
        f"&approval_prompt=auto"
    )
    print("🌐 Otváram Strava prihlásenie v prehliadači...")
    webbrowser.open(url)
