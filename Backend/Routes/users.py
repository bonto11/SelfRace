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


class ResolveIn(BaseModel):
    auth_uid: str


@router.post("/resolve")
async def resolve_user(payload: ResolveIn):
    try:
        # hľadáme v tabuľke users podľa auth_uid
        resp = (
            supabase.table(TABLE_USERS)
            .select("id, auth_uid, mail_address")
            .eq("auth_uid", payload.auth_uid)
            .execute()
        )

        if not resp.data:
            return {"success": False, "error": "User not found in DB"}

        return {"success": True, "user_id": resp.data[0]["id"]}
    except Exception as e:
        print("❌ users/resolve error:", e)
        raise HTTPException(status_code=500, detail=str(e))
