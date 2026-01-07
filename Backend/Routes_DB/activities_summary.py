from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_ACTIVITIES_SUMMARY

FIELDS = (
    "activity_id,name,"
    "sport_type,sport_type_fe,sport_type_ovrd,"
    "distance_m,moving_time_s,average_heartrate_bpm,"
    "date"
)

# ───────────────────────────── basic summary helpers ─────────────────────────────

def db_fetch_summary_since(
    user_id: int,
    since_iso: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Číta z activities_summary od since_iso (filter cez 'date').

    - s user_jwt → RLS
    - so service=True → service klient (napr. worker/backfill)
    """
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_summary")
        rec = (
            sb.table(TABLE_ACTIVITIES_SUMMARY)
            .select(FIELDS)
            .eq("user_id", user_id)
            .is_("deleted_at", None)              # ⬅️ ignoruj soft-deleted
            .gte("date", since_iso)
            .order("date", desc=True)
            .execute()
        )
        return rec.data or []
    except Exception:
        return []


def db_upsert_activities_summary(
    rows: List[Dict[str, Any]],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> None:
    """
    Upsert batch do activities_summary podľa activity_id.

    - s user_jwt  → voláš z FE synce (RLS)
    - service=True → webhook/worker (service klient)
    """
    if not rows:
        return
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_summary")
    sb.table(TABLE_ACTIVITIES_SUMMARY).upsert(
        rows,
        on_conflict="activity_id",
    ).execute()


def db_get_last_activity_start(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[datetime]:
    """
    Najnovší dátum uložený v summary (ako aware-UTC datetime).
    Používa sa v sync logike – môže ísť cez RLS aj service.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_summary")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("date")
        .eq("user_id", user_id)
        .is_("deleted_at", None)                  # ⬅️ len aktívne
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    data = res.data or []
    if not data:
        return None

    s = str(data[0].get("date") or "")
    s = s.replace(" ", "T")
    if "+" not in s and "Z" not in s:
        s += "Z"

    try:
        s = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
    except Exception:
        return None


def db_get_existing_activity_ids_since(
    user_id: int,
    since_iso_date: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Set[int]:
    """
    ID už uložených aktivít od 'since_iso_date' (YYYY-MM-DD).
    Sync helper – môže bežať cez RLS aj service.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_summary")
    out: Set[int] = set()
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("activity_id,date")
        .eq("user_id", user_id)
        .is_("deleted_at", None)                  # ⬅️ len ne-deleted
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
    user_id: int,
    since_iso_date: str,
    limit: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[int]:
    """
    Posledné aktivity pre daného usera od dátumu (YYYY-MM-DD),
    vráti len zoznam activity_id.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_summary")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("activity_id")
        .eq("user_id", user_id)
        .is_("deleted_at", None)                  # ⬅️ len ne-deleted
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


# ───────────────────────────── helpers pre FE queries ─────────────────────────────

def db_get_activities_recent(
    user_id: int,
    since_iso_date: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Aktivity od since_iso_date (YYYY-MM-DD) – payload pre FE list / range.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_summary")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id,name,"
            "sport_type,sport_type_fe,sport_type_ovrd,"
            "distance_m,moving_time_s,average_heartrate_bpm,max_heartrate_bpm,date"
        )
        .eq("user_id", user_id)
        .is_("deleted_at", None)                  # ⬅️ skryj deleted
        .gte("date", since_iso_date)
        .order("date", desc=True)
        .execute()
    )
    return res.data or []


def db_get_activity_summary_one(
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Kompletný summary riadok pre jednu aktivitu.

    POZOR: zámerne BEZ filtra na deleted_at.
    Worker/sync potrebuje vidieť aj soft-deleted, aby ich vedel oživiť.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_summary")
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
    user_id: int,
    start_ts_iso: str,
    end_ts_iso: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Aktivity v rozsahu [start_ts_iso, end_ts_iso) podľa 'date'.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_summary")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id,name,"
            "sport_type,sport_type_fe,sport_type_ovrd,"
            "distance_m,moving_time_s,average_heartrate_bpm,max_heartrate_bpm,date"
        )
        .eq("user_id", user_id)
        .is_("deleted_at", None)                  # ⬅️ len aktívne
        .gte("date", start_ts_iso)
        .lt("date", end_ts_iso)
        .order("date", desc=True)
        .execute()
    )
    return res.data or []


def db_select_activities_window_basic(
    user_id: int,
    date_from: str,
    date_to: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
    sports: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Aktivity v okne [date_from, date_to] vrátane (stringy YYYY-MM-DD / ISO),
    filtrované podľa sport_type_fe.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_summary")
    q = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id,name,"
            "sport_type_fe,"
            "date,"
            "distance_m,moving_time_s"
        )
        .eq("user_id", user_id)
        .is_("deleted_at", None)                  # ⬅️ len aktívne
        .gte("date", date_from)
        .lte("date", date_to)
        .order("date", desc=False)
    )
    if sports:
        q = q.in_("sport_type_fe", sports)

    res = q.execute()
    return res.data or []


def db_get_summary_one(
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Minimal summary payload pre /summary/one endpoint.
    (FE detail – deleted aktivity tu už nechceme.)
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_summary")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id,name,date,"
            "distance_m,moving_time_s,"
            "average_heartrate_bpm,max_heartrate_bpm,"
            "sport_type_fe"
        )
        .eq("activity_id", activity_id)
        .is_("deleted_at", None)                  # ⬅️ skryť soft-deleted
        .limit(1)
        .execute()
    )
    data = res.data or []
    return data[0] if data else None


def db_get_summary_for_activities(
    user_id: int,
    activity_ids: List[int],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Základný summary payload pre daného usera a zoznam activity_id.
    Používa sa napr. pri enrichment (zones), Pareto, plan-match atď.
    """
    if not activity_ids:
        return []

    sb = get_sb(user_jwt=user_jwt, service=service, caller ="activities_summary")
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id,"
            "date,"
            "name,"
            "sport_type,sport_type_fe,sport_type_ovrd,"
            "distance_m,moving_time_s,average_heartrate_bpm"
        )
        .eq("user_id", user_id)
        .is_("deleted_at", None)                  # ⬅️ len aktívne
        .in_("activity_id", list(set(activity_ids)))
        .execute()
    )
    return res.data or []