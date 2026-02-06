# Services/AI/activity_review.py
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Modules.Supabase.auth import AuthCtx

from Services.AI.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
)

from Configs.config import (
    AI_PROVIDER,
    OPENAI_DEFAULT_MODEL,
    GEMINI_DEFAULT_MODEL,
)

from Services.AI.activity_review_builders import build_input_from_db as build_review_input
from Routes_AI.activity_review_generate import generate_activity_review_json

from Routes_DB.activities_enrichment import (
    db_upsert_ai_review_one,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_ai_model() -> str:
    p = (AI_PROVIDER or "openai").strip().lower()
    if p == "gemini":
        return (GEMINI_DEFAULT_MODEL).strip()
    return (OPENAI_DEFAULT_MODEL).strip()


def _minify_context_for_ai(payload: Dict[str, Any]) -> Dict[str, Any]:
    ctx = json.loads(json.dumps(payload, default=str))
    u = ctx.get("user")
    if isinstance(u, dict):
        u.pop("id", None)
    ctx.pop("_debug", None)
    return ctx


def service_activity_review(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    # ✅ v service režime JWT netreba
 
    model_to_use = (model or _default_ai_model()).strip()

    # quota (len user-triggered)
    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx,user_id=user_id)
        return {
            "ok": False,
            "activity_id": activity_id,
            "model": model_to_use,
            "review": None,
            "summary": None,
            "highlights": None,
            "recommendations": None,
            "trace": None,
            "ai_usage": None,
            "error": {
                "code": "ai_quota_exceeded",
                "message": "Mesačný limit AI bol vyčerpaný.",
                "used_tokens_this_month": used,
            },
        }

    input_data = build_review_input(
        user_id=user_id,
        activity_id=activity_id,
        ctx=ctx
    )

    context_for_ai = _minify_context_for_ai(input_data)

    act = context_for_ai.get("activity") if isinstance(context_for_ai, dict) else None
    metrics = act.get("metrics") if isinstance(act, dict) else None
    if not isinstance(metrics, dict) or not metrics:
        return {
            "ok": False,
            "activity_id": activity_id,
            "model": model_to_use,
            "review": None,
            "summary": None,
            "highlights": None,
            "recommendations": None,
            "trace": {
                "models_tried": [model_to_use],
                "attempts": [],
                "usage": None,
                "ok_model": None,
            },
            "ai_usage": None,
            "error": {
                "code": "missing_activity_data",
                "message": "Missing activity metrics (summary/enrichment not loaded)",
            },
        }

    # ✅ tu bol tvoj bug: generate nevedelo načítať user settings, lebo nemalo jwt/service
    review, trace = generate_activity_review_json(
        context_payload=context_for_ai,
        model=model_to_use,
        user_id=user_id,
        ctx=ctx,
    )

    if not isinstance(trace, dict):
        trace = {"models_tried": [model_to_use], "attempts": [], "usage": None, "ok_model": None}

    if not isinstance(review, dict):
        review = {}

    review.setdefault("schema_version", 1)
    review.setdefault("generated_at", _now_iso())
    review["model"] = str(review.get("model") or trace.get("ok_model") or model_to_use)
    review.setdefault("activity_id", activity_id)

    usage = extract_usage_from_trace(trace, model_fallback=review["model"])
    if usage:
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.activity_review",
                source="user",
                billed_via="internal",
                charge_wallet=False,
                meta={"activity_id": activity_id},
                ctx=ctx,
            )
        except Exception as e:  # noqa: BLE001
            print("[AI_BILLING] activity_review billing error:", repr(e))

    # ✅ DB
    try:
        db_upsert_ai_review_one(
            user_id=user_id,
            activity_id=activity_id,
            ai_review=review,
            ctx=ctx
        )
    except Exception as e:  # noqa: BLE001
        print("[AR][service] db_upsert_ai_review_one error:", repr(e))

    return {
        "ok": True,
        "activity_id": activity_id,
        "model": review.get("model"),
        "review": review,
        "summary": review.get("summary"),
        "highlights": review.get("highlights"),
        "recommendations": review.get("next_steps"),
        "trace": trace,
        "ai_usage": usage,
        "error": None,
    }