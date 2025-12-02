# Services/profile_static.py
from __future__ import annotations

from pydantic import BaseModel
from typing import List, Optional, Literal, Dict, Any, Union
from datetime import datetime, date
from fastapi import HTTPException

from Routes_DB.profile_static import db_fetch_static, db_upsert_static
from Services.common import iso_now, birth_to_iso_date


class StaticPayload(BaseModel):
    sex: Optional[Literal["M", "F"]] = None
    birth_date: Optional[Union[str, date, datetime]] = None
    height_cm: Optional[float] = None
    # voliteľne – keď pošleš, upsert pôjde cez user_uid
    user_uid: Optional[str] = None


def service_get_static_profile(
    user_id: int, user_uid: Optional[str] = None
) -> Dict[str, Any]:
    """
    Načíta static profil – ak neexistuje, hodí 404.
    """
    row = db_fetch_static(user_id=user_id, user_uid=user_uid)
    if not row:
        raise HTTPException(status_code=404, detail="Static profile not found")
    return row


def service_upsert_static_profile(
    user_id: int, payload: StaticPayload
) -> Dict[str, Any]:
    """
    Upsert static profilu podľa user_id / user_uid.
    """
    data: Dict[str, Any] = {
        "user_id": user_id if not payload.user_uid else None,
        "user_uid": payload.user_uid or None,
        "sex": payload.sex,
        "birth_date": birth_to_iso_date(payload.birth_date),
        "height_cm": payload.height_cm,
        "updated_at": iso_now(),
    }
    conflict_col = "user_uid" if data.get("user_uid") else "user_id"

    try:
        row = db_upsert_static(data, conflict_col=conflict_col)
        return row
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
