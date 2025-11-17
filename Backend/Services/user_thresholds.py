# Services/user_thresholds.py
from typing import Optional, Dict, Any

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_THRESHOLDS  # pridaj si do configu

sb = get_client()


def _num(v):
  try:
    if v is None:
      return None
    return float(v)
  except Exception:  # noqa: BLE001
    return None


def load_user_thresholds(
  user_id: int,
  sport: str = "running",
  threshold_type: str = "LT2",
) -> Optional[Dict[str, Any]]:
  """
  Najnovší threshold pre usera (podľa updated_at).
  """
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
  if not row:
    return None

  return {
    "sport": row.get("sport"),
    "threshold_type": row.get("threshold_type"),
    "updated_at": row.get("updated_at"),
    "hr_bpm": _num(row.get("HR_bpm")),
    "pace_sec_km": _num(row.get("pace_sec_km")),
    "power_watt": _num(row.get("power_watt")),
    "value": _num(row.get("value")),
    "measurement_type": row.get("measurement_type"),
  }


def upsert_user_threshold(
  user_id: int,
  payload: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
  """
  Upsert threshold (typicky LT2 pre running) podľa (user_id,sport,threshold_type).
  """
  sport = payload.get("sport") or "running"
  t_type = payload.get("threshold_type") or "LT2"

  row = {
    "user_id": user_id,
    "sport": sport,
    "threshold_type": t_type,
    "HR_bpm": payload.get("hr_bpm") or payload.get("HR_bpm"),
    "pace_sec_km": payload.get("pace_sec_km"),
    "power_watt": payload.get("power_watt"),
    "value": payload.get("value"),
    "measurement_type": payload.get("measurement_type") or "manual",
  }

  clean = {k: v for k, v in row.items() if v is not None}

  # tu je ideálne mať UNIQUE index na (user_id,sport,threshold_type)
  sb.table(TABLE_USERS_THRESHOLDS).upsert(
    clean,
    on_conflict="user_id,sport,threshold_type",
  ).execute()

  return load_user_thresholds(user_id, sport=sport, threshold_type=t_type)