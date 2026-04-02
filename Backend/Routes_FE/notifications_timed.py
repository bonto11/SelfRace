# Routes_FE/notifications_timed.py
from __future__ import annotations

from typing import Dict
from fastapi import APIRouter, Body, Header, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Dict 
from Services.notifications import (
    service_cron_notify_recovery,
    service_cron_notify_review,
    service_cron_notify_training,
)

from Routes_DB.users import db_list_users_for_athlete_state
from Services.AI.athlete_state.main import service_analyze_athlete
from Services.coach_plan_active import service_complete_due_active_plans

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import service_ctx

router = APIRouter(prefix="/notifications-timed", tags=["notifications-timed"])

def _require_api_key(x_api_key: str | None) -> None:
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing API key",
        )

@router.post("/recovery")
async def timed_notify_recovery(
    x_api_key: str | None = Header(default=None),
):
    _require_api_key(x_api_key)
    ctx = service_ctx("notifications_timed.recovery")

    try:
        result = service_cron_notify_recovery(ctx=ctx)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.post("/review")
async def timed_notify_review(
    x_api_key: str | None = Header(default=None),
):
    _require_api_key(x_api_key)
    ctx = service_ctx("notifications_timed.review")

    try:
        result = service_cron_notify_review(ctx=ctx)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.post("/training")
async def timed_notify_training(
    x_api_key: str | None = Header(default=None),
):
    _require_api_key(x_api_key)
    ctx = service_ctx("notifications_timed.training")

    try:
        result = service_cron_notify_training(ctx=ctx)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.post("/global")
async def timed_notify_global(
    messages: Dict[str, Dict[str, str]] = Body(..., embed=True),
    x_api_key: str | None = Header(default=None),
):
    """
    Endpoint na manuálne poslanie hromadnej push notifikácie vo viacerých jazykoch.
    Chránené pomocou MAINTENANCE_API_KEY.
    """
    _require_api_key(x_api_key)
    ctx = service_ctx("notifications_timed.global")

    try:
        # Musíme importovať service až tu (ak by náhodou aj tu bol circular import problém)
        from Services.notifications import service_notify_global
        
        result = service_notify_global(
            messages=messages,
            ctx=ctx
        )
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
    

@router.post("/coach-plan-complete-due")
async def coach_plan_complete_due_endpoint(
    x_api_key: str | None = Header(default=None),
):
    """
    Nočný cron na automatické ukončenie aktívnych plánov, 
    ktorým vypršal end_date. Status sa mení na 'completed'.
    """
    _require_api_key(x_api_key)
    ctx = service_ctx("maintenance.coach_plan_complete_due")

    try:
        result = service_complete_due_active_plans(ctx=ctx)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)

@router.post("/weekly-athlete-state-refresh")
async def weekly_athlete_state_refresh_endpoint(
    max_users: int = Body(0, embed=True),
    x_api_key: str | None = Header(default=None),
):
    """
    Spustí AI analýzu atleta pre všetkých userov (alebo prvých max_users)
    a uloží výsledok do coach_athlete_state.

    Beží v SERVICE režime (service ctx), teda cez service klienta na DB.
    """
    _require_api_key(x_api_key)
    ctx = service_ctx("maintenance.weekly_athlete_state_refresh")

    try:
        users = db_list_users_for_athlete_state(
            ctx=ctx,
            limit=max_users or 1000,
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
                resp = service_analyze_athlete(
                    ctx=ctx,
                    user_id=int(uid),
                    model=None,
                )

                state_id = resp.get("state_id")
                results.append(
                    {"user_id": uid, "state_id": state_id, "ok": bool(state_id is not None)}
                )
                processed += 1
            except Exception as e:  # noqa: BLE001
                results.append(
                    {"user_id": uid, "state_id": None, "ok": False, "error": str(e)}
                )

        return JSONResponse({"ok": True, "processed": processed, "results": results})

    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
