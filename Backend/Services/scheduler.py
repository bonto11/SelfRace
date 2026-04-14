from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Any, Dict

from Modules.Supabase.auth import AuthCtx
from Services.async_jobs import service_enqueue_job
from DB.users import db_list_users_for_cron

def service_run_master_scheduler(ctx: AuthCtx) -> Dict[str, Any]:
    """
    Hlavná riadiaca logika Schedulera.
    Podľa aktuálneho času v Bratislave spúšťa konkrétne cron úlohy a Fan-outy.
    """
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
    # Tu môže ísť napr. service_check_ai_models(), atď.

    # =========================================================================
    # 2. DOOBEDNÁ LOGIKA (napr. o 11:00)
    # =========================================================================
    if current_hour == 11:
        print("[SCHEDULER] ☀️ Je 11:00. Spúšťam doobedné spracovanie dát...")
        # Miesto pre ranné/doobedné úlohy

    # =========================================================================
    # 3. VEČERNÝ FAN-OUT (o 19:00) - Generovanie denných plánov
    # =========================================================================
    if current_hour == 19:
        print("[SCHEDULER] 🌙 Je 19:00. Spúšťam Fan-out pre 'daily_generate' pre všetkých userov.")
        
        try:
            # Použitie tvojej DB funkcie (dáme väčší limit, ak by bolo veľa userov)
            users = db_list_users_for_cron(limit=10000, ctx=ctx)
            
            count = 0
            for u in users:
                uid = u.get("id")
                if not uid:
                    continue
                
                try:
                    # Enqueue do async_jobs tabuľky
                    service_enqueue_job(
                        user_id=uid,
                        job_type="daily_generate",
                        payload={
                            "week_index": 0,
                            "reason": "auto_evening_cron",
                            "drop_past_days": False
                        },
                        priority=100,
                        # Dedupe kľúč: daily_gen:YYYYMMDD:user_id
                        dedupe_key=f"daily_gen:{now_ba.strftime('%Y%m%d')}:{uid}",
                        ctx=ctx
                    )
                    count += 1
                except Exception as e:
                    print(f"[SCHEDULER] ❌ Chyba pri enqueue pre usera {uid}: {e}")
            
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

    # Vrátime výsledok, ktorý Router len prepošle von
    return {
        "status": "executed",
        "hour": current_hour,
        "weekday": current_weekday,
        "timestamp_ba": now_ba.isoformat()
    }