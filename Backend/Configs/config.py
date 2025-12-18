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
TABLE_ACTIVITIES_ENRICHMENT = "activities_enrichment"
TABLE_ACTIVITIES_STREAMS = "activities_streams"
TABLE_ACTIVITIES_SPLITS = "activities_splits"
TABLE_ACTIVITIES_LAPS = "activities_laps"
TABLE_ACTIVITIES_RAW = "activities_raw"
TABLE_USERS = "users"
TABLE_PROFILE_STATIC = "profile_static"
TABLE_PROFILE_METRIC = "profile_metric"
TABLE_USERS_ZONES = "users_zones"
TABLE_USERS_THRESHOLDS = "users_thresholds"
TABLE_USERS_BESTS = "users_bests"
TABLE_USERS_RECOVERY = "users_recovery"
TABLE_USERS_NOTES = "users_notes"
TABLE_COACH_FEEDBACK = "coach_feedback"
TABLE_COACH_ATHLETE_STATE = "coach_athlete_state"
TABLE_COACH_PLAN_DAILY = "coach_plan_daily"
TABLE_COACH_PLAN_WEEKLY = "coach_plan_weekly"
TABLE_COACH_PLAN_META = "coach_plan_meta"
TABLE_COACH_STRENGTH_HISTORY = "coach_strength_history"
TABLE_COACH_EXTERNAL_EVENTS = "coach_external_events"
TABLE_USERS_PREFERENCES = "users_preferences"

SUPABASE_URL: str = env_required("SUPABASE_URL")
SUPABASE_SERVICE_ROLE: str = env_required("SUPABASE_SERVICE_ROLE")
SUPABASE_ANON_KEY: str = env_required("SUPABASE_ANON_KEY")
CLIENT_ID: str = env_required("STRAVA_CLIENT_ID")
CLIENT_SECRET: str = env_required("STRAVA_CLIENT_SECRET")
STRAVA_BASE = "https://www.strava.com/api/v3"
REDIRECT_URI = "http://localhost:5000/exchange_token"
TOKENS_FILE = "data/tokens.json"

USE_STRAVA_CACHE = "true"
CACHE_DIR = "data/strava_cache"

# dobrovoľný globálny delay medzi requestami (sekundy, napr. 0, 0.5, 1.0…)
REQUEST_DELAY_SECS = 0.3
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
FALLBACK_MODELS = [
    m.strip()
    for m in os.getenv(
        "OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini"
    ).split(",")
    if m.strip()
]
LLM_TIMEOUT_S = int(os.getenv("OPENAI_TIMEOUT_S", "25"))
LLM_RETRIES = int(os.getenv("OPENAI_RETRIES", "2"))

COACH_PLAN_MIN_WEEKS = 2
COACH_PLAN_DEAFULT_WEEKS = 6
COACH_PLAN_MAX_WEEKS = 16
COACH_PLAN_GENERATE_MIN_HORIZON_DAYS = 10
COACH_PLAN_OVERVIEW_HORIZON_DAYS = 20
