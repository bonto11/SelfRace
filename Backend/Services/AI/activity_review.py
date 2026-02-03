# Services/AI/activity_review.py
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Services.users import require_jwt

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
    db_upsert_activity_ai_review,   # doplníme nižšie
    db_get_enrichment_for_activities,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_ai_model() -> str:
    p = (AI_PROVIDER or "openai").strip().lower()
    if p == "gemini":
        return (GEMINI_DEFAULT_MODEL or "gemini-1.5-flash").strip()
    return (OPENAI_DEFAULT_MODEL or "gpt-4o-mini").strip()


def _minify_context_for_ai(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deep copy + drop internals (PII / internal ids) podobne ako athlete_state.
    """
    ctx = json.loads(json.dumps(payload, default=str))

    # drop internal user id
    try:
        u = ctx.get("user")
        if isinstance(u, dict):
            u.pop("id", None)
    except Exception:
        pass

    # drop activity_id ak nechceš posielať
    # (ja by som nechal activity_id v payload, ale môžeš anonymizovať)
    # try:
    #     a = ctx.get("activity")
    #     if isinstance(a, dict):
    #         a.pop("activity_id", None)
    # except Exception:
    #     pass

    return ctx


def service_review_activity(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
    debug: bool = False,
    save_to_db: bool = True,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Activity review:
      - service=False (FE) => quota check
      - service=True  (webhook/cron) => bez quota
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    model_to_use = (model or _default_ai_model()).strip()

    # 0) QUOTA CHECK (len user-trigger)
    if not service and is_user_over_token_quota(
        user_id,
        user_jwt=jwt,
        service=service,
    ):
        used = get_user_monthly_usage_tokens(user_id)
        return {
            "ok": False,
            "activity_id": activity_id,
            "model": model_to_use,
            "review": None,
            "input": None,
            "error": {
                "code": "ai_quota_exceeded",
                "message": "Mesačný limit AI bol vyčerpaný.",
                "used_tokens_this_month": used,
            },
        }

    # 1) INPUT (DB -> builder)
    input_data = build_review_input(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    context_for_ai = _minify_context_for_ai(input_data)

    # optional hard stop: ak nemáme enrichment ani summary, nemá zmysel
    try:
        act = context_for_ai.get("activity") or {}
        summ = (act.get("summary") or {}) if isinstance(act, dict) else {}
        if not isinstance(summ, dict) or not summ:
            return {
                "ok": False,
                "activity_id": activity_id,
                "model": model_to_use,
                "review": None,
                "input": input_data,
                "error": {"code": "missing_activity_data", "message": "Missing activity summary/enrichment"},
            }
    except Exception:
        pass

    # 2) AI CALL
    review, trace = generate_activity_review_json(
        context_payload=context_for_ai,
        model=model_to_use,
        debug_raw=debug,
    )
    if not isinstance(review, dict):
        review = {}

    review.setdefault("schema_version", 1)
    review.setdefault("generated_at", _now_iso())
    review["model"] = str(review.get("model") or model_to_use)
    review.setdefault("activity_id", activity_id)

    # 2b) BILLING
    usage = extract_usage_from_trace(trace)
    if usage:
        usage["model"] = str(review.get("model") or model_to_use)
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.activity_review",
                source="service" if service else "user",
                billed_via="internal",
                charge_wallet=False,
                meta={"activity_id": activity_id},
            )
        except Exception as e:  # noqa: BLE001
            print("[AI_BILLING] activity_review billing error:", repr(e))

    # 3) STORE (activities_enrichment.ai_review)
    if save_to_db:
        try:
            # ensure enrichment row exists (ak nemáš, upsert spraví)
            db_upsert_activity_ai_review(
                user_id=user_id,
                activity_id=activity_id,
                ai_review=review,
                user_jwt=jwt if not service else None,
                service=service,
            )
        except Exception as e:  # noqa: BLE001
            print("[service_review_activity] db_upsert_activity_ai_review error:", repr(e))

    resp: Dict[str, Any] = {
        "ok": True,
        "activity_id": activity_id,
        "model": str(review.get("model") or model_to_use),
        "review": review,
        "input": input_data,
    }
    if debug:
        resp["debug_trace"] = trace
        resp["ai_usage"] = usage

    return resp


def service_get_activity_review(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Načíta review z activities_enrichment.ai_review
    """
    if service:
        jwt = None
    else:
        jwt = require_jwt(user_jwt)

    rows = db_get_enrichment_for_activities(
        user_id=user_id,
        activity_ids=[activity_id],
        user_jwt=jwt,
        service=service,
    ) or []
    row = rows[0] if rows else None
    if not isinstance(row, dict):
        return None

    return {
        "user_id": user_id,
        "activity_id": activity_id,
        "ai_review": row.get("ai_review"),
        "updated_at": row.get("updated_at"),
    }