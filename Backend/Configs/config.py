import os
from dotenv import load_dotenv
from typing import Dict
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
TABLE_ASYNC_JOBS = "async_jobs"

TABLE_AI_USAGE_EVENTS = "ai_usage_events"
TABLE_AI_WALLET_TRANSACTION = "ai_wallet_transactions"

TABLE_APP_SUBSCRIPTION_TIERS = "app_subscription_tiers"
TABLE_APP_USER_SUBSCRIPTIONS = "app_user_subscriptions"

# --- KONŠTANTY PRE URL (všetko HTTPS) ---
BACKEND_URL: str = env_required("BACKEND_URL")
FRONTEND_URL: str = env_required("FRONTEND_URL")
MAINTENANCE_API_KEY: str = env_required("MAINTENANCE_API_KEY")

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
STRAVA_DEBUG_STREAMS = os.getenv("STRAVA_DEBUG_STREAMS","").lower() in ("1","true","yes")


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
COACH_PLAN_GENERATE_MIN_HORIZON_DAYS = 4
COACH_PLAN_SCAN_HORIZON_DAYS = 120
COACH_PLAN_OVERVIEW_HORIZON_DAYS = 20

# Ako často môžeme „rozbiť“ weekly plán (ochrana pred spamom)
WEEKLY_REPLAN_COOLDOWN_DAYS = 3

# Koľko dní minimálne chceme mať dopredu po weekly repláne
MIN_DAILY_HORIZON_AFTER_WEEKLY = 6


# Koľko detailov (laps/splits) max dotiahnuť v jednej synchronizácii
MAX_FULL_DETAILS_PER_RUN = 150

# koľko dní čakať, kým cron spraví hard delete
DELETE_GRACE_DAYS = 30


WEEKDAY_ORDER: Dict[str, int] = {
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5,
    "Sun": 6,
}

WEEKDAY_TO_ABBR: Dict[int, str] = {
    0: "Mon",
    1: "Tue",
    2: "Wed",
    3: "Thu",
    4: "Fri",
    5: "Sat",
    6: "Sun",
}

STRAVA_MANUAL_IMPORT_DEFAULT_DAYS = 10
STRAVA_MANUAL_IMPORT_AFTER_RECONNECT_DAYS = 7
STRAVA_RECONNECT_COOLDOWN_SECONDS = 24 * 3600