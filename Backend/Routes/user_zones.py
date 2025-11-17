# Routes/profile.py (doplnok)
# Routes/user_zones.py
from fastapi import APIRouter, HTTPException
from Services.user_zones import load_user_zones

# rovnaký prefix ako pri bests
router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/zones")
def get_user_zones(user_id: int):
    """
    Vráti HR zóny pre usera – pre FE (CoachPrefs panel).
    URL: /users/{user_id}/zones
    """
    try:
        zones = load_user_zones(user_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    return {"success": True, "zones": zones}