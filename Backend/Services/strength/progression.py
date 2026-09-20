# Services/strength/progression.py
"""
Progresívne preťaženie z reálnych logov (strength_sessions).

Implementuje 2-for-2 pravidlo: keď athlete spraví o 2 opakovania viac než
horná hranica cieľového rozsahu v poslednej sérii, a to v dvoch po sebe
idúcich tréningoch toho istého cviku, je čas pridať váhu.

Bez tohto by AI nikdy nevedela, či má pridať záťaž - a presne to bol
dôvod, prečo tréningy pôsobili generické a bez progresu.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

# Prírastky podľa typu záťaže - menšie prírastky pre horné končatiny
# a jednostranné cviky, kde je 2.5 kg skok príliš veľký.
LOAD_INCREMENT_KG = {
    "barbell": 2.5,
    "machine": 5.0,
    "cable": 2.5,
    "dumbbell": 2.0,
    "kettlebell": 4.0,
    "implement": 5.0,
    "band": 0.0,       # gumy sa neprogresujú váhou
    "bodyweight": 0.0,  # bodyweight progresuje opakovaniami
}

# Koľko po sebe idúcich tréningov musí pravidlo platiť
CONSECUTIVE_SESSIONS_REQUIRED = 2

# Ak RPE pri poslednej sérii bolo takto vysoké, váhu nepridávame aj keď
# opakovania sedia - athlete bol na hranici.
RPE_CEILING = 9.0


def _parse_rep_range(reps: Any) -> Optional[tuple]:
    """'6-8' -> (6, 8), '10' -> (10, 10), '30s' -> None (časový cvik)."""
    s = str(reps or "").strip()
    if not s or "s" in s or "min" in s:
        return None
    try:
        if "-" in s:
            lo, hi = s.split("-", 1)
            return (int(lo.strip()), int(hi.strip()))
        n = int(s)
        return (n, n)
    except Exception:
        return None


def _work_sets(exercise_log: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        s
        for s in (exercise_log.get("sets") or [])
        if isinstance(s, dict) and not s.get("is_warmup") and s.get("reps")
    ]


def analyze_exercise_progression(
    *,
    exercise_id: str,
    recent_sessions: List[Dict[str, Any]],
    load_type: Optional[str] = None,
    max_sessions: int = 4,
) -> Dict[str, Any]:
    """
    Vyhodnotí, či je čas pridať váhu na konkrétnom cviku.

    recent_sessions: riadky zo strength_sessions, zoradené najnovšie prvé.

    Vracia:
      {
        "exercise_id": str,
        "last_weight_kg": float | None,     # čo dvíhal naposledy
        "last_top_reps": int | None,
        "sessions_analyzed": int,
        "should_progress": bool,
        "suggested_weight_kg": float | None,
        "reason": str,                      # prečo áno/nie - ide do AI kontextu
      }
    """
    history: List[Dict[str, Any]] = []

    for row in recent_sessions or []:
        log = row.get("log")
        if not isinstance(log, dict):
            continue
        for ex in log.get("exercises") or []:
            if not isinstance(ex, dict) or ex.get("exercise_id") != exercise_id:
                continue
            ws = _work_sets(ex)
            if not ws:
                continue

            planned = ex.get("planned") or {}
            rng = _parse_rep_range(planned.get("reps"))
            top = max(ws, key=lambda s: (s.get("weight_kg") or 0))
            last = ws[-1]

            history.append(
                {
                    "date": str(row.get("session_date"))[:10],
                    "top_weight_kg": top.get("weight_kg"),
                    "last_set_reps": last.get("reps"),
                    "last_set_rpe": last.get("rpe"),
                    "target_range": rng,
                    "sets_done": len(ws),
                }
            )
            break

        if len(history) >= max_sessions:
            break

    if not history:
        return {
            "exercise_id": exercise_id,
            "last_weight_kg": None,
            "last_top_reps": None,
            "sessions_analyzed": 0,
            "should_progress": False,
            "suggested_weight_kg": None,
            "reason": "no_history",
        }

    latest = history[0]
    last_weight = latest.get("top_weight_kg")
    last_reps = latest.get("last_set_reps")

    base = {
        "exercise_id": exercise_id,
        "last_weight_kg": last_weight,
        "last_top_reps": last_reps,
        "sessions_analyzed": len(history),
    }

    if last_weight is None:
        return {
            **base,
            "should_progress": False,
            "suggested_weight_kg": None,
            "reason": "bodyweight_or_unlogged_weight",
        }

    if len(history) < CONSECUTIVE_SESSIONS_REQUIRED:
        return {
            **base,
            "should_progress": False,
            "suggested_weight_kg": None,
            "reason": "not_enough_sessions",
        }

    # 2-for-2: posledná séria musí prekročiť hornú hranicu o 2 opakovania
    # v dvoch po sebe idúcich tréningoch, pri rovnakej (alebo vyššej) váhe.
    qualifying = 0
    for h in history[:CONSECUTIVE_SESSIONS_REQUIRED]:
        rng = h.get("target_range")
        reps = h.get("last_set_reps")
        w = h.get("top_weight_kg")
        rpe = h.get("last_set_rpe")

        if not rng or reps is None or w is None:
            break
        if w < last_weight:
            break
        if rpe is not None and rpe >= RPE_CEILING:
            break
        if reps >= rng[1] + 2:
            qualifying += 1
        else:
            break

    if qualifying < CONSECUTIVE_SESSIONS_REQUIRED:
        return {
            **base,
            "should_progress": False,
            "suggested_weight_kg": None,
            "reason": "reps_target_not_exceeded",
        }

    increment = LOAD_INCREMENT_KG.get(str(load_type or "barbell"), 2.5)
    if increment <= 0:
        return {
            **base,
            "should_progress": False,
            "suggested_weight_kg": None,
            "reason": "progress_via_reps_not_load",
        }

    return {
        **base,
        "should_progress": True,
        "suggested_weight_kg": round(last_weight + increment, 1),
        "reason": "two_for_two_met",
    }


def build_progression_context(
    *,
    exercise_ids: List[str],
    recent_sessions: List[Dict[str, Any]],
    catalog_by_id: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Progresný kontext pre celú session - toto ide do AI promptu, aby
    vedela napísať "minule si dal 70 kg, dnes skús 72.5 kg".

    Vynecháva cviky bez histórie, aby sa prompt zbytočne nenafukoval.
    """
    if catalog_by_id is None:
        from Configs.strength_catalog import CATALOG_BY_ID as _cbi
        catalog_by_id = _cbi

    out: List[Dict[str, Any]] = []
    for ex_id in exercise_ids or []:
        meta = catalog_by_id.get(ex_id) or {}
        res = analyze_exercise_progression(
            exercise_id=ex_id,
            recent_sessions=recent_sessions,
            load_type=meta.get("load_type"),
        )
        if res.get("sessions_analyzed", 0) == 0:
            continue
        out.append(res)

    return out
