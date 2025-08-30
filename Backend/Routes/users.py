from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from Modules.SQL.db_handler import get_client

router = APIRouter(prefix="/users", tags=["users"])
supabase = get_client()

class ResolveIn(BaseModel):
    auth_uid: str

@router.post("/resolve")
async def resolve_user(payload: ResolveIn):
    print("➡️ users/resolve called with:", payload.auth_uid)

    try:
        # hľadáme v tabuľke users podľa auth_uid
        resp = supabase.table("users").select("id, auth_uid, mail_address").eq("auth_uid", payload.auth_uid).execute()
        print("➡️ Supabase response:", resp.data)

        if not resp.data:
            return {"success": False, "error": "User not found in DB"}

        return {"success": True, "user_id": resp.data[0]["id"]}
    except Exception as e:
        print("❌ users/resolve error:", e)
        raise HTTPException(status_code=500, detail=str(e))
