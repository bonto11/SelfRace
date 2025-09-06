from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
from Modules.SQL.db_handler import get_client
from backend.Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_SPLITS,
    TABLE_ACTIVITIES_LAPS,
    TABLE_USERS_PROFILE,
    TABLE_USERS_ZONES,
    TABLE_USERS_THRESHOLDS,
    TABLE_USERS_BESTS,
    TABLE_USERS_RECOVERY,
)

supabase = get_client()

# =============================
# AI helper funkcie
# =============================

def ai_get_last_week_summary_data(user_id: int) -> list[dict]:
    """
    Načíta aktivity za posledných 7 dní pre daného usera.
    Vráti zoznam summary + ich splits/laps.
    """
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    resp = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
        .select("*")
        .eq("user_id", user_id)
        .gte("date", week_ago.isoformat())
        .order("date", desc=True)
        .execute()
    )
    summaries = resp.data or []

    activities: list[dict] = []
    for s in summaries:
        aid = s["activity_id"]

        splits = (
            supabase.table(TABLE_ACTIVITIES_SPLITS)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", aid)
            .execute()
        ).data or []

        laps = (
            supabase.table(TABLE_ACTIVITIES_LAPS)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", aid)
            .execute()
        ).data or []

        activities.append({"summary": s, "splits": splits, "laps": laps})

    return activities


def ai_get_activities_summary_in_range(
    user_id: int, start_date: str, end_date: str
) -> list[dict]:
    """Vráti všetky riadky z activities_summary pre usera v danom intervale."""
    try:
        resp = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("user_id", user_id)
            .gte("date", start_date)
            .lt("date", end_date)
            .order("date", desc=True)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"❌ ai_get_activities_summary_in_range error: {e}")
        return []


def ai_get_activity_summary(user_id: int, activity_id: int) -> dict | None:
    """Vráti jednu aktivitu podľa activity_id."""
    try:
        resp = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .limit(1)
            .execute()
        )
        return (resp.data or [None])[0]
    except Exception as e:
        print(f"❌ ai_get_activity_summary error: {e}")
        return None


def ai_get_user_profile(user_id: int) -> dict | None:
    """Vráti profil používateľa (výška, váha, VO2max, birth_date atď.)."""
    try:
        resp = (
            supabase.table(TABLE_USERS_PROFILE)
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return (resp.data or [None])[0]
    except Exception as e:
        print(f"❌ ai_get_user_profile error: {e}")
        return None


def ai_get_user_thresholds(user_id: int) -> list[dict]:
    """Vráti všetky prahy (napr. LTHR, FTP, atď.) pre daného používateľa."""
    try:
        resp = (
            supabase.table(TABLE_USERS_THRESHOLDS)
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"❌ ai_get_user_thresholds error: {e}")
        return []


def ai_get_user_zones(user_id: int) -> list[dict]:
    """Vráti HR/pace/watt zóny používateľa."""
    try:
        resp = (
            supabase.table(TABLE_USERS_ZONES)
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"❌ ai_get_user_zones error: {e}")
        return []


def ai_get_user_bests(user_id: int) -> list[dict]:
    """Vráti osobné rekordy (bests) používateľa."""
    try:
        resp = (
            supabase.table(TABLE_USERS_BESTS)
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"❌ ai_get_user_bests error: {e}")
        return []


def ai_get_user_recovery(user_id: int, from_date: str, to_date: str) -> list[dict]:
    """
    Vráti recovery dáta (HRV, RHR, spánok, kofeín, alkohol, atď.)
    medzi from_date a to_date (ISO8601 stringy).
    """
    try:
        resp = (
            supabase.table(TABLE_USERS_RECOVERY)
            .select("*")
            .eq("user_id", user_id)
            .gte("date", from_date)
            .lte("date", to_date)
            .order("date", desc=True)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"❌ ai_get_user_recovery error: {e}")
        return []



# =============================
# LAPS a SPLITS pre AI / analýzu
# =============================

def ai_get_activity_laps(user_id: int, activity_id: int) -> list[dict]:
    """Vráti všetky lapy pre danú aktivitu a používateľa."""
    try:
        resp = (
            supabase.table(TABLE_ACTIVITIES_LAPS)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .order("lap_index", desc=False)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"❌ ai_get_activity_laps error: {e}")
        return []


def ai_get_activity_splits(user_id: int, activity_id: int) -> list[dict]:
    """Vráti všetky splits pre danú aktivitu a používateľa."""
    try:
        resp = (
            supabase.table(TABLE_ACTIVITIES_SPLITS)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .order("split_index", desc=False)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        print(f"❌ ai_get_activity_splits error: {e}")
        return []


def ai_get_full_activity_bundle(user_id: int, activity_id: int) -> dict:
    """
    Vráti kompletný balík dát pre jednu aktivitu:
      - summary
      - laps
      - splits
    """
    try:
        summary = ai_get_activity_summary(user_id, activity_id)
        laps = ai_get_activity_laps(user_id, activity_id)
        splits = ai_get_activity_splits(user_id, activity_id)

        return {"summary": summary, "laps": laps, "splits": splits}
    except Exception as e:
        print(f"❌ ai_get_full_activity_bundle error: {e}")
        return {}
