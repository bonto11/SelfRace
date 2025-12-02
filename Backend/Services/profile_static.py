# Services/profile_static.py
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import HTTPException

from Services.profile import StaticPayload, _iso_now, _birth_to_iso_date
from Routes_DB.profile_static import db_fetch_static, db_upsert_static

def _apply_user_filter_raw(q, user_id: int, user_uid: Optional[str]):
    """
    Minimal clone _apply_user_filter, ale iba pre DB layer.
    Ak máš už existujúcu funkciu v Services.profile, môžeš importnúť tú.
    """
    if user_uid:
        return q.eq("user_uid", user_uid)
    return q.eq("user_id", user_id)

def service_get_static_profile(user_id: int, user_uid: Optional[str] = None) -> Dict[str, Any]:
    """
    Načíta static profil – ak neexistuje, hodí 404.
    """
    row = db_fetch_static(user_id=user_id, user_uid=user_uid)
    if not row:
        raise HTTPException(status_code=404, detail="Static profile not found")
    return row


def service_upsert_static_profile(user_id: int, payload: StaticPayload) -> Dict[str, Any]:
    """
    Upsert static profilu podľa user_id / user_uid.
    """
    data: Dict[str, Any] = {
        "user_id": user_id if not payload.user_uid else None,
        "user_uid": payload.user_uid or None,
        "sex": payload.sex,
        "birth_date": _birth_to_iso_date(payload.birth_date),
        "height_cm": payload.height_cm,
        "updated_at": _iso_now(),
    }
    conflict_col = "user_uid" if data.get("user_uid") else "user_id"

    try:
        row = db_upsert_static(data, conflict_col=conflict_col)
        return row
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))