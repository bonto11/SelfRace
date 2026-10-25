# Services/nutrition_fuel.py
"""
Palivo na dnes a ďalšie dni – čo jesť okolo tréningov a pretekov.

Funguje aj bez zapisovania jedla: stačí profil výživy a plán (alebo
preteky v coach prefs). Rady sú pravidlá športovej výživy (Configs/
nutrition.py), čísla počíta BE z referenčnej váhy, AI sa nevolá.
FE skladá text podľa `kind` (i18n nutrition.fuel.tips.<kind>).
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, List, Optional

from Configs.nutrition import (
    DURING_CARBS_G_PER_H,
    DURING_FLUID_ML_PER_H,
    DURING_MIN_MINUTES,
    EVENING_BEFORE_CARBS_G_PER_KG,
    FUEL_DAYS_AHEAD,
    LONG_RUN_MIN,
    POST_CARBS_G_PER_KG,
    POST_PROTEIN_G_PER_KG,
    PRE_RACE_CARBS_G_PER_KG,
    PRE_SESSION_CARBS_G_PER_KG,
    PRE_SESSION_MIN_MINUTES,
)
from DB.nutrition import db_get_nutrition_profile
from Modules.Supabase.auth import AuthCtx
from Services.nutrition_targets import (
    load_body,
    missing_body_fields,
    service_compute_targets_range,
    today_local,
)
from Services.user_prefs import service_get_user_timezone

_FUEL_LOADS = ("hard", "race", "load")


def _g(per_kg: float, ref_kg: float) -> int:
    """Gramy zaokrúhlené na 5 – presnejšie čísla by sľubovali presnosť, ktorú nemáme."""
    return int(round(per_kg * ref_kg / 5) * 5)


def during_carbs_per_h(minutes: float) -> int:
    for limit, rate in DURING_CARBS_G_PER_H:
        if minutes <= limit:
            return rate
    return DURING_CARBS_G_PER_H[-1][1]


def _session_public(it: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "title": it.get("title"),
        "sport": it.get("sport"),
        "minutes": int(it.get("minutes") or 0),
        "load": it.get("load"),
        "source": it.get("source"),
        "event": bool(it.get("event")),
    }


def _main_session(items: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Najdlhší tréning dňa (udalosti ako svadba nie sú tréning)."""
    sessions = [it for it in items if not it.get("event") and (it.get("minutes") or 0) > 0]
    return max(sessions, key=lambda it: it.get("minutes") or 0) if sessions else None


def _during_tip(kind: str, minutes: float) -> Dict[str, Any]:
    rate = during_carbs_per_h(minutes)
    return {
        "kind": kind,
        "carbs_g_per_h": rate,
        "fluid_ml_per_h": DURING_FLUID_ML_PER_H,
        "hours": round(minutes / 60, 1),
        "total_carbs_g": int(round(rate * minutes / 60 / 5) * 5),
    }


