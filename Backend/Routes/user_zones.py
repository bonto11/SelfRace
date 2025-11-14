# Routes/profile.py (doplnok)
from fastapi import APIRouter, HTTPException
from Services.user_zones import load_user_zones

router = APIRouter(prefix="/profile", tags=["profile"])

@router.get("/zones/{user_id}")
def get_user_zones(user_id: int):
    """
    Vráti HR zóny pre usera – pre FE (CoachPrefs panel).
    """
    try:
        zones = load_user_zones(user_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    # ak user ešte nemá zóny, vráť success=True, ale zones=None
    return {"success": True, "zones": zones}