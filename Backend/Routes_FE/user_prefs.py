# Routes_FE/user_prefs.py
from __future__ import annotations

from typing import Any, Dict, Optional, List

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from Services.user_prefs import (
    service_get_user_prefs_list,
    service_get_user_pref,
    service_save_user_pref,
    service_save_user_prefs_bulk,
    service_delete_user_pref,
)
from Modules.HTTP.auth_deps import inject_user_jwt

router = APIRouter(prefix="/prefs", tags=["prefs"])


@router.get("/{user_id}")
def get_user_prefs(
    user_id: int,
    prefix: Optional[str] = Query(None),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """
    Vráti zoznam user prefs (key, value, updated_at).
    Voliteľne filtruje podľa prefixu v key (?prefix=coach. atď.).
    """
    try:
        prefs = service_get_user_prefs_list(user_id, user_jwt=user_jwt)

        if prefix:
            p = str(prefix)
            prefs = [row for row in prefs if str(row.get("key", "")).startswith(p)]

        return {"success": True, "prefs": prefs}
    except HTTPException:
        # nech 401/403 atď. prejdú bez zmeny
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/key/{key}")
def get_user_pref(
    user_id: int,
    key: str,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """
    Vráti hodnotu jedného preferenčného kľúča.
    """
    try:
        val = service_get_user_pref(user_id, key, user_jwt=user_jwt)
        return {"success": True, "key": key, "value": val}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/key/{key}")
def put_user_pref(
    user_id: int,
    key: str,
    value: Any = Body(...),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """
    Upsert jedného key → value.
    """
    try:
        saved = service_save_user_pref(
            user_id,
            key,
            value,
            user_jwt=user_jwt,
        )
        return {"success": True, "saved": saved}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}")
def put_user_prefs(
    user_id: int,
    payload: Dict[str, Any] = Body(...),
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """
    Bulk upsert: body = { "prefs": [ { "key": "...", "value": ... }, ... ] }
    """
    try:
        prefs_list: List[Dict[str, Any]] = payload.get("prefs") or []
        if not isinstance(prefs_list, list):
            raise HTTPException(
                status_code=400,
                detail="Invalid payload: 'prefs' must be a list",
            )

        kv: Dict[str, Any] = {}
        for row in prefs_list:
            if not isinstance(row, dict) or "key" not in row:
                continue
            k = str(row["key"])
            kv[k] = row.get("value")

        n = service_save_user_prefs_bulk(
            user_id,
            kv,
            user_jwt=user_jwt,
        )
        return {"success": True, "count": n}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}/key/{key}")
def del_user_pref(
    user_id: int,
    key: str,
    user_jwt: Optional[str] = Depends(inject_user_jwt),
):
    """
    Zmaže jeden kľúč.
    """
    try:
        n = service_delete_user_pref(
            user_id,
            key,
            user_jwt=user_jwt,
        )
        return {"success": True, "deleted": n}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))