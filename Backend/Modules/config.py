import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

def env_required(key: str) -> str:
    val = os.getenv(key)
    if val is None:
        raise RuntimeError(f"Missing required env var: {key}")
    return val

TABLE_ACTIVITIES_SUMMARY = env_required("TABLE_ACTIVITIES_SUMMARY")
TABLE_ACTIVITY_DETAILS = env_required("TABLE_ACTIVITY_DETAILS")
TABLE_ACTIVITIES_SPLITS = env_required("TABLE_ACTIVITIES_SPLITS")
TABLE_ACTIVITIES_LAPS = env_required("TABLE_ACTIVITIES_LAPS")
TABLE_ACTIVITIES_RAW = env_required("TABLE_ACTIVITIES_RAW")
TABLE_USERS = env_required("TABLE_USERS")
TABLE_USERS_PROFILE = env_required("TABLE_USERS_PROFILE")
TABLE_USERS_STATIC = env_required("TABLE_USERS_STATIC")
TABLE_USERS_METRICS = env_required("TABLE_USERS_METRICS")
TABLE_USERS_ZONES = env_required("TABLE_USERS_ZONES")
TABLE_USERS_THRESHOLDS = env_required("TABLE_USERS_THRESHOLDS")
TABLE_USERS_BESTS = env_required("TABLE_USERS_BESTS")
TABLE_USERS_RECOVERY = env_required("TABLE_USERS_RECOVERY")
TABLE_USERS_NOTES = env_required("TABLE_USERS_NOTES")

SUPABASE_URL = env_required("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = env_required("SUPABASE_SERVICE_ROLE")
SUPABASE_ANON_KEY = env_required("SUPABASE_ANON_KEY")

STRAVA_BASE = os.getenv("STRAVA_BASE")
CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
REDIRECT_URI = os.getenv("STRAVA_REDIRECT_URI")
TOKENS_FILE = os.getenv("TOKENS_FILE", "data/tokens.json")

USE_STRAVA_CACHE = os.getenv("STRAVA_USE_CACHE", "false").lower() in {"1", "true", "yes", "on"}
CACHE_DIR = Path(os.getenv("STRAVA_CACHE_DIR", "data/strava_cache"))

# dobrovoľný globálny delay medzi requestami (sekundy, napr. 0, 0.5, 1.0…)
REQUEST_DELAY_SECS = float(os.getenv("STRAVA_REQUEST_DELAY", "0"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")