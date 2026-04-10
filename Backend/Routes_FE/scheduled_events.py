# Routes_FE/sheduled_events.py
from __future__ import annotations

from typing import Dict
from fastapi import APIRouter, Body, Header, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Dict 
from Services.notifications import (
    service_cron_notify_recovery,
    service_cron_notify_review,
    service_cron_notify_training,
    service_send_push_notification
        
)

from Services.AI.athlete_state.main import (
    service_run_weekly_athlete_state
)

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import service_ctx
from Modules.Supabase.client import get_service_client

router = APIRouter(prefix="/scheduled-events", tags=["scheduled_events"])

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
    
@router.post("/weekly-athlete-state-refresh")
async def weekly_athlete_state_refresh_endpoint(
    max_users: int = Body(0, embed=True),
    x_api_key: str | None = Header(default=None),
):
    """
    Spustí AI analýzu atleta pre všetkých userov (alebo prvých max_users)
    a uloží výsledok do coach_athlete_state.
    """
    _require_api_key(x_api_key)
    ctx = service_ctx("maintenance.weekly_athlete_state_refresh")

    try:
        # Celá logika je teraz schovaná v servise!
        result = service_run_weekly_athlete_state(max_users=max_users, ctx=ctx)
        return JSONResponse({"ok": True, "result": result})
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
    
@router.post("/check-ai-models")
async def timed_check_ai_models(
    admin_email: str = Body(..., embed=True),
    x_api_key: str | None = Header(default=None),
):
    """
    Spúšťané Cron Schedulerom (napr. raz denne).
    Skontroluje AI modely a ak chýbajú, pošle push notifikáciu priamo adminovi.
    """
    _require_api_key(x_api_key)
    ctx = service_ctx("notifications_timed.check_ai")

    try:
        from Services.AI.provider.provider import check_configured_models_health
        health = check_configured_models_health()

        # Ak je všetko v poriadku, končíme potichu (žiadny spam pre teba)
        if health["ok"]:
            return JSONResponse({"ok": True, "message": "Všetky nastavené AI modely sú dostupné."})

        # --- NIEČO CHÝBA, IDEME BURCOVAŤ ADMINA ---
        
        # 1. Zostavíme varovnú správu
        alerts = []
        if health["missing_openai"]:
            alerts.append(f"Chýba OpenAI: {', '.join(health['missing_openai'])}")
        if health["missing_gemini"]:
            alerts.append(f"Chýba Gemini: {', '.join(health['missing_gemini'])}")
        if health["api_errors"]:
            alerts.append("Chyby API spojenia!")
            
        warning_message = " | ".join(alerts)

        # 2. Nájdeme UID (integer ID) admina podľa e-mailu v Supabase
        sb = get_service_client()
        
        # Pozor: tvoja funkcia 'service_send_push_notification' očakáva 'user_id' (integer), 
        # takže hľadáme stĺpec 'id'
        user_resp = sb.table("users").select("id").eq("email", admin_email).single().execute()
        admin_id = user_resp.data.get("id") if user_resp.data else None

        if not admin_id:
            return JSONResponse({"ok": False, "error": f"Admin email {admin_email} nenájdený v DB."})

        # 3. Pošleme ti súkromnú Push Notifikáciu cez tvoju univerzálnu funkciu
        push_result = service_send_push_notification(
            user_id=int(admin_id),
            title="⚠️ AI Model Výpadok",
            body=warning_message,
            url="/hq-secure-zone", # Hodí ťa to rovno do Command Centra
            ctx=ctx
        )

        return JSONResponse({
            "ok": True, 
            "message": "Problém detegovaný. Push notifikácia odoslaná adminovi.",
            "push_details": push_result
        })

    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)