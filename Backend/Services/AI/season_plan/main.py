# Services/AI/season_plan/main.py
"""
AI kostra obdobia (advisor). Návrh sa NEukladá – ide na FE, user ho môže
2× upraviť komentárom a uloží ho sám (PUT /season-plan/{id}). Pri úprave
uloženého plánu FE pošle current_plan a AI ho prerobí podľa komentára.

Neplatný výstup (bez textu, bez týždňov, iný počet týždňov) =
ai_generation_failed a neúčtuje sa.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx
from Services.AI.season_plan.builders import build_season_plan_input
from Services.AI.season_plan.generate import generate_season_plan_json
from Services.AI.utils.billing import (
    ai_output_has_text,
    extract_usage_from_trace,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
    log_ai_usage_for_user,
)
from Services.season_plan import MAX_WEEKS, MIN_WEEKS, monday_of, normalize_plan

# 1 návrh + 2 úpravy komentárom (počíta sa z konverzácie z FE)
MAX_ROUNDS = 3

_DEFAULT_TITLE = {"sk": "Plán obdobia", "cs": "Plán období", "en": "Period plan"}


def _rounds_used(thread: Any) -> int:
    if not isinstance(thread, list):
        return 0
    return sum(1 for e in thread if isinstance(e, dict) and e.get("role") == "assistant")


def service_season_plan_suggest(
    *,
    user_id: int,
    start_date: str,
    weeks: int,
    request: Optional[str],
    thread: Any,
    current_plan: Any,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    used = _rounds_used(thread)
    if used >= MAX_ROUNDS:
        return {"ok": False, "code": "limit_reached"}
    text = str(request or "").strip()
    # bez zadania AI nevie, čo má obdobie riešiť; pri úprave treba komentár
    if not text:
        return {"ok": False, "code": "empty_comment" if (used or current_plan) else "empty_request"}
    try:
        start = monday_of(date.fromisoformat(str(start_date)[:10]))
    except ValueError:
        return {"ok": False, "code": "invalid_plan"}
    if isinstance(current_plan, dict) and current_plan.get("weeks"):
        # úprava: počet týždňov a začiatok drží plán, nie formulár
        weeks = len(current_plan.get("weeks") or []) or weeks
        try:
            start = monday_of(date.fromisoformat(str(current_plan.get("start_date"))[:10]))
        except ValueError:
            pass
    weeks = max(MIN_WEEKS, min(MAX_WEEKS, int(weeks or 8)))

    if is_user_over_token_quota(user_id, ctx=ctx):
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "used_tokens_this_month": get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id),
        }

    payload = build_season_plan_input(
        user_id,
        start_date=start,
        weeks=weeks,
        request=text,
        thread=thread,
        current_plan=current_plan,
        ctx=ctx,
    )
    data, trace, err = generate_season_plan_json(payload)
    if not data:
        print(f"❌ [SEASON] AI failed user={user_id}: {err}")
        return {"ok": False, "code": "ai_generation_failed"}

    # menší model občas vráti týždne priamo v koreni namiesto v "plan"
    raw = data.get("plan") if isinstance(data.get("plan"), dict) else data
    if not str(raw.get("title") or "").strip():
        raw = {**raw, "title": raw.get("name") or _DEFAULT_TITLE.get(payload.get("lang") or "sk")}
    # poznámky usera k týždňom AI neprepisuje – vrátia sa z pôvodného plánu
    # (bez neho sú prázdne – poznámka patrí len userovi, nie AI)
    old_weeks = (current_plan or {}).get("weeks") if isinstance(current_plan, dict) else None
    raw_weeks = [w for w in (raw.get("weeks") or []) if isinstance(w, dict)][:weeks]
    for i, w in enumerate(raw_weeks):
        old = old_weeks[i] if isinstance(old_weeks, list) and i < len(old_weeks) and isinstance(old_weeks[i], dict) else {}
        w["notes"] = old.get("notes")
    plan = normalize_plan({
        **raw,
        "weeks": raw_weeks,
        "start_date": start.isoformat(),
        "request": (current_plan or {}).get("request") if isinstance(current_plan, dict) and current_plan.get("request") else text,
    })
    reason = (
        "no reply_text" if not ai_output_has_text(data, "reply_text")
        else f"weeks {len(raw_weeks)} raw / {len(plan['weeks']) if plan else 0} valid, expected {weeks}"
        if not plan or len(plan["weeks"]) != weeks
        else None
    )
    if reason:
        week_keys = sorted({k for w in raw_weeks for k in w.keys()})
        print(
            f"❌ [SEASON] invalid AI output user={user_id}, not billed: {reason} | "
            f"top_keys={sorted(data.keys())} plan_keys={sorted(raw.keys())} week_keys={week_keys}"
        )
        return {"ok": False, "code": "ai_generation_failed"}

    usage = extract_usage_from_trace(trace, model_fallback=data.get("model"))
    if usage:
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.season_plan",
                source="user",
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "weeks": weeks,
                    "round": used + 1,
                    "provider": trace.get("ok_provider"),
                    "model": trace.get("ok_model"),
                },
                ctx=ctx,
            )
        except Exception as e:  # noqa: BLE001
            print(f"❌ [AI_BILLING] season_plan error: {repr(e)}")

    return {
        "ok": True,
        "reply_text": str(data.get("reply_text") or "").strip(),
        "plan": plan,
        "rounds_left": max(0, MAX_ROUNDS - used - 1),
    }
