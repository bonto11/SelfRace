# Services/user_profile.py
from __future__ import annotations
from typing import Optional
from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_PROFILE_STATIC, TABLE_PROFILE_METRIC_VALUE

supabase = get_client()

def fetch_user_sex(user_id: int) -> Optional[str]:
    try:
        rec = (supabase.table(TABLE_PROFILE_STATIC)
               .select("sex").eq("user_id", user_id).limit(1).execute())
        row = (rec.data or [None])[0]
        return row.get("sex") if row else None
    except Exception:
        return None

def fetch_user_hr_max(user_id: int) -> Optional[float]:
    try:
        rec = (supabase.table(TABLE_PROFILE_METRIC_VALUE)
               .select("value_num")
               .eq("user_id", user_id)
               .eq("metric", "HR_max")
               .order("measured_at", desc=True)
               .limit(1)
               .execute())
        row = (rec.data or [None])[0]
        v = float(row.get("value_num") or 0) if row else 0
        return v if v > 0 else None
    except Exception:
        return None