from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from Modules.SQL.db_handler import get_client
from Modules.config import (
    TABLE_USERS,
    TABLE_USERS_PROFILE,
    TABLE_USERS_RECOVERY,
)

router = APIRouter(prefix="/recovery", tags=["recovery"])
supabase = get_client()


class RecoveryIn(BaseModel):
    user_id: int
    date: str  # 👈 priamo vybraný deň (YYYY-MM-DD)
    RHR_bpm: int | None = None
    HRV_avg_ms: int | None = None
    HRV_max_ms: int | None = None
    sleep_duration_min: int | None = None
    sleep_start_time: str | None = None  # 👈 len HH:MM
    alcohol_volume_ml: int | None = None
    alcohol_type_pct: int | None = None
    food_2h_before: bool | None = None
    caffeine_8h: bool | None = None
    comments: str | None = None


# --- CREATE alebo UPDATE podľa existencie ---
@router.post("")
def insert_or_update_recovery(payload: RecoveryIn):
    try:
        # nájdi auth_uid podľa user_id
        user_resp = (
            supabase.table(TABLE_USERS)
            .select("auth_uid")
            .eq("id", payload.user_id)
            .limit(1)
            .execute()
        )
        if not user_resp.data:
            raise HTTPException(status_code=404, detail="User not found")

        auth_uid = user_resp.data[0]["auth_uid"]

        # ak nie je poslaný dátum, vezmeme dnešný
        date_val = payload.date or datetime.now().date().isoformat()

        # check či existuje pre user_id + date
        existing = (
            supabase.table(TABLE_USERS_RECOVERY)
            .select("id")
            .eq("user_id", payload.user_id)
            .eq("date", date_val)
            .execute()
        )

        # priprav dáta
        data = payload.model_dump()
        data["user_uid"] = auth_uid
        data["date"] = date_val

        if existing.data:
            rec_id = existing.data[0]["id"]
            res = (
                supabase.table(TABLE_USERS_RECOVERY)
                .update(data)
                .eq("id", rec_id)
                .execute()
            )
        else:
            res = supabase.table(TABLE_USERS_RECOVERY).insert(data).execute()

        return {"success": True, "data": res.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- GET všetky za posledných X dní ---
@router.get("/{user_id}")
def get_recovery(user_id: int, days: int = 14):
    try:
        rec = (
            supabase.table(TABLE_USERS_RECOVERY)
            .select("*")
            .eq("user_id", user_id)
            .order("date", desc=True)
            .limit(days)
            .execute()
        )
        return {"success": True, "data": rec.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
