import os
import json
import webbrowser
import requests
import time
from typing import Tuple
from pathlib import Path
from flask import Flask, request
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
REDIRECT_URI = os.getenv("STRAVA_REDIRECT_URI")
TOKENS_FILE = os.getenv("TOKENS_FILE", "data/tokens.json")
STRAVA_BASE = "https://www.strava.com/api/v3"

# --- Cache prepínač ---
USE_STRAVA_CACHE = os.getenv("STRAVA_USE_CACHE", "false").lower() in {"1", "true", "yes", "on"}
CACHE_DIR = Path(os.getenv("STRAVA_CACHE_DIR", "data/strava_cache"))

# Flask iba pre OAuth exchange (lokálne)
app = Flask(__name__)

# -----------------------------
# Cache helpery
# -----------------------------
def _cache_read(path: Path):
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None

def _cache_write(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _maybe_load_or_cache(filename: str, fetch_fn):
    """
    Ak je USE_STRAVA_CACHE=True a cache súbor existuje -> vráti cache.
    Inak zavolá fetch_fn(), výstup uloží do cache a vráti.
    """
    path = CACHE_DIR / filename
    if USE_STRAVA_CACHE:
        cached = _cache_read(path)
        if cached is not None:
            return cached
    data = fetch_fn()
    try:
        _cache_write(path, data)
    except Exception as e:
        print(f"⚠️ Cache write failed for {path}: {e}")
    return data

# ---------- Rate-limit helpery ----------
def _parse_rate_headers(resp) -> Tuple[Tuple[int,int], Tuple[int,int]]:
    """
    Vracia ((used_short, used_long), (limit_short, limit_long))
    Strava hlavičky:
      X-RateLimit-Limit: "100,1000"
      X-RateLimit-Usage: "12,123"
    """
    limit = resp.headers.get("X-RateLimit-Limit", "100,1000")
    usage = resp.headers.get("X-RateLimit-Usage", "0,0")
    ls = tuple(int(x) for x in limit.split(",")) if limit else (100, 1000)
    us = tuple(int(x) for x in usage.split(",")) if usage else (0, 0)
    if len(ls) != 2: ls = (100, 1000)
    if len(us) != 2: us = (0, 0)
    return (us[0], us[1]), (ls[0], ls[1])

def _maybe_sleep_to_respect_limits(resp):
    (used_s, used_l), (lim_s, lim_l) = _parse_rate_headers(resp)
    # jednoduchá ochrana: ak sme nad 90% krátkeho okna, mikro-spánok
    try:
        if lim_s > 0 and (used_s / lim_s) >= 0.9:
            time.sleep(2.0)
    except Exception:
        pass

def _request_json(method: str, url: str, **kwargs):
    """
    Jednotné volanie requests s:
      - raise_for_status
      - jemným rešpektovaním rate limitov (spomalenie pri 90%)
      - exponenciálnym backoffom pri 429
    """
    timeout = kwargs.pop("timeout", 60)
    backoff = 2.0  # sekundy
    last_resp = None
    for _ in range(6):  # 2 + 4 + 8 + 16 + 32 ~ max ~62s
        resp = requests.request(method, url, timeout=timeout, **kwargs)
        last_resp = resp
        if resp.status_code == 429:
            time.sleep(backoff)
            backoff = min(backoff * 2, 60.0)
            continue
        resp.raise_for_status()
        _maybe_sleep_to_respect_limits(resp)
        return resp.json()
    # ak sme sa sem dostali, stále 429 / chyba
    if last_resp is not None:
        last_resp.raise_for_status()
    raise RuntimeError("Request failed without response")

def _is_autolap_window(distances_m: list[float], window: int = 4, target_m: int = 1000, tol_m: int = 50) -> bool:
    """
    True, ak existuje aspoň jedno okno `window` po sebe idúcich úsekov,
    kde všetky majú dĺžku v [target_m - tol_m, target_m + tol_m].
    """
    if len(distances_m) < window:
        return False
    lo, hi = target_m - tol_m, target_m + tol_m
    for i in range(0, len(distances_m) - window + 1):
        chunk = distances_m[i:i+window]
        if all(d is not None and lo <= float(d) <= hi for d in chunk):
            return True
    return False

def _extract_lap_distances(laps: list[dict]) -> list[float]:
    dists = []
    for lap in laps or []:
        d = lap.get("distance")
        if d is None:
            d = lap.get("distance_m")
        dists.append(d)
    return dists

def _is_interval_workout(laps: list[dict], km_target: int = 1000, tol_m: int = 50) -> bool:
    """
    Heuristika:
      - ak sa nájde okno 4 po sebe idúcich ~1 km auto-lapov → NIE je intervalový tréning
      - inak, ak existuje aspoň 3+ lapy a rozsah dĺžok je >= 200 m → považuj za intervalový
      - inak NIE
    """
    dists = [float(d) for d in _extract_lap_distances(laps) if d is not None]
    if len(dists) < 2:
        return False
    if _is_autolap_window(dists, window=4, target_m=km_target, tol_m=tol_m):
        return False
    if len(dists) >= 3 and (max(dists) - min(dists)) >= 200.0:
        return True
    return False

def _fetch_laps_no_cache(activity_id: int, token: str | None = None) -> list | None:
    headers = _auth_headers(token)
    resp = requests.get(
        f"{STRAVA_BASE}/activities/{activity_id}/laps",
        headers=headers,
        timeout=30,
    )
    if resp.status_code == 402:
        return None
    resp.raise_for_status()
    _maybe_sleep_to_respect_limits(resp)
    return resp.json() or []


# -----------------------------
# Token storage (lokálny súbor)
# -----------------------------
def save_tokens(tokens: dict) -> None:
    os.makedirs(os.path.dirname(TOKENS_FILE), exist_ok=True)
    with open(TOKENS_FILE, "w", encoding="utf-8") as f:
        json.dump(tokens, f)
    print("💾 Tokeny uložené.")

def load_tokens() -> dict | None:
    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def refresh_access_token() -> str | None:
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

def get_access_token() -> str | None:
    tokens = load_tokens()
    if tokens:
        now = datetime.now(timezone.utc).timestamp()
        if now < tokens.get("expires_at", 0):
            return tokens.get("access_token")
        return refresh_access_token()
    return None

def _auth_headers(token: str | None = None) -> dict:
    # v cache režime nemusí byť token potrebný, ak už máš uložené súbory
    token = token or get_access_token()
    if not token and not USE_STRAVA_CACHE:
        raise RuntimeError("Chýba Strava access token. Spusť autorizáciu.")
    return {"Authorization": f"Bearer {token}"} if token else {}

# -----------------------------
# OAuth exchange endpoint
# -----------------------------
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
    app.run(port=5000)

# -----------------------------
# Aktivity (zoznam, detail, streamy, laps, zones)
# -----------------------------
def get_activities(token: str | None = None, after_timestamp: int | None = None) -> list[dict]:
    """
    Zoznam aktivít prihláseného atléta.
    after_timestamp = epoch sekundy (UTC). Ak je zadané, Strava vráti len aktivity po tomto čase.
    """
    filename = f"activities_list_after_{after_timestamp or 0}.json"

    def _fetch():
        tok = token or get_access_token()
        if not tok and not USE_STRAVA_CACHE:
            print("🔑 Nie si prihlásený, spúšťam autorizáciu...")
            authorize_user()
            tok2 = get_access_token()
            if not tok2:
                raise RuntimeError("❌ Nepodarilo sa získať access token.")
            tok = tok2

        all_activities: list[dict] = []
        page = 1
        per_page = 200

        while True:
            params = {"per_page": per_page, "page": page}
            if after_timestamp:
                params["after"] = int(after_timestamp)

            activities = _request_json(
                "GET",
                f"{STRAVA_BASE}/athlete/activities",
                headers=_auth_headers(tok),
                params=params,
                timeout=60,
            )

            if not activities:
                break

            all_activities.extend(activities)
            if len(activities) < per_page:
                break
            page += 1

        return all_activities

    return _maybe_load_or_cache(filename, _fetch)

def get_activity_data(activity_id: int, token: str | None = None) -> dict:
    """
    Základný detail aktivity (bez include_all_efforts). Preferuj radšej get_activity_full().
    """
    filename = f"activity_{activity_id}.json"

    def _fetch():
        tok = token or get_access_token()
        return _request_json(
            "GET",
            f"{STRAVA_BASE}/activities/{activity_id}",
            headers=_auth_headers(tok),
            timeout=30,
        )

    return _maybe_load_or_cache(filename, _fetch)

def get_activity_full(activity_id: int, include_all_efforts: bool = True, token: str | None = None) -> dict:
    """
    Kompletný JSON detail aktivity (obsahuje splits_metric, laps, best_efforts, gear, ...).
    """
    filename = f"activity_full_{activity_id}.json"

    def _fetch():
        headers = _auth_headers(token)
        return _request_json(
            "GET",
            f"{STRAVA_BASE}/activities/{activity_id}",
            headers=headers,
            params={"include_all_efforts": "true" if include_all_efforts else "false"},
            timeout=60,
        )

    return _maybe_load_or_cache(filename, _fetch)

def get_activity_detail(activity_id: int, token: str | None = None) -> dict:
    """
    PÔVODNÁ verzia streams – nechávam kvôli spätnému súladu.
    Preferuj novšie get_activity_streams_all().
    """
    filename = f"streams_{activity_id}.json"

    def _fetch():
        tok = token or get_access_token()
        return _request_json(
            "GET",
            f"{STRAVA_BASE}/activities/{activity_id}/streams",
            headers=_auth_headers(tok),
            params={
                "keys": "time,latlng,altitude,heartrate,cadence,velocity_smooth",
                "key_by_type": "true",
            },
            timeout=60,
        )

    return _maybe_load_or_cache(filename, _fetch)

def get_activity_streams_all(activity_id: int, token: str | None = None) -> dict:
    """
    Streamy (time-series). Širšia množina kľúčov:
    time, latlng, distance, altitude, velocity_smooth, heartrate, cadence, watts, temp, grade_smooth, moving
    """
    filename = f"streams_{activity_id}.json"

    def _fetch():
        headers = _auth_headers(token)
        keys = [
            "time",
            "latlng",
            "distance",
            "altitude",
            "velocity_smooth",
            "heartrate",
            "cadence",
            "watts",
            "temp",
            "grade_smooth",
            "moving",
        ]
        return _request_json(
            "GET",
            f"{STRAVA_BASE}/activities/{activity_id}/streams",
            headers=headers,
            params={"keys": ",".join(keys), "key_by_type": "true"},
            timeout=90,
        )

    return _maybe_load_or_cache(filename, _fetch)

def get_activity_laps(activity_id: int, token: str | None = None, filter_autolaps: bool = True) -> list | None:
    """
    Lapy (zariadenie/manuálne/tréningové intervaly).

    Ak filter_autolaps=True a zistíme, že ide o "bežné" auto-lapy (>=4 po sebe ~1 km ± 50 m),
    lapy NEVRACIAME (None) a NEUKLADÁME do cache.
    """
    filename = f"laps_{activity_id}.json"
    cache_path = CACHE_DIR / filename

    # 1) Ak je cache povolená a súbor existuje, vráť ho (už raz sme rozhodli, že tieto lapy stoja za to)
    if USE_STRAVA_CACHE and cache_path.exists():
        cached = _cache_read(cache_path)
        return cached

    # 2) Inak fetchneme zo Stravy
    headers = _auth_headers(token)
    resp = requests.get(
        f"{STRAVA_BASE}/activities/{activity_id}/laps",
        headers=headers,
        timeout=30,
    )
    if resp.status_code == 402:
        # prémiové či niečo ne-dostupné: nechceme hádzať chybu
        return None
    resp.raise_for_status()
    _maybe_sleep_to_respect_limits(resp)
    laps = resp.json() or []

    # 3) Aplikuj filter na auto-lapy (pred uložením cache!)
    if filter_autolaps and _is_autolap_sequence(laps, window=4, target_m=1000, tol_m=50):
        # Bežné auto-lapy -> nechceme ich ani v JSON cache, ani v DB
        print(f"ℹ️  Laps pre activity_id={activity_id} vynechané (auto-lap 1 km ±50 m zistený).")
        return None

    # 4) Ulož cache len ak lapy nechávame
    try:
        _cache_write(cache_path, laps)
    except Exception as e:
        print(f"⚠️ Cache write failed for {cache_path}: {e}")

    return laps


def get_activity_zones(activity_id: int, token: str | None = None) -> list | None:
    """
    Zóny (HR/power). Môže vrátiť 402 Payment Required pri ne-prémiu.
    """
    filename = f"zones_{activity_id}.json"

    def _fetch():
        headers = _auth_headers(token)
        resp = requests.get(
            f"{STRAVA_BASE}/activities/{activity_id}/zones",
            headers=headers,
            timeout=30,
        )
        if resp.status_code == 402:
            return None
        resp.raise_for_status()
        _maybe_sleep_to_respect_limits(resp)
        return resp.json()

    return _maybe_load_or_cache(filename, _fetch)

def decide_laps_or_splits(activity_id: int, token: str | None = None, km_target: int = 1000, tol_m: int = 50):
    """
    Rozhodne, či uložiť LAPS (intervaly) alebo SPLITS (bežné 1 km auto-lapy).
    Vráti dict: {"mode": "laps"|"splits", "laps": list|None, "splits": list|None}

    Pravidlo:
      - ak _is_interval_workout(laps) == True → uložíme iba LAPS (a cache-laps súbor vznikne)
      - inak → uložíme iba SPLITS (a na LAPS kašleme)
    """
    # 1) potrebujeme FULL (kvôli splits) – ten ide cez cache
    full = get_activity_full(activity_id, include_all_efforts=True, token=token)
    splits = full.get("splits_metric") or []

    # 2) načítaj lapy bez cache (len na rozhodovanie)
    laps = _fetch_laps_no_cache(activity_id, token=token) or []

    # 3) rozhodni
    is_interval = _is_interval_workout(laps, km_target=km_target, tol_m=tol_m)

    if is_interval and laps:
        # Uložíme LAPS do cache (aby ďalšie behy nehitovali API)
        try:
            _cache_write(CACHE_DIR / f"laps_{activity_id}.json", laps)
        except Exception as e:
            print(f"⚠️ Cache write failed for laps: {e}")
        return {"mode": "laps", "laps": laps, "splits": None}

    # else → preferuj splits, lapy ani necacheujeme
    return {"mode": "splits", "laps": None, "splits": splits}
