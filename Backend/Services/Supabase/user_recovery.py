# Services/user_recovery.py
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_RECOVERY

supabase = get_client()

def fetch_recent_recovery(user_id: int, days: int = 21) -> List[dict]:
    """
    Posledných N dní z tabuľky recovery (ľahký payload pre FE/AI).
    """
    try:
        since = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
        res = (
            supabase.table(TABLE_USERS_RECOVERY)
            .select("date,RHR_bpm,HRV_avg_ms,sleep_duration_min,food_2h_before,caffeine_8h,alcohol_volume_ml")
            .eq("user_id", user_id)
            .gte("date", since)
            .order("date", desc=False)
            .execute()
        )
        return res.data or []
    except Exception:
        return []

def fetch_rhr_map_since(user_id: int, since_iso_ts: str) -> Dict[str, float]:
    """
    Mapa denného RHR od since_iso_ts (UTC). Kľúč je 'YYYY-MM-DD'.
    Ak existuje viac záznamov v daný deň, berie sa nižší RHR.
    """
    mp: Dict[str, float] = {}
    try:
        rec = (
            supabase.table(TABLE_USERS_RECOVERY)
            .select("date,RHR_bpm")
            .eq("user_id", user_id)
            .gte("date", since_iso_ts)
            .order("date", desc=False)
            .execute()
        )
        for rr in (rec.data or []):
            d = (rr.get("date") or "")[:10]
            try:
                v = float(rr.get("RHR_bpm") or 0)
            except Exception:
                v = 0.0
            if v <= 0:
                continue
            if d not in mp or v < mp[d]:
                mp[d] = v
    except Exception:
        pass
    return mp

def rhr_for_date(rhr_by_date: Dict[str, float], iso_date: str) -> Optional[float]:
    """
    RHR pre zadaný deň; ak chýba, skúsi deň −1 a −2.
    """
    if iso_date in rhr_by_date:
        return rhr_by_date[iso_date]
    try:
        d0 = datetime.fromisoformat(iso_date).date()
    except Exception:
        return None
    for back in (1, 2):
        cand = (d0 - timedelta(days=back)).isoformat()
        if cand in rhr_by_date:
            return rhr_by_date[cand]
    return None