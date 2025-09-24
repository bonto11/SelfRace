# Routes/user_bests.py
from fastapi import APIRouter, Body, HTTPException
from Services.bests import fetch_user_bests, upsert_user_best

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}/bests")
def get_bests(user_id: int):
    return {"success": True, "bests": fetch_user_bests(user_id)}

@router.put("/{user_id}/bests")
def put_best(user_id: int, payload: dict = Body(...)):
    try:
        rec = upsert_user_best(user_id, payload)
        return {"success": True, "saved": rec}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))