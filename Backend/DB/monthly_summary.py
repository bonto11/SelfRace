# =============================================================================
# Routes_FE/monthly_summary.py  — NOVÝ SÚBOR
# =============================================================================
from __future__ import annotations
from typing import Any, Dict
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Request
from Services.monthly_summary import service_get_monthly_summary
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/monthly-summary", tags=["monthly-summary"])

@router.get("/{user_id}")
def get_monthly_summary(
    user_id: int,
    req: Request,
    year:  int = Query(default=None),
    month: int = Query(default=None),
) -> Dict[str, Any]:
    try:
        ctx = require_user(get_auth_ctx(req))
        now = datetime.now(timezone.utc)
        y = year  or now.year
        m = month or now.month
        if not (1 <= m <= 12):
            raise ValueError(f"Invalid month: {m}")
        data = service_get_monthly_summary(user_id=user_id, year=y, month=m, ctx=ctx)
        return {"success": True, "data": data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))