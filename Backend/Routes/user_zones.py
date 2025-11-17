# Routes/user_zones.py
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from Services.user_zones import load_user_zones, upsert_user_zones

router = APIRouter(prefix="/users", tags=["users"])


class ZonesPayload(BaseModel):
  hr_max: Optional[int] = None
  hr_max_bpm: Optional[int] = None

  z1_min: Optional[int] = None
  z1_max: Optional[int] = None
  z2_min: Optional[int] = None
  z2_max: Optional[int] = None
  z3_min: Optional[int] = None
  z3_max: Optional[int] = None
  z4_min: Optional[int] = None
  z4_max: Optional[int] = None
  z5_min: Optional[int] = None
  z5_max: Optional[int] = None

  sport: Optional[str] = None  # pre prípad, že chceš neskôr aj bike atď.


@router.get("/{user_id}/zones")
def get_user_zones(user_id: int):
  """
  Vráti normalizované HR zóny pre FE CoachPrefs panel.
  """
  try:
    zones = load_user_zones(user_id)
  except Exception as e:  # noqa: BLE001
    raise HTTPException(status_code=500, detail=str(e))

  return {"success": True, "zones": zones}


@router.put("/{user_id}/zones")
def put_user_zones(user_id: int, payload: ZonesPayload):
  """
  Uloží zóny z FE (vždy spraví nový záznam v users_zones) a vráti normalizovaný stav.
  """
  try:
    zones = upsert_user_zones(user_id, payload.dict(exclude_unset=True))
  except Exception as e:  # noqa: BLE001
    raise HTTPException(status_code=500, detail=str(e))

  return {"success": True, "zones": zones}