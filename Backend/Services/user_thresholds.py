# Services/user_thresholds.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from Routes_DB.user_thresholds import (
    db_list_user_thresholds_raw,
    db_get_user_threshold_latest,
    db_upsert_user_threshold,
)
from Services.users import require_jwt


def _num(v: Any) -> Optional[float]:
    try:
        if v is None or v == "":
            return None
        return float(v)
    except Exception:
        return None


def _canon_sport(s: Optional[str]) -> str:
    if not s:
        return "running"
    t = str(s).strip().lower()
    if t in ("run", "running"):
        return "running"
    if t in ("ride", "bike", "cycling"):
        return "cycling"
    return t  # nechaj iné hodnoty (swim, rowing, ...)


def _row_norm(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "sport": row.get("sport"),
        "threshold_type": row.get("threshold_type"),
        "updated_at": row.get("updated_at"),
        "hr_bpm": _num(row.get("hr_bpm")),
        "pace_sec_km": _num(row.get("pace_sec_km")),
        "power_watt": _num(row.get("power_watt")),
        "measurement_type": row.get("measurement_type"),
    }


# ---------- PUBLIC SERVICE FUNKCIE PRE ROUTERY / FE ----------


def service_list_user_thresholds(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Všetky threshold riadky usera (DESC podľa updated_at), normalizované.
    """
    user_jwt = require_jwt(user_jwt)
    rows = db_list_user_thresholds_raw(user_id, user_jwt=user_jwt)
    return [_row_norm(r) for r in rows]


def service_list_latest_per_combo(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Najnovší riadok pre každú kombináciu (sport, threshold_type).
    """
    rows = service_list_user_thresholds(user_id, user_jwt=user_jwt)  # už DESC
    seen: set[Tuple[str, str]] = set()
    out: List[Dict[str, Any]] = []
    for r in rows:
        key = (
            str(r.get("sport") or "").lower(),
            str(r.get("threshold_type") or "").upper(),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def service_load_user_thresholds(
    user_id: int,
    sport: str = "running",
    threshold_type: str = "LT2",
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Najnovší threshold pre daný sport+type (default running/LT2).
    """
    user_jwt = require_jwt(user_jwt)
    canon = _canon_sport(sport)
    row = db_get_user_threshold_latest(
        user_id,
        canon,
        threshold_type,
        user_jwt=user_jwt,
    )
    return _row_norm(row) if row else None


def service_upsert_user_threshold(
    user_id: int,
    payload: Dict[str, Any],
    user_jwt: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Uloží / upsertne threshold a vráti najnovší stav pre daný sport+type.
    """
    user_jwt = require_jwt(user_jwt)

    sport = _canon_sport(payload.get("sport"))
    t_type = payload.get("threshold_type") or "LT2"

    row = {
        "sport": sport,
        "threshold_type": t_type,
        "hr_bpm": _num(payload.get("hr_bpm")),
        "pace_sec_km": _num(payload.get("pace_sec_km")),
        "power_watt": _num(payload.get("power_watt")),
        "measurement_type": payload.get("measurement_type") or "manual",
    }

    # vyhoď None – nech do DB nejde bordel
    clean = {k: v for k, v in row.items() if v is not None}

    db_upsert_user_threshold(
        user_id,
        clean,
        user_jwt=user_jwt,
    )

    return service_load_user_thresholds(
        user_id,
        sport=sport,
        threshold_type=t_type,
        user_jwt=user_jwt,
    )


# ---------- BLOK PRE ANALÝZU (CoachAnalyzeInput.thresholds) ----------


def service_build_thresholds_block_for_analysis(
    user_id: int,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Blok pre CoachAnalyzeInput["thresholds"] – fokus na running LT2.
    """
    user_jwt = require_jwt(user_jwt)

    rows = service_list_user_thresholds(
        user_id,
        user_jwt=user_jwt,
    )

    if not rows:
        return {
            "run": {
                "lthr_bpm": None,
                "pace_lthr_s_per_km": None,
                "ftp_power_w": None,
                "vo2max_estimate": None,
            }
        }

    best: Optional[Dict[str, Any]] = None

    # 1) running + LT2 / HR_LT2 / PACE_LT2
    for r in rows:
        sport = str(r.get("sport") or "").lower()
        ttype = str(r.get("threshold_type") or "").upper()
        if sport == "running" and ttype in ("LT2", "HR_LT2", "PACE_LT2"):
            best = r
            break

    # 2) fallback: prvý running
    if not best:
        for r in rows:
            sport = str(r.get("sport") or "").lower()
            if sport == "running":
                best = r
                break

    if not best:
        return {
            "run": {
                "lthr_bpm": None,
                "pace_lthr_s_per_km": None,
                "ftp_power_w": None,
                "vo2max_estimate": None,
            }
        }

    block_run = {
        "lthr_bpm": best.get("hr_bpm"),
        "pace_lthr_s_per_km": best.get("pace_sec_km"),
        "ftp_power_w": None,  # bike FTP nateraz neriešime
        "vo2max_estimate": None,  # môžeš doplniť neskôr
    }

    return {"run": block_run}
