# Routes/coach_prefs.py
from fastapi import APIRouter, Body, HTTPException
from datetime import datetime
from Services.db import supabase, TABLE_COACH_PREFS

router = APIRouter(prefix="/coach", tags=["coach"])

@router.get("/prefs/{user_id}")
def get_prefs(user_id: int):
    try:
        res = supabase.table(TABLE_COACH_PREFS).select("*").eq("user_id", user_id).limit(1).execute()
        row = (res.data or [None])[0]
        return {"success": True, "prefs": row}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/prefs/{user_id}")
def put_prefs(user_id: int, payload: dict = Body(...)):
    try:
        rec = {"user_id": user_id, "prefs": payload, "updated_at": datetime.utcnow().isoformat()}
        supabase.table(TABLE_COACH_PREFS).upsert(rec, on_conflict="user_id").execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))