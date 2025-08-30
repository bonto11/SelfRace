from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from Modules.SQL.db_handler import get_client

router = APIRouter(prefix="/recovery", tags=["recovery"])
supabase = get_client()

class RecoveryIn(BaseModel):
    user_id: int
    date: str  # 👈 priamo vybraný deň (YYYY-MM-DD)
    RHR_bpm: int | None = None
    HRV_avg_ms: int | None = None
    HRV_max_ms: int | None = None
    sleep_duration_min: int | None = None
    sleep_start_timestampz: str | None = None
    alcohol_volume_ml: int | None = None
    alcohol_type_pct: int | None = None
    food_2h_before: bool | None = None
    caffeine_8h: bool | None = None
    comments: str | None = None


# --- CREATE alebo UPDATE podľa existencie ---
@router.post("")
def insert_or_update_recovery(payload: RecoveryIn):
    try:
        # 1. check či existuje pre user_id + date
        existing = (
            supabase.table("users_recovery")
            .select("id")
            .eq("user_id", payload.user_id)
            .eq("date", payload.date)
            .execute()
        )

        data = payload.model_dump()

        if existing.data:
            rec_id = existing.data[0]["id"]
            res = (
                supabase.table("users_recovery")
                .update(data)
                .eq("id", rec_id)
                .execute()
            )
        else:
            res = supabase.table("users_recovery").insert(data).execute()

        return {"success": True, "data": res.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- GET všetky za posledných X dní ---
@router.get("/{user_id}")
def get_recovery(user_id: int, days: int = 14):
    try:
        rec = (
            supabase.table("users_recovery")
            .select("*")
            .eq("user_id", user_id)
            .order("date", desc=True)
            .limit(days)
            .execute()
        )
        return {"success": True, "data": rec.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
