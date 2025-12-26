# Routes_DB/user_thresholds.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_THRESHOLDS


def db_list_user_thresholds_raw(
    user_id: int,
    *,
    user_jwt: str,
) -> List[Dict[str, Any]]:
    """
    Vráti všetky threshold riadky daného usera, zoradené DESC podľa updated_at.
    RLS: používa Supabase client autentifikovaný cez user_jwt.
    """
    sb = get_client(user_jwt=user_jwt)

    try:
        res = (
            sb.table(TABLE_USERS_THRESHOLDS)
            .select(
                "user_id,sport,threshold_type,updated_at,"
                "hr_bpm,pace_sec_km,power_watt,measurement_type"
            )
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception:
        return []


def db_get_user_threshold_latest(
    user_id: int,
    sport: str,
    threshold_type: str,
    *,
    user_jwt: str,
) -> Optional[Dict[str, Any]]:
    """
    Najnovší riadok pre danú kombináciu (user, sport, threshold_type).
    """
    sb = get_client(user_jwt=user_jwt)

    try:
        res = (
            sb.table(TABLE_USERS_THRESHOLDS)
            .select(
                "user_id,sport,threshold_type,updated_at,"
                "hr_bpm,pace_sec_km,power_watt,measurement_type"
            )
            .eq("user_id", user_id)
            .eq("sport", sport)
            .eq("threshold_type", threshold_type)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception:
        return None


def db_upsert_user_threshold(
    user_id: int,
    row: Dict[str, Any],
    *,
    user_jwt: str,
) -> None:
    """
    Zapíše / upsertne threshold riadok.

    Očakáva dict BEZ user_id, ten sa doplní tu.
    Vyžaduje unique index na (user_id,sport,threshold_type).
    """
    sb = get_client(user_jwt=user_jwt)

    payload = {
        "user_id": user_id,
        **row,
    }
    sb.table(TABLE_USERS_THRESHOLDS).upsert(
        payload,
        on_conflict="user_id,sport,threshold_type",
    ).execute()


# alias na starý názov, ak ho máš niekde použítý
def fetch_user_thresholds(
    user_id: int,
    *,
    user_jwt: str,
) -> List[Dict[str, Any]]:
    return db_list_user_thresholds_raw(user_id, user_jwt=user_jwt)