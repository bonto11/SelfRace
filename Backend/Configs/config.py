# backend/Configs/config.py
from __future__ import annotations

import os
from typing import Dict, List, Optional

from dotenv import load_dotenv

# =============================================================================
# ENV LOADING
# - Railway injectuje env priamo; .env je primárne pre local dev.
# - override=False = ak Railway nastaví env, lokálny .env to neprepíše.
# =============================================================================
load_dotenv(override=False)


# =============================================================================
# ENV HELPERS
# =============================================================================
def env_required(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"Missing required env var: {key}")
    return val


def env_optional(key: str, default: Optional[str] = None) -> Optional[str]:
    return os.getenv(key, default)


def env_bool(key: str, default: bool = False) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "y", "on")


def env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except Exception:
        return default


def env_float(key: str, default: float) -> float:
    raw = os.getenv(key)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except Exception:
        return default


def _csv_list(env_value: Optional[str], default: str) -> List[str]:
    raw = (env_value or default).strip()
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    # uniq keep order
    out: List[str] = []
    for p in parts:
        if p not in out:
            out.append(p)
    return out


# =============================================================================
# DB TABLE NAMES
# =============================================================================
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
TABLE_USERS_PREFERENCES = "users_preferences"

TABLE_COACH_FEEDBACK = "coach_feedback"
TABLE_COACH_ATHLETE_STATE = "coach_athlete_state"
TABLE_COACH_PLAN_DAILY = "coach_plan_daily"
TABLE_COACH_PLAN_WEEKLY = "coach_plan_weekly"
TABLE_COACH_PLAN_META = "coach_plan_meta"
TABLE_COACH_STRENGTH_HISTORY = "coach_strength_history"
TABLE_COACH_EXTERNAL_EVENTS = "coach_external_events"

TABLE_STRAVA_ACCOUNTS = "strava_accounts"
TABLE_ACCOUNT_DELETE_REQ = "account_delete_requests"
TABLE_ASYNC_JOBS = "async_jobs"

TABLE_AI_USAGE_EVENTS = "ai_usage_events"
TABLE_AI_WALLET_TRANSACTION = "ai_wallet_transactions"

TABLE_APP_SUBSCRIPTION_TIERS = "app_subscription_tiers"
TABLE_APP_USER_SUBSCRIPTIONS = "app_user_subscriptions"


# =============================================================================
# CORE URLS + SECRETS (required)
# =============================================================================
BACKEND_URL: str = env_required("BACKEND_URL")
FRONTEND_URL: str = env_required("FRONTEND_URL")
MAINTENANCE_API_KEY: str = env_required("MAINTENANCE_API_KEY")

SUPABASE_URL: str = env_required("SUPABASE_URL")
SUPABASE_SERVICE_ROLE: str = env_required("SUPABASE_SERVICE_ROLE")
SUPABASE_ANON_KEY: str = env_required("SUPABASE_ANON_KEY")

INTERNAL_SERVICE_SECRET: str = env_required("SUPABASE_URL")
# =============================================================================
# STRAVA
# =============================================================================
STRAVA_BASE = "https://www.strava.com/api/v3"

STRAVA_CLIENT_ID: str = env_required("STRAVA_CLIENT_ID")
STRAVA_CLIENT_SECRET: str = env_required("STRAVA_CLIENT_SECRET")

REDIRECT_URI = env_optional("STRAVA_REDIRECT_URI", "http://localhost:5000/exchange_token")
TOKENS_FILE = env_optional("STRAVA_TOKENS_FILE", "data/tokens.json")

USE_STRAVA_CACHE = False
CACHE_DIR = "data/strava_cache"
STRAVA_DEBUG_STREAMS = env_bool("STRAVA_DEBUG_STREAMS", default=False)

REQUEST_DELAY_SECS = 0.3
STRAVA_RECONNECT_COOLDOWN_SECONDS = 24 * 3600

STRAVA_MANUAL_IMPORT_DEFAULT_DAYS = 10
STRAVA_MANUAL_IMPORT_AFTER_RECONNECT_DAYS = 1200


# =============================================================================
# AI PROVIDER SELECTION + KEYS
# =============================================================================
AI_PROVIDER = (os.getenv("AI_PROVIDER", "openai") or "openai").strip().lower()

OPENAI_API_KEY = env_optional("OPENAI_API_KEY")
GEMINI_API_KEY = env_optional("GEMINI_API_KEY")


# =============================================================================
# GLOBAL LLM TUNING
# =============================================================================
LLM_TIMEOUT_S = env_int("LLM_TIMEOUT_S", 90)
LLM_RETRIES = env_int("LLM_RETRIES", 2)
LLM_MAX_TOKENS = env_int("LLM_MAX_TOKENS", 4000)
LLM_TEMPERATURE = env_float("LLM_TEMPERATURE", 0.2)


# =============================================================================
# MODEL DEFAULTS + FALLBACKS
# =============================================================================
OPENAI_DEFAULT_MODEL = (
    env_optional("OPENAI_DEFAULT_MODEL")
    or env_optional("OPENAI_MODEL")
    or "gpt-4o-mini"
)

OPENAI_MODEL_FALLBACKS = _csv_list(
    env_optional("OPENAI_MODEL_FALLBACKS"),
    default=OPENAI_DEFAULT_MODEL,
)

GEMINI_DEFAULT_MODEL = (
    env_optional("GEMINI_DEFAULT_MODEL", "gemini-1.5-flash-latest")
    or "gemini-1.5-flash-latest"
)

GEMINI_MODEL_FALLBACKS = _csv_list(
    env_optional("GEMINI_MODEL_FALLBACKS"),
    default=GEMINI_DEFAULT_MODEL,
)


# =============================================================================
# COACH / PLANS
# =============================================================================
COACH_PLAN_MIN_WEEKS = 2
COACH_PLAN_DEFAULT_WEEKS = 6
COACH_PLAN_MAX_WEEKS = 16

COACH_PLAN_GENERATE_MIN_HORIZON_DAYS = 4
COACH_PLAN_SCAN_HORIZON_DAYS = 120
COACH_PLAN_OVERVIEW_HORIZON_DAYS = 20

WEEKLY_REPLAN_COOLDOWN_DAYS = 3
MIN_DAILY_HORIZON_AFTER_WEEKLY = 6


# =============================================================================
# SYNC / ENRICHMENT LIMITS
# =============================================================================
MAX_FULL_DETAILS_PER_RUN = 150
DELETE_GRACE_DAYS = env_int("DELETE_GRACE_DAYS", 7)

FIRST_SYNC_DAYS = 365
FIRST_SYNC_MAX = 200

RECONNECT_DAYS = 30
RECONNECT_MAX = 20

QUICK_DAYS = 14
QUICK_MAX = 10

MANUAL_DAYS = 30
MANUAL_MAX = 100


# =============================================================================
# WEEKDAY MAPS
# =============================================================================
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

# legacy typo alias (ak niekde ešte svieti)
COACH_PLAN_DEAFULT_WEEKS = COACH_PLAN_DEFAULT_WEEKS

