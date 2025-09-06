from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from Modules.SQL.db_handler import get_client
from Modules.config import (
    TABLE_USERS,
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_SPLITS,
    TABLE_ACTIVITIES_LAPS,
    TABLE_USERS_PROFILE,
    TABLE_USERS_ZONES,
    TABLE_USERS_THRESHOLDS,
    TABLE_USERS_BESTS,
    TABLE_USERS_RECOVERY,
)

router = APIRouter(prefix="/users", tags=["users"])
supabase = get_client()


@router.get("/{user_id}/profile")
def get_user_profile(user_id: int):
    resp = (
        supabase.table(TABLE_USERS_PROFILE)
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"success": True, "data": resp.data[0]}
