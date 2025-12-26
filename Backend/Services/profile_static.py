# Services/profile_static.py
from __future__ import annotations

from typing import Optional, Dict, Any

from fastapi import HTTPException

from Routes_DB.profile_static import db_fetch_static, db_upsert_static
from Services.time import iso_now, birth_to_iso_date
from Schemas.profile_static import StaticPayload


def _require_jwt(user_jwt: Optional[str]) -> str:
    if not user_jwt:
        raise HTTPException(status_code=401, detail="Missing Authorization JWT")
    return user_jwt


def service_get_static_profile(
    user_id: int,
    user_uid: Optional[str] = None,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Načíta static profil – ak neexistuje, hodí 404.
    """
    user_jwt = _require_jwt(user_jwt)

    row = db_fetch_static(
        user_id=user_id,
        user_uid=user_uid,
        user_jwt=user_jwt,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Static profile not found")
    return row


def service_upsert_static_profile(
    user_id: int,
    payload: StaticPayload,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Upsert static profilu podľa user_id / user_uid (pod RLS).
    """
    user_jwt = _require_jwt(user_jwt)

    data: Dict[str, Any] = {
        # ak FE pošle user_uid, použijeme ho (v RLS musí sedieť na auth.uid())
        "user_id": user_id if not payload.user_uid else None,
        "user_uid": payload.user_uid or None,
        "sex": payload.sex,
        "birth_date": birth_to_iso_date(payload.birth_date),
        "height_cm": payload.height_cm,
        "updated_at": iso_now(),
    }
    conflict_col = "user_uid" if data.get("user_uid") else "user_id"

    try:
        row = db_upsert_static(
            data,
            conflict_col=conflict_col,
            user_jwt=user_jwt,
        )
        return row
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))