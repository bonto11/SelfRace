# Routes_FE/maintenance.py
from __future__ import annotations

from fastapi import APIRouter, Body, Header, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from Services.maintenance import (
    service_cleanup_deleted_activities,
    service_account_hard_delete,
    service_cleanup_expired_activity_details,
)
from Services.AI.athlete_state.main import service_analyze_athlete
from Routes_DB.users import db_list_users_for_athlete_state
from Services.app_subscription import service_apply_due_subscription_changes

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import service_ctx

router = APIRouter(prefix="/maintenance", tags=["maintenance"])

def _require_api_key(x_api_key: str | None) -> None:
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing API key",
        )


@router.post("/cleanup-deleted-activities")
async def cleanup_deleted_activities_endpoint(
    cutoff_days: int = Body(30, embed=True),
    x_api_key: str | None = Header(default=None),
):
    _require_api_key(x_api_key)
    ctx = service_ctx("maintenance.cleanup_deleted_activities")

    try:
        result = service_cleanup_deleted_activities(
            ctx=ctx,
            cutoff_days=cutoff_days,
        )
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@router.post("/cleanup-expired-activity-details")
async def cleanup_expired_activity_details_endpoint(
    x_api_key: str | None = Header(default=None),
):
    """
    Hard delete expirovaných detailov aktivít:
    - activities_streams
    - activities_laps
    - activities_splits

    Mazanie ide podľa:
      - expires_at <= now()
      - OR deleted_at IS NOT NULL
    """
    _require_api_key(x_api_key)
    ctx = service_ctx("maintenance.cleanup_expired_activity_details")

    try:
        result = service_cleanup_expired_activity_details(ctx=ctx)
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


@router.post("/app-subscriptions/apply-due")
async def maintenance_apply_due_app_subscriptions(
    x_api_key: str | None = Header(default=None),
):
    """
    Cron endpoint – volaný raz denne zvonka.
    """
    _require_api_key(x_api_key)
    ctx = service_ctx("maintenance.apply_due_app_subscriptions")

    try:
        result = service_apply_due_subscription_changes(ctx=ctx)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


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
    """
    _require_api_key(x_api_key)
    ctx = service_ctx("maintenance.account_hard_delete")

    try:
        result = service_account_hard_delete(
            ctx=ctx,
            dry_run=payload.dry_run,
            only_user_id=payload.only_user_id,
        )
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)