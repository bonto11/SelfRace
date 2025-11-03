from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_STATIC, TABLE_USERS_METRICS

router = APIRouter(prefix="/profile", tags=["profile"])
supabase = get_client()

# --- STATIC DATA ---
@router.get("/static/{user_id}")
def get_static(user_id: int):
    res = supabase.table(TABLE_USERS_STATIC).select("*").eq("user_id", user_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Static profile not found")
    return {"success": True, "data": res.data[0]}

@router.post("/static/{user_id}")
def insert_static(user_id: int, payload: dict):
    payload["user_id"] = user_id
    try:
        res = supabase.table(TABLE_USERS_STATIC).upsert(payload, on_conflict="user_id").execute()
        return {"success": True, "data": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- METRICS DATA ---
@router.get("/metrics/{user_id}")
def get_metrics(user_id: int):
    res = (
        supabase.table(TABLE_USERS_METRICS)
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Metrics not found")
    return {"success": True, "data": res.data[0]}

@router.post("/metrics/{user_id}")
def insert_metrics(user_id: int, payload: dict):
    payload["user_id"] = user_id
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        res = supabase.table(TABLE_USERS_METRICS).insert(payload).execute()
        return {"success": True, "data": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics/history/{user_id}")
def get_metrics_history(user_id: int):
    res = (
        supabase.table(TABLE_USERS_METRICS)
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=False)
        .execute()
    )
    return {"success": True, "data": res.data}

# --- VO2 HISTORY (metrics + static) ---
@router.get("/vo2-history/{user_id}")
def get_vo2_history(user_id: int):
    try:
        # históriu VO2Max z metrics
        metrics = (
            supabase.table(TABLE_USERS_METRICS)
            .select("VO2Max, updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=False)
            .execute()
        )

        if not metrics.data:
            raise HTTPException(status_code=404, detail="No VO2 data")

        # static data (sex, birth_date)
        static = (
            supabase.table(TABLE_USERS_STATIC)
            .select("sex, birth_date")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if not static.data:
            raise HTTPException(status_code=404, detail="Static profile not found")

        return {
            "success": True,
            "history": metrics.data,
            "sex": static.data[0].get("sex"),
            "birth_date": static.data[0].get("birth_date"),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# --- Body Fat history ---
@router.get("/bodyfat-history/{user_id}")
def get_bodyfat_history(user_id: int):
    try:
        res = (
            supabase.table(TABLE_USERS_METRICS)
            .select("body_fat_pct, updated_at, user_id")
            .eq("user_id", user_id)
            .order("updated_at", desc=False)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="No Body Fat data")

        static = (
            supabase.table(TABLE_USERS_STATIC)
            .select("birth_date, sex")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        return {
            "success": True,
            "history": res.data,
            "sex": static.data[0]["sex"] if static.data else None,
            "birth_date": static.data[0]["birth_date"] if static.data else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))