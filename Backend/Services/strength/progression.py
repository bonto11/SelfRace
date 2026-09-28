# Services/strength/progression.py
"""
Progresívne preťaženie z reálnych logov (strength_sessions).

Implementuje 2-for-2 pravidlo: keď athlete spraví o 2 opakovania viac než
horná hranica cieľového rozsahu v poslednej sérii, a to v dvoch po sebe
idúcich tréningoch toho istého cviku, je čas pridať váhu.

Bez tohto by AI nikdy nevedela, či má pridať záťaž - a presne to bol
dôvod, prečo tréningy pôsobili generické a bez progresu.

🌟 NOVÉ: progresia OPAKOVANIAMI pre cviky s load_mode="bodyweight_plus"
(zhyby, kliky, plank, výpady s vlastnou váhou). Keď athlete nezapíše
prídavné závažie, nemá zmysel odporúčať "+2.5 kg" - to isté 2-for-2
pravidlo sa aplikuje na počet opakovaní a odporučí sa o jedno viac.
Keď si začne pridávať kilá, prepne sa to samo na váhovú progresiu.
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
    "bodyweight": 2.5,  # prídavné závažie pri zhyboch/dipoch
}

# Koľko po sebe idúcich tréningov musí pravidlo platiť
CONSECUTIVE_SESSIONS_REQUIRED = 2

# Ak RPE pri poslednej sérii bolo takto vysoké, váhu nepridávame aj keď
# opakovania sedia - athlete bol na hranici.
RPE_CEILING = 9.0


def _parse_rep_range(reps: Any) -> Optional[tuple]:
    """'6-8' -> (6, 8), '10' -> (10, 10), '30s'/'20-30m' -> None (čas/vzdialenosť)."""
    s = str(reps or "").strip()
    if not s or "s" in s or "m" in s or "min" in s:
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


def _two_for_two_met(history: List[Dict[str, Any]], *, require_weight: Optional[float]) -> bool:
    """
    2-for-2: v posledných CONSECUTIVE_SESSIONS_REQUIRED tréningoch prekročila
    posledná séria hornú hranicu rozsahu o 2 opakovania.

    require_weight: pri váhovej progresii sa navyše kontroluje, že sa
    nešlo s váhou dole (None = bodyweight, váha sa nekontroluje).
    """
    qualifying = 0
    for h in history[:CONSECUTIVE_SESSIONS_REQUIRED]:
        rng = h.get("target_range")
        reps = h.get("last_set_reps")
        w = h.get("top_weight_kg")
        rpe = h.get("last_set_rpe")

        if not rng or reps is None:
            break
        if require_weight is not None:
            if w is None or w < require_weight:
                break
        if rpe is not None and rpe >= RPE_CEILING:
            break
        if reps >= rng[1] + 2:
            qualifying += 1
        else:
            break
    return qualifying >= CONSECUTIVE_SESSIONS_REQUIRED


def analyze_exercise_progression(
    *,
    exercise_id: str,
    recent_sessions: List[Dict[str, Any]],
    load_type: Optional[str] = None,
    load_mode: Optional[str] = None,
    measure: Optional[str] = None,
    max_sessions: int = 4,
) -> Dict[str, Any]:
    """
    Vyhodnotí, či je čas pridať váhu (alebo opakovanie) na konkrétnom cviku.

    recent_sessions: riadky zo strength_sessions, zoradené najnovšie prvé.

    Vracia:
      {
        "exercise_id": str,
        "last_weight_kg": float | None,     # čo dvíhal naposledy
        "last_top_reps": int | None,
        "sessions_analyzed": int,
        "should_progress": bool,
        "progression_type": "weight" | "reps" | None,   # 🌟 NOVÉ
        "suggested_weight_kg": float | None,
        "suggested_reps": int | None,                   # 🌟 NOVÉ
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
            "progression_type": None,
            "suggested_weight_kg": None,
            "suggested_reps": None,
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

    def _no(reason: str) -> Dict[str, Any]:
        return {
            **base,
            "should_progress": False,
            "progression_type": None,
            "suggested_weight_kg": None,
            "suggested_reps": None,
            "reason": reason,
        }

    # Časový / vzdialenostný cvik (plank, dead hang, sled) - 2-for-2 na
    # opakovaniach sa naň nedá aplikovať, progresuje sa dĺžkou výdrže.
    if (measure or "reps") != "reps":
        return _no("time_or_distance_based")

    if len(history) < CONSECUTIVE_SESSIONS_REQUIRED:
        return _no("not_enough_sessions")

    # 🌟 NOVÉ: bodyweight cvik bez prídavného závažia -> progresia opakovaniami
    if not last_weight:
        if (load_mode or "") != "bodyweight_plus":
            # external cvik bez zapísanej váhy - nevieme posúdiť
            return _no("unlogged_weight")

        if not _two_for_two_met(history, require_weight=None):
            return _no("reps_target_not_exceeded")

        return {
            **base,
            "should_progress": True,
            "progression_type": "reps",
            "suggested_weight_kg": None,
            "suggested_reps": int(last_reps) + 1 if last_reps else None,
            "reason": "two_for_two_met_reps",
        }

    # Váhová progresia (external alebo bodyweight_plus s prídavným závažím)
    if not _two_for_two_met(history, require_weight=last_weight):
        return _no("reps_target_not_exceeded")

    increment = LOAD_INCREMENT_KG.get(str(load_type or "barbell"), 2.5)
    if increment <= 0:
        return _no("progress_via_reps_not_load")

    return {
        **base,
        "should_progress": True,
        "progression_type": "weight",
        "suggested_weight_kg": round(last_weight + increment, 1),
        "suggested_reps": None,
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
    vedela napísať "minule si dal 70 kg, dnes skús 72.5 kg" (alebo pri
    zhyboch "minule 14 opakovaní, dnes skús 15").

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
            load_mode=meta.get("load_mode"),
            measure=meta.get("measure"),
        )
        if res.get("sessions_analyzed", 0) == 0:
            continue
        out.append(res)

    return out