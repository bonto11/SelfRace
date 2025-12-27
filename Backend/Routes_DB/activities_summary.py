from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_ACTIVITIES_SUMMARY

# Poznámka:
# - funkcie, ktoré číta FE/AI → user_jwt, RLS klient
# - sync/import (upsert) – zatiaľ voláme z manuálneho syncu tiež s JWT


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
    user_jwt: str,
) -> List[Dict[str, Any]]:
    """
    Číta z activities_summary od since_iso (filter cez 'date').
    RLS: vyžaduje user_jwt.
    """
    try:
        sb = get_client(user_jwt=user_jwt)
        rec = (
            sb.table(TABLE_ACTIVITIES_SUMMARY)
            .select(FIELDS)
            .eq("user_id", user_id)
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
    user_jwt: str,
) -> None:
    """
    Upsert batch do activities_summary podľa activity_id.
    Zatiaľ používané z manuálneho syncu → RLS klient.
    (Keď spravíme worker, urobíme separátnu SERVICE verziu.)
    """
    if not rows:
        return
    sb = get_client(user_jwt=user_jwt)
    sb.table(TABLE_ACTIVITIES_SUMMARY).upsert(
        rows,
        on_conflict="activity_id",
    ).execute()


def db_get_last_activity_start(
    user_id: int,
    *,
    user_jwt: str,
) -> Optional[datetime]:
    """
    Najnovší dátum uložený v summary (ako aware-UTC datetime).
    Používa sa v sync logike – zatiaľ RLS/JWT.
    """
    sb = get_client(user_jwt=user_jwt)
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("date")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    data = res.data or []
    if not data:
        return None

    s = str(data[0].get("date") or "")
    # môže prísť "2025-09-06 20:03:34+00" alebo "2025-09-06T20:03:34"
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
    user_jwt: str,
) -> Set[int]:
    """
    ID už uložených aktivít od 'since_iso_date' (YYYY-MM-DD).
    Sync helper – RLS.
    """
    sb = get_client(user_jwt=user_jwt)
    out: Set[int] = set()
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("activity_id,date")
        .eq("user_id", user_id)
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
    user_jwt: str,
) -> List[int]:
    """
    Posledné aktivity pre daného usera od dátumu (YYYY-MM-DD),
    vráti len zoznam activity_id.
    Sync helper – RLS.
    """
    sb = get_client(user_jwt=user_jwt)
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("activity_id")
        .eq("user_id", user_id)
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
    user_jwt: str,
) -> List[Dict[str, Any]]:
    """
    Aktivity od since_iso_date (YYYY-MM-DD) – payload pre FE list / range.
    RLS only.
    """
    sb = get_client(user_jwt=user_jwt)
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id,name,"
            "sport_type,sport_type_fe,sport_type_ovrd,"
            "distance_m,moving_time_s,average_heartrate_bpm,max_heartrate_bpm,date"
        )
        .eq("user_id", user_id)
        .gte("date", since_iso_date)
        .order("date", desc=True)
        .execute()
    )
    return res.data or []


def db_get_activity_summary_one(
    activity_id: int,
    *,
    user_jwt: str,
) -> Optional[Dict[str, Any]]:
    """
    Kompletný summary riadok pre jednu aktivitu.
    RLS: vyfiltruje len tvoje activity_id podľa policies.
    """
    sb = get_client(user_jwt=user_jwt)
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
    user_jwt: str,
) -> List[Dict[str, Any]]:
    """
    Aktivity v rozsahu [start_ts_iso, end_ts_iso) podľa 'date'.
    """
    sb = get_client(user_jwt=user_jwt)
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id,name,"
            "sport_type,sport_type_fe,sport_type_ovrd,"
            "distance_m,moving_time_s,average_heartrate_bpm,max_heartrate_bpm,date"
        )
        .eq("user_id", user_id)
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
    user_jwt: str,
    sports: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Aktivity v okne [date_from, date_to] vrátane (stringy YYYY-MM-DD / ISO),
    filtrované podľa sport_type_fe.
    """
    sb = get_client(user_jwt=user_jwt)
    q = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id,name,"
            "sport_type_fe,"
            "date,"
            "distance_m,moving_time_s"
        )
        .eq("user_id", user_id)
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
    user_jwt: str,
) -> Optional[Dict[str, Any]]:
    """
    Minimal summary payload pre /summary/one endpoint.
    """
    sb = get_client(user_jwt=user_jwt)
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id,name,date,"
            "distance_m,moving_time_s,"
            "average_heartrate_bpm,max_heartrate_bpm,"
            "sport_type_fe"
        )
        .eq("activity_id", activity_id)
        .limit(1)
        .execute()
    )
    data = res.data or []
    return data[0] if data else None


def db_get_summary_for_activities(
    user_id: int,
    activity_ids: List[int],
    *,
    user_jwt: str,
) -> List[Dict[str, Any]]:
    """
    Základný summary payload pre daného usera a zoznam activity_id.
    Používa sa napr. pri enrichment (zones), Pareto, plan-match atď.
    """
    if not activity_ids:
        return []

    sb = get_client(user_jwt=user_jwt)
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
        .in_("activity_id", list(set(activity_ids)))
        .execute()
    )
    return res.data or []