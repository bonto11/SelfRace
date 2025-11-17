# Routes/user_zones.py
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from Services.user_thresholds import (
  load_user_thresholds,
  upsert_user_threshold,
)

router = APIRouter(prefix="/users", tags=["users"])


class ThresholdPayload(BaseModel):
  sport: Optional[str] = None          # default: running
  threshold_type: Optional[str] = None # default: LT2

  hr_bpm: Optional[float] = None
  pace_sec_km: Optional[float] = None
  power_watt: Optional[float] = None
  value: Optional[float] = None

  measurement_type: Optional[str] = None  # napr. "estimate garmin", "manual"


@router.get("/{user_id}/thresholds")
def get_user_thresholds(user_id: int):
  """
  Najnovší threshold (default running/LT2) pre FE.
  """
  try:
    thr = load_user_thresholds(user_id)
  except Exception as e:  # noqa: BLE001
    raise HTTPException(status_code=500, detail=str(e))

  return {"success": True, "thresholds": thr}


@router.put("/{user_id}/thresholds")
def put_user_thresholds(user_id: int, payload: ThresholdPayload):
  """
  Upraví / vytvorí threshold pre usera (running + LT2 by default).
  """
  try:
    thr = upsert_user_threshold(user_id, payload.dict(exclude_unset=True))
  except Exception as e:  # noqa: BLE001
    raise HTTPException(status_code=500, detail=str(e))

  return {"success": True, "thresholds": thr}