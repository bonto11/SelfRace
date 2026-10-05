# Services/user_recovery.py
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

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

# ============================================================
# 🌟 NOVÉ: FAKTORY A POZNÁMKA K NOCI
# ============================================================
# Čísla bez kontextu klamú. HRV dole po víne a HRV dole tretí deň po sebe
# bez príčiny sú dve úplne iné situácie - prvá je jednorazová, druhá je
# signál preťaženia alebo začínajúcej choroby. Tréner to rozlišuje, AI
# to doteraz nevidela, lebo dostávala len čísla posledného dňa.
#
# Ľavá strana je kľúč, ktorý ide do AI kontextu (nemeň - na tieto názvy
# sa odkazujú prompty), pravá je názov stĺpca v DB.
RECOVERY_FACTOR_COLUMNS: Dict[str, str] = {
    "alcohol": "alcohol_consumed",
    "late_caffeine": "caffeine_8h",
    "late_food": "food_2h_before",
}
RECOVERY_NOTE_COLUMN = "comments"

# Koľko dní ide do AI kontextu ako denný priebeh. Týždeň stačí na to,
# aby bol vidieť trend, a nezahltí kontext.
RECENT_DAYS_FOR_AI = 7

# Okno pre baseline (bežný priemer). Dnešok sa do neho nepočíta.
BASELINE_DAYS = 14

MAX_NOTE_LEN = 200


