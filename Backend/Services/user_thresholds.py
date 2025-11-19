# Services/user_thresholds.py
from typing import Optional, Dict, Any, List, Tuple
from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_THRESHOLDS

sb = get_client()

def _num(v):
  try:
    if v is None:
      return None
    return float(v)
  except Exception:
    return None

def _row_norm(row: Dict[str, Any]) -> Dict[str, Any]:
  return {
    "sport": row.get("sport"),
    "threshold_type": row.get("threshold_type"),
    "updated_at": row.get("updated_at"),
    "hr_bpm": _num(row.get("hr_bpm")),
    "pace_sec_km": _num(row.get("pace_sec_km")),
    "power_watt": _num(row.get("power_watt")),
    "measurement_type": row.get("measurement_type"),
  }

def list_user_thresholds(user_id: int) -> List[Dict[str, Any]]:
  q = (
    sb.table(TABLE_USERS_THRESHOLDS)
    .select("sport,threshold_type,updated_at,hr_bpm,pace_sec_km,power_watt,measurement_type")
    .eq("user_id", user_id)
    .order("updated_at", desc=True)
    .execute()
  )
  rows = q.data or []
  return [_row_norm(r) for r in rows]

def list_latest_per_combo(user_id: int) -> List[Dict[str, Any]]:
  rows = list_user_thresholds(user_id)  # už sú zoradené desc
  seen: set[Tuple[str, str]] = set()
  out: List[Dict[str, Any]] = []
  for r in rows:
    key = (r.get("sport") or "", r.get("threshold_type") or "")
    if key in seen:
      continue
    seen.add(key)
    out.append(r)
  return out

def load_user_thresholds(user_id: int, sport: str = "running", threshold_type: str = "LT2") -> Optional[Dict[str, Any]]:
  q = (
    sb.table(TABLE_USERS_THRESHOLDS)
    .select("*")
    .eq("user_id", user_id)
    .eq("sport", sport)
    .eq("threshold_type", threshold_type)
    .order("updated_at", desc=True)
    .limit(1)
    .execute()
  )
  row = (q.data or [None])[0]
  return _row_norm(row) if row else None

def upsert_user_threshold(user_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
  sport = payload.get("sport") or "running"
  t_type = payload.get("threshold_type") or "LT2"
  row = {
    "user_id": user_id,
    "sport": sport,
    "threshold_type": t_type,
    "hr_bpm": payload.get("hr_bpm"),
    "pace_sec_km": payload.get("pace_sec_km"),
    "power_watt": payload.get("power_watt"),
    "measurement_type": payload.get("measurement_type") or "manual",
  }
  clean = {k: v for k, v in row.items() if v is not None}
  sb.table(TABLE_USERS_THRESHOLDS).upsert(clean, on_conflict="user_id,sport,threshold_type").execute()
  return load_user_thresholds(user_id, sport=sport, threshold_type=t_type)