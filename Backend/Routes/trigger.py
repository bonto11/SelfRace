from __future__ import annotations

from fastapi import APIRouter, Body, Header, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Dict, Any

from Configs.config import CRON_SECRET, MAINTENANCE_API_KEY
from Modules.Supabase.auth import service_ctx

# Predpokladám, že tvoj Services súbor si premenoval na trigger_tasks.py
from Services.trigger_tasks import service_run_master_scheduler

router = APIRouter(prefix="/trigger", tags=["trigger"])

def _verify_cron_auth(authorization: str | None) -> None:
    """Overenie, že request prichádza z Google Schedulera s Bearer tokenom."""
    if not CRON_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CRON_SECRET is not configured on the server.",
        )
        
    expected_header = f"Bearer {CRON_SECRET}"
    
    if not authorization or authorization != expected_header:
        print(f"[AUTH ERROR CRON] Expected: '{expected_header}', Got: '{authorization}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized scheduler access",
        )

def _verify_admin_auth(x_api_key: str | None) -> None:
    """Overenie, že request prichádza z Admin panela (cez API Key)."""
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        print(f"[AUTH ERROR ADMIN] Invalid Maintenance API Key used.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Admin API Key",
        )

@router.post("/manual")
async def manual_trigger_endpoint(
    # Použijeme dict, aby sa predišlo chybám 422, ak by frontend neposlal nič
    payload: Dict[str, Any] = Body(default={}),
    x_api_key: str | None = Header(default=None),
):
    """
    Endpoint pre manuálne spustenie konkrétnej úlohy z Admin panela.
    Vyžaduje parameter 'task' v tele požiadavky.
    """
    _verify_admin_auth(x_api_key)
    
    task = payload.get("task")
    ctx = service_ctx(f"trigger.manual.{task}")

    try:
        # Pevne definujeme mode="manual", frontend to nemusí posielať
        result_data = service_run_master_scheduler(ctx=ctx, mode="manual", task=task)
        return JSONResponse(result_data)
    except Exception as e:
        print(f"[TRIGGER MANUAL] Kritická chyba: {e}")
        return JSONResponse(
            {"status": "failed", "error": str(e)}, 
            status_code=500
        )
    
@router.post("/scheduled")
async def scheduled_trigger_endpoint(
    payload: Dict[str, Any] = Body(default={}),
    authorization: str | None = Header(default=None),
):
    """
    Endpoint pre automatický časovač (Google Scheduler).
    Vykonáva úlohy čisto na základe aktuálneho času.
    """
    _verify_cron_auth(authorization)
    ctx = service_ctx("trigger.scheduled")

    try:
        # Pevne definujeme mode="scheduled", task nie je potrebný
        result_data = service_run_master_scheduler(ctx=ctx, mode="scheduled", task=None)
        return JSONResponse(result_data)
    except Exception as e:
        print(f"[TRIGGER SCHEDULED] Kritická chyba: {e}")
        return JSONResponse(
            {"status": "failed", "error": str(e)}, 
            status_code=500
        )