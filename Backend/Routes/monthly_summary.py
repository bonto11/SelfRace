# Routes_FE/monthly_summary.py
from __future__ import annotations
from typing import Any, Dict
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Request
from Services.monthly_summary import service_get_monthly_summary
from Services.AI.monthly_review.generate import service_generate_monthly_review
from DB.user_prefs import db_get_pref_single
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/monthly-summary", tags=["monthly-summary"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _resolve_ym(year: Any, month: Any) -> tuple[int, int]:
    now = _now()
    y = int(year)  if year  else now.year
    m = int(month) if month else now.month
    if not (1 <= m <= 12):
        raise ValueError(f"Invalid month: {m}")
    return y, m


# ── GET /monthly-summary/{user_id} ──────────────────────────────────────────
@router.get("/{user_id}")
def get_monthly_summary(
    user_id: int,
    req: Request,
    year:  int = Query(default=None),
    month: int = Query(default=None),
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        y, m = _resolve_ym(year, month)
        data = service_get_monthly_summary(user_id=user_id, year=y, month=m, ctx=ctx)
        return {"success": True, "data": data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /monthly-summary/{user_id}/review — načíta uložený review ───────────
@router.get("/{user_id}/review")
def get_monthly_review(
    user_id: int,
    req: Request,
    year:  int = Query(default=None),
    month: int = Query(default=None),
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        y, m = _resolve_ym(year, month)
        row = db_get_pref_single(
            user_id=user_id,
            key=f"monthly_review.{y}-{m:02d}",
            ctx=ctx,
        )
        if not row:
            return {"success": True, "data": None}
        val = row.get("value") if isinstance(row, dict) else row
        return {"success": True, "data": val}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /monthly-summary/{user_id}/review — generuje review (TEST + scheduler)
@router.post("/{user_id}/review")
def generate_monthly_review(
    user_id: int,
    req: Request,
    year:  int = Query(default=None),
    month: int = Query(default=None),
) -> Dict[str, Any]:
    """
    Spustí AI mesačné hodnotenie a uloží výsledok.
    TEST: volané FE tlačidlom počas vývoja.
    PRODUCTION: volané schedulerom každý 1. v mesiaci pre uzavretý mesiac.
    """
    try:
        ctx = require_user(get_auth_ctx(req))
        now = _now()
        # Default: predchádzajúci uzavretý mesiac
        if not year and not month:
            m = now.month - 1 or 12
            y = now.year if now.month > 1 else now.year - 1
        else:
            y, m = _resolve_ym(year, month)

        result = service_generate_monthly_review(
            user_id=user_id, year=y, month=m, ctx=ctx, save_result=True
        )
        if not result.get("ok"):
            return {"success": False, "reason": result.get("reason"), "error": result.get("error")}
        return {"success": True, "data": result["data"]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))