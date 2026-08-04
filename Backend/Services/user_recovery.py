# Services/user_recovery.py
from __future__ import annotations

from typing import List, Dict, Any
from fastapi import HTTPException

from DB.user_recovery import (
    db_get_recovery_record,
    db_insert_recovery,
    db_update_recovery,
    db_get_recent_recovery,
)

from Modules.Supabase.auth import AuthCtx

# kľúče ktoré nikdy nesmú ísť do update patchu
_ID_KEYS = {"id", "user_id", "date", "created_at", "updated_at"}


def service_check_recovery_and_adjust(user_id: int, ctx: AuthCtx) -> bool:
    """
    Skontroluje ranné merania (HRV a RHR) a porovná ich s baseline (posledných 14 dní).
    Ak deteguje výrazný prepad HRV alebo nárast RHR, spustí Auto-Recovery job.
    """
    from Services.async_jobs import service_enqueue_job
    
    # Načítame históriu za posledných 14 dní
    rows = db_get_recent_recovery(user_id=user_id, days=14, ctx=ctx)
    
    # Potrebujeme aspoň 4 dni histórie, aby sme vedeli urobiť zmysluplný priemer
    if not rows or len(rows) < 4:
        return False

    latest = rows[0]
    past_rows = rows[1:] # Všetko okrem dnešného dňa

    # Vytiahneme hodnoty pre baseline (s typovou kontrolou)
    past_hrv = [float(r["HRV_avg_ms"]) for r in past_rows if isinstance(r.get("HRV_avg_ms"), (int, float, str))]
    past_rhr = [float(r["RHR_bpm"]) for r in past_rows if isinstance(r.get("RHR_bpm"), (int, float, str))]

    raw_hrv = latest.get("HRV_avg_ms")
    latest_hrv = float(raw_hrv) if isinstance(raw_hrv, (int, float, str)) and raw_hrv else None

    raw_rhr = latest.get("RHR_bpm")
    latest_rhr = float(raw_rhr) if isinstance(raw_rhr, (int, float, str)) and raw_rhr else None

    needs_recovery = False

    # 1. Kontrola HRV (Prepad o viac ako 15% voči baseline je zlý)
    if latest_hrv and past_hrv:
        baseline_hrv = sum(past_hrv) / len(past_hrv)
        if latest_hrv < (baseline_hrv * 0.85):
            needs_recovery = True

    # 2. Kontrola RHR (Nárast o viac ako 10% voči baseline je zlý)
    if not needs_recovery and latest_rhr and past_rhr:
        baseline_rhr = sum(past_rhr) / len(past_rhr)
        if latest_rhr > (baseline_rhr * 1.10):
            needs_recovery = True

    # Ak je to zlé, odpálime expresný Auto-Recovery job (ktorý prepíše dnešný tréning)
    if needs_recovery:
        latest_date = str(latest.get("date"))[:10]
        try:
            service_enqueue_job(
                user_id=user_id,
                job_type="coach_autoadjust",
                payload={"force_reason": "autorecovery"},
                priority=150, # Vyššia priorita, lebo sa to týka dnešného dňa
                dedupe_key=f"autorecovery_{user_id}_{latest_date}", # Len raz za deň
                ctx=ctx
            )
            print(f"[RECOVERY] Auto-recovery triggered for user {user_id} on {latest_date}")
            return True
        except Exception as e:
            print(f"[RECOVERY] Failed to trigger auto-recovery: {repr(e)}")
            
    return False


def service_insert_or_update_recovery(
    payload: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    PATCH semantics:
    - payload obsahuje len polia ktoré prišli z FE (route robí exclude_unset=True)
    - ak je field v payload a je None -> zmaž v DB (explicitne)
    - ak field nie je v payload -> DB sa ho nedotkne
    """

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")

    if "user_id" not in payload:
        raise HTTPException(status_code=422, detail="Missing user_id")
    if "date" not in payload or not payload.get("date"):
        # ⚠️ nerob fallback na 'dnes' – user by nevedel čo updatuje
        raise HTTPException(status_code=422, detail="Missing date")

    user_id = int(payload["user_id"])
    date_iso = str(payload["date"])[:10]

    patch: Dict[str, Any] = {
        k: v for k, v in payload.items() if k not in _ID_KEYS
    }

    existing = db_get_recovery_record(user_id, date_iso, ctx=ctx)

    if existing:
        rec_id = int(existing["id"])

        # nič na update? tak len vráť že existuje
        if not patch:
            return {"updated": True, "row": {"id": rec_id, "user_id": user_id, "date": date_iso}}

        updated_row = db_update_recovery(rec_id, patch, ctx=ctx)
        
        # Po úspešnom update skontrolujeme, či nepotrebuje zmeniť dnešný tréning
        service_check_recovery_and_adjust(user_id=user_id, ctx=ctx)
        
        return {
            "updated": True,
            "row": updated_row,
        }

    # insert: musí obsahovať identity + patch (aj keby bol prázdny)
    insert_row: Dict[str, Any] = {"user_id": user_id, "date": date_iso, **patch}
    inserted_row = db_insert_recovery(insert_row, ctx=ctx)
    
    # NOVÉ: Po úspešnom inserte skontrolujeme, či nepotrebuje zmeniť dnešný tréning
    service_check_recovery_and_adjust(user_id=user_id, ctx=ctx)

    return {
        "updated": False,
        "row": inserted_row,
    }


def service_get_recovery(
    user_id: int,
    ctx: AuthCtx,
    days: int = 14,
) -> List[Dict[str, Any]]:

    return db_get_recent_recovery(
        user_id,
        days,
        ctx=ctx,
    )


def service_build_recovery_block_for_analysis(
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Blok pre CoachAnalyzeInput["recovery"].

    Režimy:
      - service=False: RLS klient (require_jwt).
      - service=True: service klient (user_jwt forward, bez require_jwt).
    """

    rows = db_get_recent_recovery(
        user_id,
        days=21,
        ctx=ctx,
    )
    if not rows:
        return {
            "rhr_bpm": None,
            "hrv_avg": None,
            "hrv_trend": None,
            "sleep_ok": None,
            "last_illness_days_ago": None,
        }

    latest = rows[0]

    rhr = latest.get("RHR_bpm")
    hrv = latest.get("HRV_avg_ms")
    sleep = latest.get("sleep_duration_min")

    # HRV TREND: posledných 7 dní
    raw_vals = [r.get("HRV_avg_ms") for r in rows[:7]]
    hrv_vals = [v for v in raw_vals if isinstance(v, (int, float)) and v > 0]

    trend = None
    if len(hrv_vals) >= 3:
        newest = hrv_vals[-1]
        oldest = hrv_vals[0]

        if newest > oldest + 5:
            trend = "up"
        elif newest < oldest - 5:
            trend = "down"
        else:
            trend = "stable"

    return {
        "rhr_bpm": rhr,
        "hrv_avg": hrv,
        "hrv_trend": trend,
        "sleep_ok": (sleep is not None and sleep >= 360),  # 6h+
        "last_illness_days_ago": None,
    }