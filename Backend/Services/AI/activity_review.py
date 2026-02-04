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
    db_upsert_enrichment_rows,
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
    Deep copy + drop internals (PII / internal ids).
    (Skutočný "horizon" minify rieši builder + prompts)
    """
    ctx = json.loads(json.dumps(payload, default=str))

    try:
        u = ctx.get("user")
        if isinstance(u, dict):
            u.pop("id", None)
    except Exception:
        pass

    return ctx


def _has_activity_metrics(ctx: Dict[str, Any]) -> bool:
    """
    Builder dáva activity.metrics (nie activity.summary).
    """
    act = ctx.get("activity")
    if not isinstance(act, dict):
        return False
    metrics = act.get("metrics")
    return isinstance(metrics, dict) and bool(metrics)


def service_activity_review(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
    debug: bool = False,
    save_to_db: bool = True,
    model: Optional[str] = None,
    debug_level: str = "basic",  # "none"|"basic"|"db"|"full"
) -> Dict[str, Any]:
    """
    Activity review service.
    """
    jwt = None if service else require_jwt(user_jwt)
    model_to_use = (model or _default_ai_model()).strip()

    # 0) quota (only user-triggered)
    if not service and is_user_over_token_quota(user_id, user_jwt=jwt, service=service):
        used = get_user_monthly_usage_tokens(user_id)
        return {
            "ok": False,
            "activity_id": activity_id,
            "model": model_to_use,
            "review": None,
            "summary": None,
            "highlights": None,
            "recommendations": None,
            "error": {
                "code": "ai_quota_exceeded",
                "message": "Mesačný limit AI bol vyčerpaný.",
                "used_tokens_this_month": used,
            },
        }

    # 1) build input
    input_data = build_review_input(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
        debug=debug,
        debug_level=debug_level if isinstance(debug_level, str) else "basic",
    )

    if debug:
        print(f"[activity_review] built_input keys={list(input_data.keys())}")
        act = input_data.get("activity")
        if isinstance(act, dict):
            print(f"[activity_review] activity keys={list(act.keys())}")
            print(f"[activity_review] metrics present={isinstance(act.get('metrics'), dict) and bool(act.get('metrics'))}")

    context_for_ai = _minify_context_for_ai(input_data)

    # hard stop (NOW CORRECT)
    if not _has_activity_metrics(context_for_ai):
        err = {"code": "missing_activity_data", "message": "Missing activity metrics (summary row not loaded?)"}
        out = {
            "ok": False,
            "activity_id": activity_id,
            "model": model_to_use,
            "review": None,
            "summary": None,
            "highlights": None,
            "recommendations": None,
            "error": err,
        }
        if debug:
            out["input"] = input_data
        return out

    # 2) ai call
    review, trace = generate_activity_review_json(
        context_payload=context_for_ai,
        model=model_to_use,
        user_id=user_id,  # settings: language/timezone
        debug_raw=debug,
    )

    if not isinstance(review, dict):
        review = {}

    review.setdefault("schema_version", 1)
    review.setdefault("generated_at", _now_iso())
    review["model"] = str(review.get("model") or model_to_use)
    review.setdefault("activity_id", activity_id)

    # 2b) billing
    usage = extract_usage_from_trace(trace)
    if usage:
        usage["model"] = review["model"]
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

    # 3) store
    if save_to_db:
        try:
            db_upsert_enrichment_rows(
                [{"user_id": user_id, "activity_id": activity_id, "ai_review": review}],
                user_jwt=jwt if not service else None,
                service=service,
            )
        except Exception as e:  # noqa: BLE001
            print("[service_activity_review] db_upsert_enrichment_rows error:", repr(e))

    # 4) FE-friendly response (sync s async_job minify)
    resp: Dict[str, Any] = {
        "ok": True,
        "activity_id": activity_id,
        "model": review.get("model"),
        "review": review,
        "summary": review.get("summary"),
        "highlights": review.get("highlights"),
        "recommendations": review.get("next_steps"),  # schema field
        "error": None,
    }

    if debug:
        resp["input"] = input_data
        resp["debug_trace"] = trace
        resp["ai_usage"] = usage

    return resp


service_review_activity = service_activity_review


def service_get_activity_review(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    jwt = None if service else require_jwt(user_jwt)

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