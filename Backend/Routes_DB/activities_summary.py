# Services/activities_summary.py
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_ACTIVITIES_SUMMARY

supabase = get_client()

FIELDS = (
    "activity_id,name,"
    "sport_type,sport_type_fe,sport_type_ovrd,"
    "distance_m,moving_time_s,average_heartrate_bpm,"
    "date"
)

def db_fetch_summary_since(user_id: int, since_iso: str) -> List[Dict[str, Any]]:
    """
    Číta z activities_summary od since_iso (filter cez stĺpec 'date' – timestampz).
    """
    try:
        rec = (supabase.table(TABLE_ACTIVITIES_SUMMARY)
               .select(FIELDS)
               .eq("user_id", user_id)
               .gte("date", since_iso)
               .order("date", desc=True)
               .execute())
        return rec.data or []
    except Exception:
        return []
    
def db_upsert_activities_summary(rows: List[Dict[str, Any]]) -> None:
    """
    Upsert batch do activities_summary podľa activity_id.
    """
    if not rows:
        return
    supabase.table(TABLE_ACTIVITIES_SUMMARY).upsert(
        rows,
        on_conflict="activity_id",
    ).execute()

def db_get_last_activity_start(user_id: int) -> Optional[datetime]:
    """
    Najnovší dátum uložený v summary (ako aware-UTC datetime).
    V stĺpci 'date' očakávame buď timestamptz
    alebo ISO bez TZ – normalizujeme do UTC.
    """
    res = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
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
) -> Set[int]:
    """
    ID už uložených aktivít od 'since_iso_date' (YYYY-MM-DD).
    """
    out: Set[int] = set()
    res = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
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
) -> List[int]:
    """
    Posledné aktivity pre daného usera od dátumu (YYYY-MM-DD),
    vráti len zoznam activity_id.
    """
    res = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
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
