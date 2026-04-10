from __future__ import annotations

from typing import Optional, Dict, Any

from fastapi import HTTPException

from Routes_DB.profile_static import db_fetch_static, db_upsert_static
from Services.time import iso_now, birth_to_iso_date
from Schemas.profile_static import StaticPayload
from Modules.Supabase.auth import AuthCtx


def service_get_static_profile(
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Načíta static profil – ak neexistuje, hodí 404.
    """
 
    row = db_fetch_static(
        user_id=user_id,
        ctx=ctx,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Static profile not found")
    return row


def service_upsert_static_profile(
    user_id: int,
    payload: StaticPayload,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Upsert static profilu podľa user_id (pod RLS).
    """

    data: Dict[str, Any] = {
        "user_id": user_id,
        "sex": payload.sex,
        "birth_date": birth_to_iso_date(payload.birth_date),
        "height_cm": payload.height_cm,
        "updated_at": iso_now(),
    }
    conflict_col = "user_id"

    try:
        row = db_upsert_static(
            data,
            conflict_col=conflict_col,
            ctx=ctx,
        )
        return row
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
