from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from Modules.SQL.db_handler import get_client

router = APIRouter(prefix="/recovery", tags=["recovery"])
supabase = get_client()


class RecoveryIn(BaseModel):
    user_id: int | None = None       # priamo DB id
    auth_uid: str | None = None      # alternatívne uuid z FE
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


# --- POST: vloženie recovery záznamu ---
@router.post("")
def insert_recovery(payload: RecoveryIn):
    try:
        # Rozhodnutie, odkiaľ zobrať user_id
        user_id = None
        if payload.user_id is not None:
            user_id = payload.user_id
        elif payload.auth_uid:
            resp = supabase.table("users").select("id").eq("auth_uid", payload.auth_uid).execute()
            if not resp.data:
                raise HTTPException(status_code=404, detail="User not found")
            user_id = resp.data[0]["id"]
        else:
            raise HTTPException(status_code=400, detail="Missing user_id or auth_uid")

        data = {
            "user_id": user_id,
            "date": payload.sleep_start_timestampz.split("T")[0] if payload.sleep_start_timestampz else None,
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

        res = supabase.table("users_recovery").insert(data).execute()
        if res.error:
            raise HTTPException(status_code=400, detail=res.error)

        return {"success": True, "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- GET: načítanie posledných recovery záznamov ---
@router.get("/{identifier}")
async def get_recovery(identifier: str):
    """
    Ak príde číslo → ber ako user_id (int).
    Ak príde string (uuid) → najdi podľa auth_uid.
    """
    try:
        if identifier.isdigit():
            # priamo int user_id
            user_id = int(identifier)
        else:
            # lookup podľa auth_uid
            resp = supabase.table("users").select("id").eq("auth_uid", identifier).execute()
            if not resp.data:
                raise HTTPException(status_code=404, detail="User not found")
            user_id = resp.data[0]["id"]

        rec = (
            supabase.table("users_recovery")
            .select("*")
            .eq("user_id", user_id)
            .order("date", desc=True)
            .limit(14)
            .execute()
        )

        return {"success": True, "data": rec.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
