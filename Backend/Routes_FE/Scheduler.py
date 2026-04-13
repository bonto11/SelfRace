from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import JSONResponse

from Configs.config import MAINTENANCE_API_KEY
from Modules.Supabase.auth import service_ctx
from Modules.Supabase.client import get_service_client
from Services.async_jobs import service_enqueue_job

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
    MASTER TRIGGER: Volaný Google Schedulerom každú hodinu (0 * * * *).
    Tento endpoint riadi 'Fan-out' logiku – rozosielanie úloh do async_jobs.
    """
    _verify_cron_auth(x_api_key)
    
    # Inicializácia kontextu a DB klienta
    ctx = service_ctx("scheduler.master_trigger")
    supabase = get_service_client()

    # Nastavenie času pre Bratislavu
    tz_ba = ZoneInfo("Europe/Bratislava")
    now_ba = datetime.now(tz_ba)
    current_hour = now_ba.hour
    current_weekday = now_ba.weekday()  # 0=Pondelok, 6=Nedeľa

    print(f"--- [SCHEDULER PING] {now_ba.strftime('%Y-%m-%d %H:%M:%S')} ---")

    # =========================================================================
    # 1. KAŽDOHODINOVÁ LOGIKA
    # =========================================================================
    print(f"[SCHEDULER] Hodinová kontrola spustená (Hour: {current_hour})")
    # Tu môže ísť napr. service_check_ai_models() atď.

    # =========================================================================
    # 2. DOOBEDNÁ LOGIKA (napr. o 11:00)
    # =========================================================================
    if current_hour == 11:
        print("[SCHEDULER] ☀️ Je 11:00. Spúšťam doobedné spracovanie dát...")
        # Ukážka: Tu by si mohol enqueuovať nejaký špecifický job

    # =========================================================================
    # 3. VEČERNÝ FAN-OUT (o 19:00) - Generovanie denných plánov
    # =========================================================================
    if current_hour == 19:
        print("[SCHEDULER] 🌙 Je 19:00. Spúšťam Fan-out pre 'daily_generate' pre všetkých userov.")
        
        try:
            # Načítame všetkých aktívnych používateľov
            users_res = supabase.table("profiles").select("id").execute()
            active_users = [row["id"] for row in users_res.data] if users_res.data else []
            
            count = 0
            for uid in active_users:
                try:
                    # Enqueue do tvojej existujúcej async_jobs tabuľky
                    service_enqueue_job(
                        user_id=uid,
                        job_type="daily_generate",
                        payload={
                            "week_index": 0,
                            "reason": "auto_evening_cron",
                            "drop_past_days": False
                        },
                        priority=100,
                        # Dedupe kľúč: daily_gen:YYYY-MM-DD:user_id
                        dedupe_key=f"daily_gen:{now_ba.strftime('%Y%m%d')}:{uid}",
                        ctx=ctx
                    )
                    count += 1
                except Exception as e:
                    print(f"[SCHEDULER] ❌ Chyba pri enqueue pre {uid}: {e}")
            
            print(f"[SCHEDULER] ✅ Úspešne pridaných {count} jobov do fronty.")

        except Exception as e:
            print(f"[SCHEDULER] ❌ Kritické zlyhanie pri načítaní userov: {e}")

    # =========================================================================
    # 4. TÝŽDENNÁ LOGIKA (Nedeľa o 23:00) - Príprava na nový týždeň
    # =========================================================================
    if current_weekday == 6 and current_hour == 23:
        print("[SCHEDULER] 📅 Je Nedeľa večer. Spúšťam Fan-out pre 'weekly_generate'.")
        # Logika pre weekly_generate podobná ako vyššie
        pass

    return JSONResponse({
        "status": "executed",
        "hour": current_hour,
        "weekday": current_weekday,
        "timestamp_ba": now_ba.isoformat()
    })
