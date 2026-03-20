# Routes_FE/users_health_log.py
from fastapi import APIRouter, HTTPException, Request
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from Services.user_health_log import (
    service_get_active_health,
    service_get_health_history,
    service_save_health_logs,
    service_resolve_health_log,
    service_delete_health_log
)
from Modules.Supabase.auth import get_auth_ctx, require_user

router = APIRouter(prefix="/health-log", tags=["health-log"])

# Pydantic schema pre hromadný insert
class HealthLogPayload(BaseModel):
    event_type: str
    status: Optional[str] = "active"
    severity: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

class HealthLogBatchPayload(BaseModel):
    logs: List[HealthLogPayload]

@router.get("/active/{user_id}")
def get_active_health(req: Request, user_id: int):
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_get_active_health(user_id=user_id, ctx=ctx)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{user_id}")
def get_health_history(req: Request, user_id: int):
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_get_health_history(user_id=user_id, ctx=ctx)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save/{user_id}")
def save_health_logs(req: Request, user_id: int, payload: HealthLogBatchPayload):
    try:
        ctx = require_user(get_auth_ctx(req))
        # Konverzia pydantic objektov na dict
        logs_dicts = [item.model_dump() for item in payload.logs]
        data = service_save_health_logs(user_id=user_id, logs_payload=logs_dicts, ctx=ctx)
        return {"success": True, "data": data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/resolve/{user_id}/{log_id}")
def resolve_health_log(req: Request, user_id: int, log_id: int, end_date: Optional[str] = None): # <--- TU JE ZMENA
    try:
        ctx = require_user(get_auth_ctx(req))
        data = service_resolve_health_log(user_id=user_id, log_id=log_id, end_date=end_date, ctx=ctx)
        return {"success": True, "data": data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    
@router.delete("/delete/{user_id}/{log_id}")
def delete_health_log(req: Request, user_id: int, log_id: int):
    try:
        ctx = require_user(get_auth_ctx(req))
        success = service_delete_health_log(user_id=user_id, log_id=log_id, ctx=ctx)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))