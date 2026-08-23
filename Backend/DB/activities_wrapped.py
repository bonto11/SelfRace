# DB/activities_wrapped.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_service_client
from Modules.Supabase.auth import AuthCtx
from Configs.config import (
    TABLE_ACTIVITIES_WRAPPED_TRIGGERS,
    TABLE_ACTIVITIES_WRAPPED_SUMMARIES,
)

_sb = get_service_client()


# ---------- TRIGGERS ----------

def db_insert_activities_wrapped_trigger(
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    try:
        res = _sb.table(TABLE_ACTIVITIES_WRAPPED_TRIGGERS).insert(row).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-ACTIVITIES-WRAPPED] insert_trigger error:", repr(e))
        return None


def db_get_active_trigger_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        res = (
            _sb.table(TABLE_ACTIVITIES_WRAPPED_TRIGGERS)
            .select("*")
            .eq("user_id", user_id)
            .gte("expires_at", now_iso)
            .order("expires_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-ACTIVITIES-WRAPPED] get_active_trigger error:", repr(e))
        return None


def db_get_latest_trigger_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """Posledný trigger bez ohľadu na to, či je ešte platný - pre admin zobrazenie stavu."""
    try:
        res = (
            _sb.table(TABLE_ACTIVITIES_WRAPPED_TRIGGERS)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-ACTIVITIES-WRAPPED] get_latest_trigger error:", repr(e))
        return None


def db_trigger_exists(
    *,
    user_id: int,
    reason: str,
    trigger_label: Optional[str],
    trigger_date: Optional[str],
    ctx: AuthCtx,
) -> bool:
    """Poistka proti duplicitnému vytváraniu triggerov pri opakovanom behu cronu."""
    try:
        q = (
            _sb.table(TABLE_ACTIVITIES_WRAPPED_TRIGGERS)
            .select("id")
            .eq("user_id", user_id)
            .eq("reason", reason)
        )
        if trigger_label is not None:
            q = q.eq("trigger_label", trigger_label)
        if trigger_date is not None:
            q = q.eq("trigger_date", trigger_date)
        res = q.limit(1).execute()
        return bool(res.data)
    except Exception as e:  # noqa: BLE001
        print("[DB-ACTIVITIES-WRAPPED] trigger_exists error:", repr(e))
        return False


# ---------- SUMMARIES ----------

def db_insert_activities_wrapped_summary(
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    try:
        res = _sb.table(TABLE_ACTIVITIES_WRAPPED_SUMMARIES).insert(row).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-ACTIVITIES-WRAPPED] insert_summary error:", repr(e))
        return None


def db_list_activities_wrapped_summaries_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    try:
        res = (
            _sb.table(TABLE_ACTIVITIES_WRAPPED_SUMMARIES)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-ACTIVITIES-WRAPPED] list_summaries error:", repr(e))
        return []


def db_get_activities_wrapped_summary_by_id(
    summary_id: int,
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    try:
        res = (
            _sb.table(TABLE_ACTIVITIES_WRAPPED_SUMMARIES)
            .select("*")
            .eq("id", summary_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-ACTIVITIES-WRAPPED] get_summary_by_id error:", repr(e))
        return None


# ---------- CRON HELPER: všetci useri s prefs ----------

def db_list_all_user_ids_with_prefs(*, ctx: AuthCtx) -> List[int]:
    try:
        res = (
            _sb.table("users_preferences")
            .select("user_id")
            .eq("key", "coach.prefs")
            .execute()
        )
        return list({int(r["user_id"]) for r in (res.data or []) if r.get("user_id")})
    except Exception as e:  # noqa: BLE001
        print("[DB-ACTIVITIES-WRAPPED] list_all_user_ids error:", repr(e))
        return []