def _num(v: Any) -> Optional[float]:
    """Bezpečná konverzia na float, None pri prázdnej/nečíselnej hodnote."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f > 0 else None


def _truthy(v: Any) -> bool:
    """Faktor môže prísť ako bool, 'true', 1..."""
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    if isinstance(v, str):
        return v.strip().lower() in ("true", "1", "yes", "ano", "áno")
    return False


def _row_factors(row: Dict[str, Any]) -> List[str]:
    """Zoznam aktívnych faktorov pre jednu noc (napr. ['alcohol'])."""
    return [
        key for key, col in RECOVERY_FACTOR_COLUMNS.items() if _truthy(row.get(col))
    ]


def _row_note(row: Dict[str, Any]) -> Optional[str]:
    note = row.get(RECOVERY_NOTE_COLUMN)
    if not isinstance(note, str):
        return None
    note = note.strip()
    return note[:MAX_NOTE_LEN] if note else None


def _days_ago(date_raw: Any) -> Optional[int]:
    try:
        d = date.fromisoformat(str(date_raw)[:10])
    except (TypeError, ValueError):
        return None
    return max(0, (date.today() - d).days)


def _avg(values: List[float]) -> Optional[float]:
    return round(sum(values) / len(values), 1) if values else None


# ============================================================
# AUTO-RECOVERY
# ============================================================

def service_check_recovery_and_adjust(user_id: int, ctx: AuthCtx) -> bool:
    """
    Skontroluje ranné merania (HRV a RHR) a porovná ich s baseline (posledných 14 dní).
    Ak deteguje výrazný prepad HRV alebo nárast RHR, spustí Auto-Recovery job.

    Faktory (alkohol a pod.) zámerne trigger NEVYPÍNAJÚ - aj po víne je
    rozumné dať si ľahší deň. Rozdiel je v tom, prečo; ten rieši AI pri
    hodnotení, nie tento jednoduchý prah.
    """
    from Services.async_jobs import service_enqueue_job

    rows = db_get_recent_recovery(user_id=user_id, days=14, ctx=ctx)

    # Potrebujeme aspoň 4 dni histórie, aby sme vedeli urobiť zmysluplný priemer
    if not rows or len(rows) < 4:
        return False

    latest = rows[0]
    past_rows = rows[1:]  # Všetko okrem dnešného dňa

    past_hrv = [v for r in past_rows if (v := _num(r.get("HRV_avg_ms"))) is not None]
    past_rhr = [v for r in past_rows if (v := _num(r.get("RHR_bpm"))) is not None]

    latest_hrv = _num(latest.get("HRV_avg_ms"))
    latest_rhr = _num(latest.get("RHR_bpm"))

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
                priority=150,  # Vyššia priorita, lebo sa to týka dnešného dňa
                dedupe_key=f"autorecovery_{user_id}_{latest_date}",  # Len raz za deň
                ctx=ctx,
            )
            print(f"[RECOVERY] Auto-recovery triggered for user {user_id} on {latest_date}")
            return True
        except Exception as e:  # noqa: BLE001
            print(f"[RECOVERY] Failed to trigger auto-recovery: {repr(e)}")

    return False


# ============================================================
# CRUD
# ============================================================

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

    patch: Dict[str, Any] = {k: v for k, v in payload.items() if k not in _ID_KEYS}

    existing = db_get_recovery_record(user_id, date_iso, ctx=ctx)

    if existing:
        rec_id = int(existing["id"])

        # nič na update? tak len vráť že existuje
        if not patch:
            return {"updated": True, "row": {"id": rec_id, "user_id": user_id, "date": date_iso}}

        updated_row = db_update_recovery(rec_id, patch, ctx=ctx)

        # Po úspešnom update skontrolujeme, či nepotrebuje zmeniť dnešný tréning
        service_check_recovery_and_adjust(user_id=user_id, ctx=ctx)

        return {"updated": True, "row": updated_row}

    # insert: musí obsahovať identity + patch (aj keby bol prázdny)
    insert_row: Dict[str, Any] = {"user_id": user_id, "date": date_iso, **patch}
    inserted_row = db_insert_recovery(insert_row, ctx=ctx)

    # Po úspešnom inserte skontrolujeme, či nepotrebuje zmeniť dnešný tréning
    service_check_recovery_and_adjust(user_id=user_id, ctx=ctx)

    return {"updated": False, "row": inserted_row}


def service_get_recovery(
    user_id: int,
    ctx: AuthCtx,
    days: int = 14,
) -> List[Dict[str, Any]]:

    return db_get_recent_recovery(user_id, days, ctx=ctx)


# ============================================================
# AI KONTEXT
# ============================================================

def service_build_recovery_block_for_analysis(
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Blok "recovery" pre AI analýzy (athlete state, hodnotenie aktivity).

    🌟 ZMENA: okrem čísel posledného dňa ide do AI aj:
      - baseline (bežný priemer HRV a RHR za 14 dní bez dneška)
      - recent_days: denný priebeh za posledný týždeň VRÁTANE faktorov
        (alkohol, neskorá káva, ťažké jedlo) a poznámky k noci

    Vďaka tomu AI vie rozlíšiť jednorazový prepad s jasnou príčinou od
    opakovaného prepadu bez príčiny - čo je presne rozdiel, ktorý robí
    tréner medzi "dnes ľahšie" a "pozor, preťaženie".

    🐞 OPRAVA: hrv_trend bol otočený. db_get_recent_recovery vracia riadky
    od NAJNOVŠIEHO, ale kód bral posledný prvok ako najnovší - pri klesajúcej
    HRV dostala AI "up".
    """
    rows = db_get_recent_recovery(user_id, days=21, ctx=ctx)
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

    # HRV TREND: posledných 7 dní. rows sú zoradené od najnovšieho, takže
    # hrv_vals[0] je najnovší a hrv_vals[-1] najstarší.
    hrv_vals = [v for r in rows[:7] if (v := _num(r.get("HRV_avg_ms"))) is not None]

    trend = None
    if len(hrv_vals) >= 3:
        newest = hrv_vals[0]
        oldest = hrv_vals[-1]
        if newest > oldest + 5:
            trend = "up"
        elif newest < oldest - 5:
            trend = "down"
        else:
            trend = "stable"

    # Baseline bez dneška - voči nemu sa posudzuje, či je dnešok výnimka
    baseline_rows = rows[1 : 1 + BASELINE_DAYS]
    baseline_hrv = _avg(
        [v for r in baseline_rows if (v := _num(r.get("HRV_avg_ms"))) is not None]
    )
    baseline_rhr = _avg(
        [v for r in baseline_rows if (v := _num(r.get("RHR_bpm"))) is not None]
    )

    recent_days: List[Dict[str, Any]] = []
    for r in rows[:RECENT_DAYS_FOR_AI]:
        day: Dict[str, Any] = {
            "days_ago": _days_ago(r.get("date")),
            "hrv_ms": _num(r.get("HRV_avg_ms")),
            "rhr_bpm": _num(r.get("RHR_bpm")),
            "sleep_min": _num(r.get("sleep_duration_min")),
        }
        # skóre spánku z hodiniek – len keď ho user má (intervals.icu)
        score = _num(r.get("sleep_score"))
        if score is not None:
            day["sleep_score"] = score
        factors = _row_factors(r)
        if factors:
            day["factors"] = factors
        note = _row_note(r)
        if note:
            day["note"] = note
        recent_days.append(day)

    return {
        "rhr_bpm": rhr,
        "hrv_avg": hrv,
        "hrv_trend": trend,
        "sleep_ok": (sleep is not None and sleep >= 360),  # 6h+
        "last_illness_days_ago": None,
        "baseline_hrv_ms": baseline_hrv,
        "baseline_rhr_bpm": baseline_rhr,
        "latest_factors": _row_factors(latest) or None,
        "latest_note": _row_note(latest),
        "latest_sleep_score": _num(latest.get("sleep_score")),
        "recent_days": recent_days,
    }