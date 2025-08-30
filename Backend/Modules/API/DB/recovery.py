# backend/routes/recovery.py
from fastapi import APIRouter
from pydantic import BaseModel
from supabase import create_client
import os
from datetime import date

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)


# -------- Request body --------
class RecoveryInput(BaseModel):
    auth_uid: str
    RHR_bpm: int | None = None
    HRV_avg_ms: int | None = None
    HRV_max_ms: int | None = None
    sleep_duration_min: int | None = None
    sleep_start_timestampz: str | None = None
    alcohol_volume_ml: int | None = None
    alcohol_type_pct: int | None = None
    food_2h_before: bool | None = None
    caffeine_8h: bool | None = None
    comment: str | None = None


# -------- Endpoint --------
@router.post("/recovery")
async def insert_recovery(payload: RecoveryInput):
    # 1) auth_uid -> user_id
    resp = supabase.table("users").select("id").eq("auth_uid", payload.auth_uid).execute()
    if not resp.data:
        return {"success": False, "error": "User not found"}
    user_id = resp.data[0]["id"]

    # 2) insert
    insert_payload = {
        "user_id": user_id,
        "date": date.today().isoformat(),
        "RHR_bpm": payload.RHR_bpm,
        "HRV_avg_ms": payload.HRV_avg_ms,
        "HRV_max_ms": payload.HRV_max_ms,
        "sleep_duration_min": payload.sleep_duration_min,
        "sleep_start_timestampz": payload.sleep_start_timestampz,
        "alcohol_volume_ml": payload.alcohol_volume_ml,
        "alcohol_type_pct": payload.alcohol_type_pct,
        "food_2h_before": payload.food_2h_before,
        "caffeine_8h": payload.caffeine_8h,
        "comment": payload.comment,
    }

    try:
        ins = supabase.table("users_recovery").insert(insert_payload).execute()
        return {"success": True, "data": ins.data}
    except Exception as e:
        return {"success": False, "error": str(e)}
