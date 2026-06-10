# Services/AI/monthly_review/generate.py
from __future__ import annotations

import json
from calendar import monthrange, month_name
from typing import Any, Dict, Optional, Tuple

from Services.monthly_summary import service_get_monthly_summary
from Services.AI.provider.provider import ai_call_json_model
from DB.user_prefs import db_get_pref_single
from Modules.Supabase.auth import AuthCtx


# ============================================================
# HELPERS
# ============================================================

def _prev_month(year: int, month: int) -> Tuple[int, int]:
    return (year - 1, 12) if month == 1 else (year, month - 1)


def _month_label(year: int, month: int, lang: str) -> str:
    """Lokalizovaný názov mesiaca."""
    if lang == "en":
        return f"{month_name[month]} {year}"
    SK_MONTHS = [
        "", "január", "február", "marec", "apríl", "máj", "jún",
        "júl", "august", "september", "október", "november", "december",
    ]
    return f"{SK_MONTHS[month]} {year}"


def _get_user_lang(user_id: int, ctx: AuthCtx) -> str:
    try:
        from Services.user_prefs import service_load_user_settings
        s = service_load_user_settings(user_id=user_id, ctx=ctx) or {}
        return str(s.get("language") or "sk")[:2].lower()
    except Exception:
        return "sk"


def _get_user_goals(user_id: int, ctx: AuthCtx) -> Optional[str]:
    try:
        row = db_get_pref_single(user_id=user_id, key="coach.prefs", ctx=ctx)
        if not row:
            return None
        val = row.get("value") or row
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


def _build_prompts(
    current: Dict[str, Any],
    previous: Optional[Dict[str, Any]],
    user_goals: Optional[str],
    lang: str,
    year: int,
    month: int,
) -> Tuple[str, str]:

    lang_rule = {
        "sk": "Slovak. Tykanie. Priamy, stručný štýl. Bez zbytočných slov.",
        "en": "English. Second person. Direct and concise.",
        "cs": "Czech. Tykání. Přímý, stručný styl.",
    }.get(lang, "Slovak. Tykanie.")

    system = (
        "You are an elite endurance coach providing a monthly training review. "
        "Analyze trends, training balance (80/20 rule), and recovery quality. "
        "Be honest, specific, and actionable. "
        "Return ONE valid JSON object only. No markdown. No extra text."
    )

    data: Dict[str, Any] = {"current_month": current}
    if previous:
        data["previous_month"] = previous
    if user_goals:
        data["user_goals_context"] = user_goals

    schema = """{
  "schema_version": 1,
  "period": {"year": number, "month": number},
  "review_text": "3-5 sentences. Main narrative — trends, insights, what stands out. NO raw number recitation.",
  "highlights": ["2-3 achievements or positives"],
  "concerns": ["1-2 areas needing attention — empty array if none"],
  "recovery_note": "1-2 sentences on HRV/RHR/sleep quality and training readiness.",
  "zone_note": "1-2 sentences on intensity distribution vs 80/20 rule.",
  "next_month_focus": "2-3 concrete sentences with actionable focus for next month."
}"""

    comparison_note = (
        "- COMPARISON: previous_month data is available — reference specific changes (volume, zone balance, recovery metrics). "
        "State if the trend is positive, negative, or stable."
        if previous else
        "- No previous month data available for comparison."
    )

    user = (
        f"Monthly training review for {_month_label(year, month, lang)}.\n\n"
        f"DATA:\n{json.dumps(data, ensure_ascii=False, default=str)}\n\n"
        f"OUTPUT SCHEMA:\n{schema}\n\n"
        f"RULES:\n"
        f"- Language: {lang_rule}\n"
        f"- 80/20 rule: ~80% time in Z1+Z2 (easy), ~20% in Z3-Z5 (hard).\n"
        f"- DO NOT list numbers already visible in the data. Provide INSIGHTS.\n"
        f"- If user_goals_context is present, reference it in next_month_focus.\n"
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
    - Načíta dáta za aktuálny + predchádzajúci mesiac
    - Zavolá AI
    - Výsledok uloží do user_prefs ako monthly_review.YYYY-MM
    - Volá scheduler každý 1. v mesiaci pre uzavretý predchádzajúci mesiac
    """
    TAG = f"[MONTHLY-REVIEW][user={user_id}][{year}-{month:02d}]"
    print(f"{TAG} START save={save_result}")

    # Aktuálny mesiac
    current = service_get_monthly_summary(user_id, year, month, ctx=ctx)
    if current["summary"]["total_sessions"] == 0:
        print(f"{TAG} No activities, skipping")
        return {"ok": False, "reason": "no_data"}

    # Predchádzajúci mesiac
    py, pm = _prev_month(year, month)
    previous: Optional[Dict[str, Any]] = None
    try:
        prev = service_get_monthly_summary(user_id, py, pm, ctx=ctx)
        if prev["summary"]["total_sessions"] > 0:
            previous = prev
            print(f"{TAG} previous month loaded: {py}-{pm:02d}")
    except Exception as e:
        print(f"{TAG} prev month failed: {e}")

    lang         = _get_user_lang(user_id, ctx)
    user_goals   = _get_user_goals(user_id, ctx)

    system_txt, user_txt = _build_prompts(
        current, previous, user_goals, lang, year, month
    )

    # AI call — provider si sám vyberie model (haiku → sonnet fallback)
    res = ai_call_json_model(
        context_payload={"user": {"id": user_id}, "type": "monthly_review"},
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=None,
    )

    if not res.ok or not isinstance(res.data, dict):
        err = str(getattr(res.error, "message", res.error) if res.error else "unknown")
        print(f"{TAG} AI FAILED: {err}")
        return {"ok": False, "reason": "ai_failed", "error": err}

    review = dict(res.data)
    review.setdefault("schema_version", 1)
    review.setdefault("period", {"year": year, "month": month})
    review["model"] = str(res.model or "unknown")
    print(f"{TAG} OK model={review['model']}")

    # Uloženie do user_prefs
    if save_result:
        try:
            from DB.user_prefs import db_upsert_pref_single
            db_upsert_pref_single(
                user_id=user_id,
                key=f"monthly_review.{year}-{month:02d}",
                value=review,
                ctx=ctx,
            )
            print(f"{TAG} saved to prefs")
        except Exception as e:
            print(f"{TAG} save failed: {e}")

    # Billing
    try:
        from Services.AI.utils.billing import extract_usage_from_trace, log_ai_usage_for_user
        trace = {"ok_model": res.model, "ok_provider": getattr(res, "provider", "unknown")}
        usage = extract_usage_from_trace(trace, model_fallback=res.model)
        if usage:
            log_ai_usage_for_user(
                user_id=user_id, usage=usage,
                job_type="monthly_review", source="scheduler",
                billed_via="internal", charge_wallet=False,
                meta={"year": year, "month": month},
                ctx=ctx,
            )
    except Exception as e:
        print(f"{TAG} billing failed: {e}")

    return {"ok": True, "data": review}