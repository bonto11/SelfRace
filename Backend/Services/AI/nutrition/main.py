# Services/AI/nutrition/main.py
"""
AI návrh jedla z textu. Nič neukladá – návrh ide na FE, user ho upraví
a potvrdí (POST /nutrition/{id}/log). Účtuje sa len platný návrh.
"""

from __future__ import annotations

from typing import Any, Dict, List

from Configs.nutrition import AI_TEXT_MAX_LEN, MAX_ITEMS_PER_LOG
from Modules.Supabase.auth import AuthCtx
from Services.AI.nutrition.generate import generate_food_text_json
from Services.AI.utils.billing import (
    extract_usage_from_trace,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
    log_ai_usage_for_user,
)
from Services.nutrition import clean_food_item
from Services.user_prefs import service_get_user_language


def service_parse_food_text(user_id: int, text: str, *, ctx: AuthCtx) -> Dict[str, Any]:
    clean = " ".join(str(text or "").split())[:AI_TEXT_MAX_LEN]
    if not clean:
        return {"ok": False, "code": "empty_text"}

    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {"ok": False, "code": "ai_quota_exceeded", "used_tokens_this_month": used}

    try:
        lang = service_get_user_language(user_id, ctx=ctx)
    except Exception:  # noqa: BLE001
        lang = "sk"

    data, trace, err = generate_food_text_json(text=clean, lang=lang)
    if not data:
        print(f"❌ [NUTRITION_AI] generation failed user={user_id}: {err}")
        return {"ok": False, "code": "ai_generation_failed"}

    raw_items = data.get("items") if isinstance(data.get("items"), list) else None
    if raw_items is None:
        print(f"❌ [NUTRITION_AI] invalid output user={user_id}, not billed")
        return {"ok": False, "code": "ai_generation_failed"}

    items: List[Dict[str, Any]] = []
    for raw in raw_items[:MAX_ITEMS_PER_LOG]:
        item = clean_food_item(raw)
        if item:
            items.append(item)
    # PREČO bez účtovania: prázdny návrh user nemôže použiť (spec: user platí
    # len za výstup, ktorý reálne dostane)
    if not items:
        return {"ok": False, "code": "no_food_found"}

    try:
        conf = min(max(float(data.get("confidence")), 0.0), 1.0)
    except (TypeError, ValueError):
        conf = None
    note = data.get("note")
    note = str(note).strip()[:200] if isinstance(note, str) and note.strip() else None

    usage = extract_usage_from_trace(trace)
    if usage:
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="nutrition_text",
                source="user",
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "items": len(items),
                    "provider": trace.get("ok_provider"),
                    "model": trace.get("ok_model"),
                },
                ctx=ctx,
            )
        except Exception as e:  # noqa: BLE001
            print(f"❌ [AI_BILLING] nutrition_text error: {repr(e)}")

    return {"ok": True, "items": items, "confidence": conf, "note": note, "raw_input": clean}
