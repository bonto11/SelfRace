# Routes_DB/activities_summary.py
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_ACTIVITIES_SUMMARY

FIELDS = (
    "activity_id,name,date,"
    "sport_type,sport_type_fe,sport_type_ovrd,"
    "distance_m,moving_time_s,elapsed_time_s,"
    "average_speed_mps,max_speed_mps,"
    "average_heartrate_bpm,max_heartrate_bpm,"
    "elevation_gain_m,elev_high_m,elev_low_m,"
    "average_cadence_rpm,average_temp_c,"
    "average_watts,max_watts,"
    "calories_kcal,achievement_count,pr_count,"
    "gear_id,gear_name,"
    "timezone,utc_offset_s"
)


def db_fetch_summary_since(
    ctx: AuthCtx, user_id: int, since_iso: str
) -> List[Dict[str, Any]]:
    try:
        sb = get_sb(ctx, caller="activities_summary.db_fetch_summary_since")
        rec = (
            sb.table(TABLE_ACTIVITIES_SUMMARY)
            .select(FIELDS)
            .eq("user_id", user_id)
            .is_("deleted_at", None)
            .gte("date", since_iso)
            .order("date", desc=True)
            .execute()
        )
        return rec.data or []
    except Exception:
        return []


def db_upsert_activities_summary(ctx: AuthCtx, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return
    sb = get_sb(ctx, caller="activities_summary.db_upsert_activities_summary")
    sb.table(TABLE_ACTIVITIES_SUMMARY).upsert(rows, on_conflict="activity_id").execute()


def db_get_last_activity_start(ctx: AuthCtx, user_id: int) -> Optional[datetime]:
    sb = get_sb(ctx, caller="activities_summary.db_get_last_activity_start")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("date")
        .eq("user_id", user_id)
        .is_("deleted_at", None)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    data = res.data or []
    if not data:
        return None

    s = str(data[0].get("date") or "").replace(" ", "T")
    if "+" not in s and "Z" not in s:
        s += "Z"

    try:
        s = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def db_get_existing_activity_ids_since(
    ctx: AuthCtx, user_id: int, since_iso_date: str
) -> Set[int]:
    sb = get_sb(ctx, caller="activities_summary.db_get_existing_activity_ids_since")
    out: Set[int] = set()
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("activity_id,date")
        .eq("user_id", user_id)
        .is_("deleted_at", None)
        .gte("date", since_iso_date)
        .execute()
    )
    for r in res.data or []:
        try:
            out.add(int(r["activity_id"]))
        except Exception:
            pass
    return out


def db_get_recent_activity_ids(
    ctx: AuthCtx, user_id: int, since_iso_date: str, limit: int
) -> List[int]:
    sb = get_sb(ctx, caller="activities_summary.db_get_recent_activity_ids")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("activity_id")
        .eq("user_id", user_id)
        .is_("deleted_at", None)
        .gte("date", since_iso_date)
        .order("date", desc=True)
        .limit(limit)
        .execute()
    )
    ids: List[int] = []
    for r in res.data or []:
        try:
            ids.append(int(r["activity_id"]))
        except Exception:
            pass
    return ids


def db_get_activities_recent(
    ctx: AuthCtx, user_id: int, since_iso_date: str
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="activities_summary.db_get_activities_recent")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("*")
        .eq("user_id", user_id)
        .is_("deleted_at", None)
        .gte("date", since_iso_date)
        .order("date", desc=True)
        .execute()
    )
    return res.data or []


def db_get_activity_summary_one(
    ctx: AuthCtx, activity_id: int
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="activities_summary.db_get_activity_summary_one")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("*")
        .eq("activity_id", activity_id)
        .limit(1)
        .execute()
    )
    data = res.data or []
    return data[0] if data else None


def db_get_activities_in_range_basic(
    ctx: AuthCtx, user_id: int, start_ts_iso: str, end_ts_iso: str
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="activities_summary.db_get_activities_in_range_basic")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("*")
        .eq("user_id", user_id)
        .is_("deleted_at", None)
        .gte("date", start_ts_iso)
        .lt("date", end_ts_iso)
        .order("date", desc=True)
        .execute()
    )
    return res.data or []


def db_select_activities_window_basic(
    ctx: AuthCtx,
    user_id: int,
    date_from: str,
    date_to: str,
    sports: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="activities_summary.db_select_activities_window_basic")
    q = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("*")
        .eq("user_id", user_id)
        .is_("deleted_at", None)
        .gte("date", date_from)
        .lte("date", date_to)
        .order("date", desc=False)
    )
    if sports:
        q = q.in_("sport_type_fe", sports)

    res = q.execute()
    return res.data or []


def db_get_summary_one(ctx: AuthCtx, activity_id: int) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="activities_summary.db_get_summary_one")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("*")
        .eq("activity_id", activity_id)
        .is_("deleted_at", None)
        .limit(1)
        .execute()
    )
    data = res.data or []
    return data[0] if data else None


def db_get_summary_for_activities(
    ctx: AuthCtx, user_id: int, activity_ids: List[int]
) -> List[Dict[str, Any]]:
    if not activity_ids:
        return []
    sb = get_sb(ctx, caller="activities_summary.db_get_summary_for_activities")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("*")
        .eq("user_id", user_id)
        .is_("deleted_at", None)
        .in_("activity_id", list(set(activity_ids)))
        .execute()
    )
    return res.data or []

def db_fetch_window_activity_ids(
    *,
    user_id: int,
    window_days: int,
    ctx: AuthCtx,
    limit: int = 200,
) -> List[int]:
    """
    Vráti activity_id za posledných `window_days` dní (vrátane dneška), od najnovších po najstaršie.
    - deleted_at IS NULL
    - date >= since_iso
    """
    try:
        sb = get_sb(ctx, caller="activities_summary.db_fetch_window_activity_ids")

        since = datetime.now(timezone.utc) - timedelta(days=int(window_days))
        since_iso = since.isoformat()

        res = (
            sb.table(TABLE_ACTIVITIES_SUMMARY)
            .select("activity_id,date")
            .eq("user_id", int(user_id))
            .is_("deleted_at", None)
            .gte("date", since_iso)
            .order("date", desc=True)
            .limit(int(limit))
            .execute()
        )

        ids: List[int] = []
        for r in res.data or []:
            try:
                ids.append(int(r["activity_id"]))
            except Exception:
                pass
        return ids
    except Exception:
        return []