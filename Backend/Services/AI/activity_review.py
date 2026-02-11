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
    """
    NOTE: tu úmyselne NEOREZÁVAME "history/streams/laps/splits" – to rieši builder/prompty.
    Toto je len safety (drop user.id + debug).
    """
    ctx = json.loads(json.dumps(payload, default=str))
    u = ctx.get("user")
    if isinstance(u, dict):
        u.pop("id", None)
    ctx.pop("_debug", None)
    return ctx


def _sanitize_user_comment(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    try:
        s = str(raw)
    except Exception:
        return None

    s = s.strip()
    if not s:
        return None

    MAX_CHARS = 900
    if len(s) > MAX_CHARS:
        s = s[:MAX_CHARS].rstrip() + "…"

    return s

def service_activity_review(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
    model: Optional[str] = None,
    source: Optional[str] = None,         # "auto" | "user" | "service" | ...
    comment: Optional[str] = None, 
) -> Dict[str, Any]:
    model_to_use = (model or _default_ai_model()).strip()

    src = (source or "").strip().lower() or "auto"  # default safe
    safe_comment = _sanitize_user_comment(comment)

    # quota: only user-triggered (auto review after sync should not be blocked)
    if src == "user" and is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
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

    # build base context (activity + history + recovery + recent load)
    input_data = build_review_input(
        user_id=user_id,
        activity_id=activity_id,
        ctx=ctx,
    )

    
    context_for_ai = _minify_context_for_ai(input_data)

    # ✅ attach meta for LLM (builder/prompts can reference it)
    context_for_ai.setdefault("meta", {})
    if isinstance(context_for_ai["meta"], dict):
        context_for_ai["meta"]["review_source"] = src
        context_for_ai["meta"]["review_requested_at"] = _now_iso()

    # ✅ attach user comment (only if provided)
    if safe_comment:
        context_for_ai["user_input"] = {
            "comment": safe_comment,
            "comment_added_at": _now_iso(),
            "source": src,
        }

    # sanity: must have metrics
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

    print("build_review_input context_for_ai", context_for_ai)

    # generate review
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

    # defaults (compat)
    review.setdefault("schema_version", 5)
    review.setdefault("generated_at", _now_iso())
    review["model"] = str(review.get("model") or trace.get("ok_model") or model_to_use)
    review.setdefault("activity_id", activity_id)

    # optional meta for FE/debug
    review.setdefault("meta", {})
    if isinstance(review["meta"], dict):
        review["meta"]["source"] = src
        review["meta"]["user_comment_used"] = bool(safe_comment)
        review["meta"]["user_comment_len"] = len(safe_comment) if safe_comment else 0

    usage = extract_usage_from_trace(trace, model_fallback=review["model"])
    if usage:
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.activity_review",
                source=src,  # ✅ NEW
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "activity_id": activity_id,
                    "source": src,
                    "has_user_comment": bool(safe_comment),
                    "user_comment_len": len(safe_comment) if safe_comment else 0,
                },
                ctx=ctx,
            )
        except Exception as e:  # noqa: BLE001
            print("[AI_BILLING] activity_review billing error:", repr(e))

    # ✅ DB persist (with meta columns)
    try:
        db_upsert_ai_review_one(
            user_id=user_id,
            activity_id=activity_id,
            ai_review=review,
            ctx=ctx,
            source=src,  # ✅ NEW
            user_comment=safe_comment,  # ✅ NEW
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
        "source": src,  # ✅ NEW
        "user_comment_used": bool(safe_comment),
    }