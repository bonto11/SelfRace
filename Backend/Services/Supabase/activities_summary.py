# Services/activities_summary.py
from __future__ import annotations
from typing import List, Dict, Any
from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_ACTIVITIES_SUMMARY

supabase = get_client()

FIELDS = (
    "activity_id,name,"
    "sport_type,sport_type_fe,sport_type_ovrd,"
    "distance_m,moving_time_s,average_heartrate_bpm,average_hr,"
    "date"
)

def fetch_summary_since(user_id: int, since_iso: str) -> List[Dict[str, Any]]:
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