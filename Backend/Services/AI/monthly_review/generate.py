# Services/AI/monthly_review/generate.py
from __future__ import annotations

import json
from Configs.config import ai_model_for
from calendar import month_name
from typing import Any, Dict, Optional, Tuple

from Services.monthly_summary import service_get_monthly_summary
from Services.AI.provider.provider import ai_call_json_model
from Services.user_prefs import service_load_user_settings
from Services.AI.utils.training_focus import resolve_training_focus
from Services.AI.utils.billing import (
    ai_output_has_text,
    extract_usage_from_trace,
    log_ai_usage_for_user,
)
from DB.user_prefs import db_get_pref_single, db_upsert_pref_single
from Modules.Supabase.auth import AuthCtx


# ============================================================
# HELPERS
# ============================================================

def _prev_month(year: int, month: int) -> Tuple[int, int]:
    return (year - 1, 12) if month == 1 else (year, month - 1)


def _month_label(year: int, month: int, lang: str) -> str:
    if lang == "en":
        return f"{month_name[month]} {year}"
    if lang == "cs":
        CS_MONTHS = [
            "", "leden", "únor", "březen", "duben", "květen", "červen",
            "červenec", "srpen", "září", "říjen", "listopad", "prosinec",
        ]
        return f"{CS_MONTHS[month]} {year}"
    SK_MONTHS = [
        "", "január", "február", "marec", "apríl", "máj", "jún",
        "júl", "august", "september", "október", "november", "december",
    ]
    return f"{SK_MONTHS[month]} {year}"


def _get_user_lang(user_id: int, ctx: AuthCtx) -> str:
    try:
        s = service_load_user_settings(user_id=user_id, ctx=ctx) or {}
        return str(s.get("language") or "sk")[:2].lower()
    except Exception:
        return "sk"


