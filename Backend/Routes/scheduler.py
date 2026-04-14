from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import JSONResponse

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import service_ctx
from Services.scheduler import service_run_master_scheduler

router = APIRouter(prefix="/scheduler", tags=["scheduler"])

def _verify_cron_auth(x_api_key: str | None) -> None:
    """Overenie, že request prichádza z Google Schedulera (cez náš kľúč)."""
    if not MAINTENANCE_API_KEY or x_api_key != MAINTENANCE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized scheduler access",
        )

@router.post("/trigger")
async def scheduler_trigger_endpoint(
    x_api_key: str | None = Header(default=None),
):
    """
    MASTER TRIGGER: Volaný Google Schedulerom každú hodinu.
    Deleguje logiku do Services.scheduler.
    """
    # 1. Kontrola autorizácie
    _verify_cron_auth(x_api_key)
    
    # 2. Inicializácia kontextu
    ctx = service_ctx("scheduler.master_trigger")

    # 3. Spustenie biznis logiky v Services
    try:
        result_data = service_run_master_scheduler(ctx=ctx)
        return JSONResponse(result_data)
    except Exception as e:
        print(f"[SCHEDULER] Kritická chyba v routeri: {e}")
        return JSONResponse(
            {"status": "failed", "error": str(e)}, 
            status_code=500
        )