def build_day_tips(res: Dict[str, Any], next_res: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Rady na jeden deň z výsledku service_compute_targets_range."""
    b = res.get("breakdown") or {}
    t = res.get("targets") or {}
    ref = float(b.get("ref_weight_kg") or b.get("weight_kg") or 70)
    race = b.get("race") or None
    kind = (race or {}).get("kind")
    tips: List[Dict[str, Any]] = []

    if kind == "load":
        tips.append({
            "kind": "loading",
            "carbs_g": t.get("carbs_g"),
            "carbs_g_per_kg": b.get("carbs_g_per_kg"),
            "race_name": race.get("name"),
            "days_to": race.get("days_to"),
        })
    elif kind == "race":
        tips.append({"kind": "race_breakfast", "carbs_g": _g(PRE_RACE_CARBS_G_PER_KG, ref), "race_name": race.get("name")})
        minutes = race.get("minutes") or 0
        if minutes >= DURING_MIN_MINUTES:
            tips.append(_during_tip("race_during", minutes))
        elif minutes:
            tips.append({"kind": "race_short"})
        tips.append({
            "kind": "race_after",
            "protein_g": _g(POST_PROTEIN_G_PER_KG, ref),
            "carbs_g": _g(POST_CARBS_G_PER_KG, ref),
        })
    else:
        main = _main_session(res.get("exercise") or [])
        if not main:
            tips.append({"kind": "rest", "carbs_g": t.get("carbs_g")})
        else:
            minutes = float(main.get("minutes") or 0)
            hard = b.get("day_load") == "hard" or main.get("load") == "hard"
            title = main.get("title")
            if hard or minutes >= PRE_SESSION_MIN_MINUTES:
                tips.append({"kind": "pre", "carbs_g": _g(PRE_SESSION_CARBS_G_PER_KG, ref), "title": title})
            if minutes >= DURING_MIN_MINUTES:
                tips.append(_during_tip("during", minutes))
            if hard or minutes >= LONG_RUN_MIN:
                tips.append({
                    "kind": "post",
                    "protein_g": _g(POST_PROTEIN_G_PER_KG, ref),
                    "carbs_g": _g(POST_CARBS_G_PER_KG, ref),
                })
            if not tips:
                tips.append({"kind": "easy", "carbs_g": t.get("carbs_g")})

    # večer pred náročným dňom / pretekom (doplnenie má vlastnú radu)
    nb = (next_res or {}).get("breakdown") or {}
    next_race = nb.get("race") or {}
    if kind != "load" and next_race.get("kind") != "load" and nb.get("day_load") in _FUEL_LOADS:
        next_main = _main_session((next_res or {}).get("exercise") or [])
        tips.append({
            "kind": "evening_before",
            "carbs_g": _g(EVENING_BEFORE_CARBS_G_PER_KG, ref),
            "next": "race" if next_race.get("kind") == "race" else "hard",
            "title": next_race.get("name") or (next_main or {}).get("title"),
        })

    limits = b.get("limits") or []
    if "race_fueling" in limits:
        tips.append({"kind": "no_deficit"})
    elif "hard_day_deficit" in limits:
        tips.append({"kind": "soft_deficit"})
    return tips


def service_get_fuel(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """Dnes + FUEL_DAYS_AHEAD dní: záťaž, ciele, tréningy, pretek a rady."""
    profile_row = db_get_nutrition_profile(user_id, ctx=ctx)
    if not profile_row:
        return {"ok": True, "profile": False, "days": []}
    body = load_body(user_id, ctx=ctx)
    missing = missing_body_fields(profile_row, body)
    mode = profile_row.get("mode") or "macros"
    if missing:
        return {"ok": True, "profile": True, "mode": mode, "missing": missing, "days": []}

    try:
        tz = service_get_user_timezone(user_id, ctx=ctx)
    except Exception:  # noqa: BLE001
        tz = None
    today = today_local(tz)
    # o deň dlhšie – posledný deň potrebuje vedieť, čo je po ňom (večer pred)
    last = today + timedelta(days=FUEL_DAYS_AHEAD + 1)
    per_day = service_compute_targets_range(
        user_id, profile=profile_row, body=body, d_from=today, d_to=last, today=today, ctx=ctx
    )

    days: List[Dict[str, Any]] = []
    for i in range(FUEL_DAYS_AHEAD + 1):
        iso = (today + timedelta(days=i)).isoformat()
        res = per_day.get(iso) or {}
        next_res = per_day.get((today + timedelta(days=i + 1)).isoformat())
        b = res.get("breakdown") or {}
        days.append({
            "date": iso,
            "day_load": b.get("day_load"),
            "targets": res.get("targets"),
            "sessions": [_session_public(it) for it in res.get("exercise") or []],
            "race": b.get("race"),
            "tips": build_day_tips(res, next_res),
        })
    return {"ok": True, "profile": True, "mode": mode, "missing": [], "days": days}