def _get_coach_prefs(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    try:
        row = db_get_pref_single(user_id=user_id, key="coach.prefs", ctx=ctx)
        val = (row or {}).get("value")
        return val if isinstance(val, dict) else {}
    except Exception:
        return {}


def _get_user_goals(val: Dict[str, Any]) -> Optional[str]:
    try:
        if not val:
            return None
        parts = []
        goal_kind = val.get("goal_kind")
        if goal_kind:
            parts.append(f"goal_kind={goal_kind}")
        races = val.get("targets", {}).get("run", {}).get("races") or []
        a_race = next((r for r in races if r.get("priority") == "A"), None)
        if a_race:
            parts.append(
                f"key_race={a_race.get('name', 'A-race')} "
                f"date={a_race.get('date', '?')} "
                f"type={a_race.get('race_goal', '?')}"
            )
        return " | ".join(parts) if parts else None
    except Exception:
        return None


_MUSCLE_NAMES = {
    "sk": "chest=prsia, back=chrbát, shoulders=ramená, biceps, triceps, forearms=predlaktia, "
    "core=stred tela, glutes=zadok, quads=predné stehná, hamstrings=zadné stehná, calves=lýtka "
    "(nikdy 'nohavice')",
    "cs": "chest=prsa, back=záda, shoulders=ramena, biceps, triceps, forearms=předloktí, "
    "core=střed těla, glutes=hýždě, quads=přední stehna, hamstrings=zadní stehna, calves=lýtka "
    "(nikdy 'kalhoty')",
    "en": "chest, back, shoulders, biceps, triceps, forearms, core, glutes, quads, hamstrings, calves",
}


def _strength_rule(current: Dict[str, Any], previous: Optional[Dict[str, Any]], lang: str) -> str:
    """Silové zápisy v dátach – ako ich čítať (zhrnutie ich počíta v kóde)."""
    if not current.get("strength"):
        return ""
    compare = (
        "  Compare exercises with previous_month.strength by exercise_id - a heavier best_weight_kg "
        "or more max_reps is progress worth naming with the exact numbers (e.g. 40 -> 45 kg).\n"
        if (previous or {}).get("strength")
        else ""
    )
    return (
        "- STRENGTH DATA: current_month.strength = logged strength sessions (manual log): sessions, "
        "work_sets, total_reps, volume_kg (kg x reps, only exercises measured in reps), muscle_sets "
        "(working sets per muscle group this month; secondary muscles count half) and exercises "
        "(most frequent: best_weight_kg with reps_at_best, max_reps; measure 'time' = seconds, "
        "'distance' = metres). Fill strength_note: consistency, progress in key exercises, balance "
        "between muscle groups (name a clearly neglected one).\n"
        + compare
        + "  Exercise names are English - write them naturally in the user's language, never as ids. "
        "No best_weight_kg = body weight exercise -> talk in repetitions, never kilograms.\n"
        f"  Muscle groups in the user's language: {_MUSCLE_NAMES.get(lang, _MUSCLE_NAMES['en'])}.\n"
    )


def _focus_rule(focus: str, has_zones: bool) -> str:
    """Zameranie z výberu v appke – pri sile nemá zmysel 80/20 ani zóny."""
    if focus == "strength":
        return (
            "- FOCUS = STRENGTH: the user trains strength, running is not their goal. Build the review "
            "around strength: consistency, progress in exercises, muscle balance, recovery. Never "
            "criticise missing running or endurance volume; walks or rides are only a complement. "
            "zone_note = null.\n"
        )
    rules = ""
    if focus == "endurance":
        rules += (
            "- FOCUS = RUNNING & TRAIL: never recommend adding gym work. strength_note only when "
            "strength data are present, otherwise null.\n"
        )
    elif focus == "hybrid":
        rules += (
            "- FOCUS = RUNNING + STRENGTH: judge both and whether they fit together (enough recovery "
            "between heavy leg sessions and key runs).\n"
        )
    elif focus == "ocr":
        rules += (
            "- FOCUS = OCR / HYROX: running plus strength endurance - grip and pulling, carries, lunges, "
            "varied terrain. Say how balanced the month was for this mix.\n"
        )
    elif focus == "health":
        rules += (
            "- FOCUS = HEALTH: plain everyday language, no jargon (no zones, 80/20, thresholds). "
            "Regular movement, consistency and how they feel matter most - light cardio and light "
            "strength both count, never push progression or performance.\n"
        )
    if has_zones and focus != "health":
        rules += "- 80/20 rule: ~80% time in Z1+Z2 (easy), ~20% in Z3-Z5 (hard).\n"
    else:
        rules += "- zone_note = null.\n"
    return rules


def _build_prompts(
    current: Dict[str, Any],
    previous: Optional[Dict[str, Any]],
    user_goals: Optional[str],
    lang: str,
    year: int,
    month: int,
    focus: str = "all",
) -> Tuple[str, str]:

    lang_rule = {
        "sk": "Slovak. Tykanie. Priamy, stručný štýl. Bez zbytočných slov.",
        "en": "English. Second person. Direct and concise.",
        "cs": "Czech. Tykání. Přímý, stručný styl.",
    }.get(lang, "Slovak. Tykanie.")

    if focus == "strength":
        system = (
            "You are an experienced strength coach providing a monthly training review. "
            "Analyze consistency, progress in exercises (weights and repetitions), balance between "
            "muscle groups and recovery. "
        )
    elif focus == "health":
        system = (
            "You are a friendly coach for people who move for their health, providing a monthly review. "
            "Analyze regularity, variety and recovery. "
        )
    else:
        system = (
            "You are an elite endurance coach providing a monthly training review. "
            "Analyze trends, training balance (80/20 rule), and recovery quality. "
        )
    system += (
        "Be honest, specific, and actionable. "
        "Return ONE valid JSON object only. No markdown. No extra text."
    )

    data: Dict[str, Any] = {"current_month": current}
    if previous:
        data["previous_month"] = previous
    if user_goals:
        data["user_goals_context"] = user_goals

    has_zones = bool(current.get("zones_min"))
    has_recovery = bool((current.get("recovery") or {}).get("days_recorded"))

    schema = """{
  "schema_version": 1,
  "period": {"year": number, "month": number},
  "review_text": "3-5 sentences. Main narrative — trends, insights, what stands out. NO raw number recitation.",
  "highlights": ["2-3 achievements or positives"],
  "concerns": ["1-2 areas needing attention — empty array if none"],
  "recovery_note": "1-2 sentences on HRV/RHR/sleep quality and training readiness." | null,
  "zone_note": "1-2 sentences on intensity distribution vs 80/20 rule." | null,
  "strength_note": "1-2 sentences on strength training - consistency, progress in exercises, muscle balance." | null,
  "next_month_focus": "2-3 concrete sentences with actionable focus for next month."
}"""

    comparison_note = (
        "- COMPARISON: previous_month data is available — reference specific changes "
        "(volume, zone balance, recovery metrics, strength). State if the trend is positive, negative, or stable."
        if previous else
        "- No previous month data available for comparison."
    )

    user = (
        f"Monthly training review for {_month_label(year, month, lang)}.\n\n"
        f"DATA:\n{json.dumps(data, ensure_ascii=False, default=str)}\n\n"
        f"OUTPUT SCHEMA:\n{schema}\n\n"
        f"RULES:\n"
        f"- Language: {lang_rule}\n"
        + _focus_rule(focus, has_zones)
        + _strength_rule(current, previous, lang)
        + (
            ""
            if has_recovery
            else "- recovery_note = null - no recovery data were logged this month.\n"
        )
        + "- strength_note = null when current_month.strength is missing.\n"
        "- DO NOT recite totals already visible in the data. Provide INSIGHTS - a specific change "
        "(e.g. a heavier lift) may be quoted when it is the insight.\n"
        "- Every number in the text must come from the data.\n"
        "- If user_goals_context is present, reference it in next_month_focus.\n"
        f"{comparison_note}\n"
        f"- Return ONLY valid raw JSON."
    )

    return system, user


# ============================================================
# HLAVNÁ FUNKCIA — volá ju scheduler aj test endpoint
# ============================================================

def service_generate_monthly_review(
    user_id: int,
    year: int,
    month: int,
    *,
    ctx: AuthCtx,
    save_result: bool = True,
) -> Dict[str, Any]:
    """
    Generuje AI mesačné hodnotenie.
    - Načíta dáta za daný + predchádzajúci mesiac
    - Zavolá AI
    - Výsledok uloží do user_prefs ako monthly_review.YYYY-MM
    - Volá scheduler každý 1. v mesiaci pre uzavretý predchádzajúci mesiac
    """
    TAG = f"[MONTHLY-REVIEW][user={user_id}][{year}-{month:02d}]"

    current = service_get_monthly_summary(user_id, year, month, ctx=ctx)
    if current["summary"]["total_sessions"] == 0:
        return {"ok": False, "reason": "no_data"}

    # Predchádzajúci mesiac
    py, pm = _prev_month(year, month)
    previous: Optional[Dict[str, Any]] = None
    try:
        prev = service_get_monthly_summary(user_id, py, pm, ctx=ctx)
        if prev["summary"]["total_sessions"] > 0:
            previous = prev
    except Exception as e:
        print(f"{TAG} ❌ prev month {py}-{pm:02d} failed: {e}")

    lang        = _get_user_lang(user_id, ctx)
    coach_prefs = _get_coach_prefs(user_id, ctx)
    user_goals  = _get_user_goals(coach_prefs)
    focus       = resolve_training_focus(user_id, coach_prefs, ctx=ctx)

    system_txt, user_txt = _build_prompts(current, previous, user_goals, lang, year, month, focus)

    res = ai_call_json_model(
        context_payload={"user": {"id": user_id}, "type": "monthly_review"},
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=ai_model_for("monthly_review"),
    )

    if not res.ok or not isinstance(res.data, dict):
        err = str(getattr(res.error, "message", res.error) if res.error else "unknown")
        print(f"{TAG} ❌ AI failed: {err}")
        return {"ok": False, "reason": "ai_failed", "error": err}

    review = dict(res.data)
    review.setdefault("schema_version", 1)
    review.setdefault("period", {"year": year, "month": month})
    review["model"] = str(res.model or "unknown")

    if not ai_output_has_text(review, "review_text"):
        print(f"{TAG} ❌ AI output invalid user={user_id}, not billed")
        return {"ok": False, "reason": "ai_failed", "error": "invalid_ai_output"}

    if save_result:
        try:
            db_upsert_pref_single(
                user_id=user_id,
                key=f"monthly_review.{year}-{month:02d}",
                value=review,
                ctx=ctx,
            )
        except Exception as e:
            # Neuložené zhrnutie user neuvidí - neúčtuje sa.
            print(f"{TAG} ❌ save failed, not billed: {e}")
            return {"ok": False, "reason": "save_failed", "error": str(e)}

    try:
        # PREČO res.trace: predtým sa tu skladal trace bez "usage", takže
        # extract_usage_from_trace vrátil None a nič sa nezaúčtovalo.
        trace = res.trace or {}
        usage = extract_usage_from_trace(trace, model_fallback=res.model)
        if usage:
            log_ai_usage_for_user(
                user_id=user_id, usage=usage,
                job_type="monthly_review", source="scheduler",
                billed_via="internal", charge_wallet=False,
                meta={
                    "year": year,
                    "month": month,
                    "provider": trace.get("ok_provider"),
                    "model": trace.get("ok_model"),
                },
                ctx=ctx,
            )
    except Exception as e:
        print(f"{TAG} ❌ billing failed: {e}")

    return {"ok": True, "data": review}