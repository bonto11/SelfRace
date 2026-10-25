# Services/AI/prefs_suggest/builders.py
"""
Kontext pre AI návrh nastavenia coach prefs.

ČO SEM PATRÍ: čo user chce dosiahnuť (jeho text), aktuálne hodnoty polí,
ktoré AI smie zmeniť (fields.py), fakty, ktoré nemení (režim, preteky,
vybavenie, skúsenosť v posilňovni, zranenia), či beží plán, aký je to
športovec (athlete state), zdravie a posledné týždne objemu.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx
from Services.AI.advisor_review.builders import _build_health_block, _build_state_block
from Services.AI.prefs_suggest.fields import current_values
from Services.AI.season_plan.builders import _clean, _recent_weeks_block, _thread_for_ai


def _races(prefs: Dict[str, Any]) -> list:
    run = ((prefs.get("targets") or {}).get("run") or {})
    out = []
    for r in run.get("races") or []:
        if isinstance(r, dict):
            out.append({
                "name": r.get("name"),
                "date": str(r.get("date") or r.get("start_date") or "")[:10] or None,
                "distance_km": r.get("custom_distance_km"),
                "race_type": r.get("race_type"),
                "priority": r.get("priority"),
                "target_time": r.get("target_time"),
            })
    return out


def _has_active_plan(user_id: int, *, ctx: AuthCtx) -> Optional[bool]:
    try:
        from DB.coach_plan_meta import db_get_active_plan_meta_for_user

        return bool(db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx))
    except Exception as e:  # noqa: BLE001
        print(f"[PREFS-SUGGEST][builder] plan meta failed: {repr(e)}")
        return None


def build_prefs_suggest_input(
    user_id: int, *, request: Optional[str], thread: Any, ctx: AuthCtx
) -> Dict[str, Any]:
    from Services.AI.utils.training_focus import load_widget_profile
    from Services.user_prefs import service_load_coach_prefs_for_analysis, service_load_user_settings

    try:
        settings = service_load_user_settings(user_id=user_id, ctx=ctx) or {}
    except Exception:  # noqa: BLE001
        settings = {}
    lang = str(settings.get("language") or "sk").lower()[:2]
    lang = lang if lang in ("sk", "cs", "en") else "sk"

    try:
        prefs = service_load_coach_prefs_for_analysis(user_id, ctx=ctx) or {}
    except Exception as e:  # noqa: BLE001
        print(f"[PREFS-SUGGEST][builder] prefs failed: {repr(e)}")
        prefs = {}
    strength = prefs.get("strength_settings") if isinstance(prefs.get("strength_settings"), dict) else {}

    ctx_out: Dict[str, Any] = {
        "athlete_request": _clean(request),
        "conversation": _thread_for_ai(thread),
        "current_settings": current_values(prefs),
        # fakty, ktoré AI nemení – len z nich vychádza alebo ich spomenie v todo
        "fixed_facts": {
            "coach_mode": prefs.get("coach_mode") or "coach",
            "has_active_plan": _has_active_plan(user_id, ctx=ctx),
            "plan_start_date": prefs.get("start_date"),
            "races": _races(prefs),
            "strength_location": strength.get("location"),
            "strength_equipment_mode": strength.get("equipment_mode"),
            "strength_equipment": strength.get("available"),
            "strength_experience": strength.get("experience_level"),
            "injuries": prefs.get("injuries"),
            "training_focus": load_widget_profile(user_id, ctx=ctx),
        },
        "recent_weeks": _recent_weeks_block(user_id, ctx=ctx),
        "athlete_state": _build_state_block(user_id, ctx=ctx),
        "health_records": _build_health_block(user_id, ctx=ctx),
    }

    user: Dict[str, Any] = {}
    try:
        from DB.users import db_get_user_display_name

        name = db_get_user_display_name(user_id, ctx=ctx)
        if name:
            user["first_name"] = name
    except Exception:  # noqa: BLE001
        pass
    if prefs.get("gender") in ("male", "female"):
        user["gender"] = prefs.get("gender")

    return {"lang": lang, "settings": settings, "user": user, "context": ctx_out, "_prefs": prefs}
