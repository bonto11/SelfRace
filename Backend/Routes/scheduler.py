from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import JSONResponse

# ZMENA: Importujeme CRON_SECRET namiesto MAINTENANCE_API_KEY
from Configs.config import CRON_SECRET 
from Modules.Supabase.auth import service_ctx
from Services.scheduler import service_run_master_scheduler

router = APIRouter(prefix="/scheduler", tags=["scheduler"])

def _verify_cron_auth(authorization: str | None) -> None:
    """Overenie, že request prichádza z Google Schedulera s Bearer tokenom."""
    if not CRON_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CRON_SECRET is not configured on the server.",
        )
        
    expected_header = f"Bearer {CRON_SECRET}"
    
    if not authorization or authorization != expected_header:
        # Vypíše to do logov, aby si presne videl, čo prišlo a čo sa čakalo (veľmi pomôže pri debuggovaní)
        print(f"[AUTH ERROR] Expected: '{expected_header}', Got: '{authorization}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized scheduler access",
        )

@router.post("/trigger")
async def scheduler_trigger_endpoint(
    authorization: str | None = Header(default=None),
):
    """
    MASTER TRIGGER: Volaný Google Schedulerom každú hodinu.
    Deleguje logiku do Services.scheduler.
    """

    print("trigger")
    
    # 1. Kontrola autorizácie (Bearer token)
    _verify_cron_auth(authorization)
    
    ctx = service_ctx("scheduler.master_trigger")

    try:
        result_data = service_run_master_scheduler(ctx=ctx)
        return JSONResponse(result_data)
    except Exception as e:
        print(f"[SCHEDULER] Kritická chyba v routeri: {e}")
        return JSONResponse(
            {"status": "failed", "error": str(e)}, 
            status_code=500
        )
