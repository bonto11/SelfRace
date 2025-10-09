import os
from dotenv import load_dotenv

load_dotenv(override=False)

def env_required(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"Missing required env var: {key}")
    return val

def env_optional(key: str, default: str | None = None) -> str | None:
    return os.getenv(key, default)


TABLE_ACTIVITIES_SUMMARY = "activities_summary"
TABLE_ACTIVITY_DETAILS   = "activity_details"
TABLE_ACTIVITIES_SPLITS  = "activities_splits"
TABLE_ACTIVITIES_LAPS    = "activities_laps"
TABLE_ACTIVITIES_RAW     = "activities_raw"
TABLE_USERS              = "users"
TABLE_USERS_PROFILE = "users_profile"
TABLE_USERS_STATIC = "users_static"
TABLE_USERS_METRICS = "users_metrics"
TABLE_USERS_ZONES = "users_zones"
TABLE_USERS_THRESHOLDS = "users_thresholds"
TABLE_USERS_BESTS = "users_bests"
TABLE_USERS_RECOVERY = "users_recovery"
TABLE_USERS_NOTES = "users_notes"
TABLE_COACH_FEEDBACK = "coach_feedback"
TABLE_COACH_PREFERENCES = "coach_preferences"

SUPABASE_URL : str = env_required("SUPABASE_URL")
SUPABASE_SERVICE_ROLE : str = env_required("SUPABASE_SERVICE_ROLE")
SUPABASE_ANON_KEY : str = env_required("SUPABASE_ANON_KEY")
CLIENT_ID : str = env_required("STRAVA_CLIENT_ID")
CLIENT_SECRET : str = env_required("STRAVA_CLIENT_SECRET")
STRAVA_BASE = "https://www.strava.com/api/v3"
REDIRECT_URI = "http://localhost:5000/exchange_token"
TOKENS_FILE = "data/tokens.json"

USE_STRAVA_CACHE = "true"
CACHE_DIR = "data/strava_cache"

# dobrovoľný globálny delay medzi requestami (sekundy, napr. 0, 0.5, 1.0…)
REQUEST_DELAY_SECS = 0.3
DEFAULT_MODEL = "gpt-4o-mini"
OPENAI_API_KEY : str = env_required("OPENAI_API_KEY")

