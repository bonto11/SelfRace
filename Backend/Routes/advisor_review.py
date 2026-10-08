# Routes/advisor_review.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from Modules.Supabase.auth import get_auth_ctx, require_user, service_ctx
from Services.trainer_links import service_active_trainer_id, service_caller_trainer_of
from Services.AI.advisor_review.main import (
    service_generate_advisor_review,
    service_get_latest_advisor_review,
    service_list_advisor_reviews,
)

router = APIRouter(prefix="/advisor-review", tags=["advisor-review"])


@router.post("/generate/{user_id}")
def generate_advisor_review(req: Request, user_id: int) -> Dict[str, Any]:
    """
    Tlačidlo "Skontroluj mi týždeň". Spolu s nedeľným cronom je to jediné
    miesto, kde hodnotenie týždňa vzniká - nič iné ho neprepisuje.
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        # Živý tréner: so zverencom s aktívnym trénerom hodnotí štruktúru len
        # tréner (platí ho on a atlét ho nevidí). Atlét bez trénera = ako doteraz.
        trainer_id = service_active_trainer_id(user_id)
        if trainer_id:
            if service_caller_trainer_of(ctx, user_id) != trainer_id:
                return {
                    "success": False,
                    "data": None,
                    "error_code": "trainer_active",
                    "message": None,
                }
            result = service_generate_advisor_review(
                user_id=user_id,
                ctx=service_ctx(f"advisor_review.trainer.{trainer_id}"),
                model=None,
                force=True,
                trainer_user_id=trainer_id,
            )
        else:
            result = service_generate_advisor_review(
                user_id=user_id, ctx=ctx, model=None, force=True
            )
        if not result.get("ok"):
            return {
                "success": False,
                "data": None,
                "error_code": result.get("code") or "REQUEST_FAILED",
                "message": result.get("message"),
            }

        return {"success": True, "data": result, "error_code": None, "message": None}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest/{user_id}")
def get_latest_advisor_review(
    req: Request, user_id: int, audience: str = "athlete"
) -> Dict[str, Any]:
    """
    Posledné hodnotenie týždňa. Chýbajúce hodnotenie nie je chyba.

    Živý tréner: audience=trainer číta tréner (overí sa, že je aktívnym
    trénerom). Atlét s aktívnym trénerom dostane trainer_active=True a FE
    kartu hodnotenia skryje.
    """
    try:
        ctx = require_user(get_auth_ctx(req))

        trainer_id = service_active_trainer_id(user_id)
        if audience == "trainer":
            if not trainer_id or service_caller_trainer_of(ctx, user_id) != trainer_id:
                return {"success": True, "data": None, "error_code": None, "message": None}
            row = service_get_latest_advisor_review(user_id=user_id, ctx=ctx, audience="trainer")
            return {"success": True, "data": row, "error_code": None, "message": None}

        if trainer_id:
            return {
                "success": True,
                "data": None,
                "trainer_active": True,
                "error_code": None,
                "message": None,
            }

        row = service_get_latest_advisor_review(user_id=user_id, ctx=ctx)
        return {"success": True, "data": row, "error_code": None, "message": None}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{user_id}")
def list_advisor_reviews(req: Request, user_id: int, limit: int = 10) -> Dict[str, Any]:
    """História hodnotení (bez obsahu)."""
    try:
        ctx = require_user(get_auth_ctx(req))

        rows = service_list_advisor_reviews(user_id=user_id, limit=limit, ctx=ctx)
        return {"success": True, "data": rows, "error_code": None, "message": None}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))