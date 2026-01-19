# Routes_FE/maintenance.py
from __future__ import annotations

from fastapi import APIRouter, Body, Header, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from Services.maintenance import (
    service_cleanup_deleted_activities,
    service_weekly_athlete_state_analysis,
    service_account_hard_delete,
)
from Services.AI.athlete_state import service_analyze_athlete
from Routes_DB.users import db_list_users_for_athlete_state
from Services.app_subscription import service_apply_due_subscription_changes
from Configs.config import MAINTENANCE_API_KEY

router = APIRouter(prefix="/maintenance", tags=["maintenance"])

@router.post("/cleanup-deleted-activities")
async def cleanup_deleted_activities_endpoint(
    cutoff_days: int = Body(30, embed=True),
    x_api_key: str | None = Header(default=None),
):
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing API key",
        )

    try:
        result = service_cleanup_deleted_activities(cutoff_days=cutoff_days)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:  # noqa: BLE001
        return JSONResponse(
            {"ok": False, "error": str(e)},
            status_code=500,
        )


@router.post("/weekly-athlete-state-refresh")
async def weekly_athlete_state_refresh_endpoint(
    max_users: int = Body(0, embed=True),
    x_api_key: str | None = Header(default=None),
):
    """
    Spustí AI analýzu atleta pre všetkých userov (alebo prvých max_users)
    a uloží výsledok do coach_athlete_state.

    Beží v SERVICE režime (service=True), teda cez service klienta na DB.
    """
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing API key",
        )

    try:
        # 1) zoznam userov
        users = db_list_users_for_athlete_state(
            limit=max_users or 1000,
            user_jwt=None,
            service=True,
        )

        if not users:
            return JSONResponse(
                {"ok": True, "processed": 0, "results": [], "note": "no users found"}
            )

        results = []
        processed = 0

        for row in users:
            uid = row.get("id")
            if not uid:
                continue

            try:
                # SERVICE režim – cron/maintenance: service=True, user_jwt=None
                resp = service_analyze_athlete(
                    user_id=int(uid),
                    user_jwt=None,
                    service=True,
                    debug=False,
                    save_to_db=True,
                    model=None,
                )

                state_id = resp.get("state_id")
                results.append(
                    {
                        "user_id": uid,
                        "state_id": state_id,
                        "ok": bool(state_id is not None),
                    }
                )
                processed += 1
            except Exception as e:  # noqa: BLE001
                results.append(
                    {
                        "user_id": uid,
                        "state_id": None,
                        "ok": False,
                        "error": str(e),
                    }
                )

        return JSONResponse(
            {
                "ok": True,
                "processed": processed,
                "results": results,
            }
        )

    except Exception as e:  # noqa: BLE001
        return JSONResponse(
            {"ok": False, "error": str(e)},
            status_code=500,
        )
    
@router.post("/app-subscriptions/apply-due")
async def maintenance_apply_due_app_subscriptions(
    x_api_key: str | None = Header(default=None),
):
    """
    Cron endpoint – volaný raz denne zvonka (GitHub Actions / Railway cron).
    Vykoná všetky naplánované zmeny subscriptionov.
    """
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing API key",
        )

    try:
        result = service_apply_due_subscription_changes(
            user_jwt=None,
            service=True,  # service klient na DB, bez RLS
        )
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:  # noqa: BLE001
        return JSONResponse(
            {"ok": False, "error": str(e)},
            status_code=500,
        )

class AccountHardDeletePayload(BaseModel):
  dry_run: bool = False
  only_user_id: int | None = None

@router.post("/account-hard-delete")
async def maintenance_account_hard_delete(
    payload: AccountHardDeletePayload,
    x_api_key: str | None = Header(default=None),
):
    """
    Cron endpoint pre hard delete účtov označených na zmazanie.

    - dry_run=True  → len simuluje, koho by mazalo
    - only_user_id  → ak je zadané, mazanie sa obmedzí len na daného usera
    """
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing API key",
        )

    try:
        result = service_account_hard_delete(
            dry_run=payload.dry_run,
            only_user_id=payload.only_user_id,
        )
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:  # noqa: BLE001
        return JSONResponse(
            {"ok": False, "error": str(e)},
            status_code=500,
        )