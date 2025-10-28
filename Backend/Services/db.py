# services/db.py
import os
import backend.Configs.config as CFG
from Modules.SQL.db_handler import get_client

# Tabuľky
TABLE_ACTIVITIES_SUMMARY = getattr(CFG, "TABLE_ACTIVITIES_SUMMARY", "activities_summary")
TABLE_USERS_STATIC       = getattr(CFG, "TABLE_USERS_STATIC", "users_static")
TABLE_USERS_METRICS      = getattr(CFG, "TABLE_USERS_METRICS", "users_metrics")
TABLE_USERS_RECOVERY     = getattr(CFG, "TABLE_USERS_RECOVERY", "users_recovery")
TABLE_USERS_NOTES        = getattr(CFG, "TABLE_USERS_NOTES", "users_notes")
TABLE_USERS_BESTS        = getattr(CFG, "TABLE_USERS_BESTS", "users_bests")
TABLE_USERS_THRESHOLDS   = getattr(CFG, "TABLE_USERS_THRESHOLDS", "users_thresholds")
TABLE_USERS_ZONES        = getattr(CFG, "TABLE_USERS_ZONES", "users_zones")
TABLE_COACH_FEEDBACK     = getattr(CFG, "TABLE_COACH_FEEDBACK", "coach_feedback")
TABLE_COACH_PREFS        = getattr(CFG, "TABLE_COACH_PREFERENCES", "coach_preferences")

OPENAI_API_KEY  = os.getenv("OPENAI_API_KEY")
DEFAULT_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
FALLBACK_MODELS = [m.strip() for m in os.getenv("OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini").split(",") if m.strip()]
LLM_TIMEOUT_S   = int(os.getenv("OPENAI_TIMEOUT_S", "25"))
LLM_RETRIES     = int(os.getenv("OPENAI_RETRIES", "2"))

supabase = get_client()