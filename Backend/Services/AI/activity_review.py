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
    Service-level minify:
    - drop internal user id
    - drop any debug blocks (we print them in logs anyway)
    """
    ctx = json.loads(json.dumps(payload, default=str))

    u = ctx.get("user")
    if isinstance(u, dict):
        u.pop("id", None)

    # ak by sa niekde objavil _debug
    ctx.pop("_debug", None)
    return ctx


def service_activity_review(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
    debug: bool = False,   # nechávam v signatúre kvôli kompatibilite, ale prints idú vždy
    model: Optional[str] = None,
) -> Dict[str, Any]:
    jwt = None if service else require_jwt(user_jwt)
    model_to_use = (model or _default_ai_model()).strip()

    print("[AR][service] start", {"user_id": user_id, "activity_id": activity_id, "service": service, "has_jwt": bool(jwt), "model": model_to_use})

    # quota (len user-triggered)
    if not service and is_user_over_token_quota(user_id, user_jwt=jwt, service=service):
        used = get_user_monthly_usage_tokens(user_id)
        print("[AR][service] quota_exceeded", {"used_tokens": used})
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

    # build input (builder prints DB info)
    input_data = build_review_input(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
        debug_level="db",
    )

    print("[AR][service] built_input_keys", sorted(list(input_data.keys())))
    if isinstance(input_data.get("activity"), dict):
        print("[AR][service] built_activity_keys", sorted(list(input_data["activity"].keys())))
        print("[AR][service] built_activity_metrics", input_data["activity"].get("metrics"))
        print("[AR][service] built_activity_zones", input_data["activity"].get("zones"))
    else:
        print("[AR][service] built_activity_invalid", {"type": type(input_data.get("activity")).__name__})

    context_for_ai = _minify_context_for_ai(input_data)

    # hard stop – ak nemáme metrics, nemá zmysel volať AI
    act = context_for_ai.get("activity") if isinstance(context_for_ai, dict) else None
    metrics = act.get("metrics") if isinstance(act, dict) else None
    if not isinstance(metrics, dict) or not metrics:
        print("[AR][service] missing_activity_data -> stop", {"activity_id": activity_id})
        return {
            "ok": False,
            "activity_id": activity_id,
            "model": model_to_use,
            "review": None,
            "summary": None,
            "highlights": None,
            "recommendations": None,
            "error": {"code": "missing_activity_data", "message": "Missing activity metrics (summary/enrichment not loaded)"},
            "input": input_data,
        }

    # AI call
    print("[AR][service] ai_payload_keys", {
        "top": sorted(list(context_for_ai.keys())),
        "activity": sorted(list((context_for_ai.get("activity") or {}).keys())) if isinstance(context_for_ai.get("activity"), dict) else None,
        "context": sorted(list((context_for_ai.get("context") or {}).keys())) if isinstance(context_for_ai.get("context"), dict) else None,
    })

    review, trace = generate_activity_review_json(
        context_payload=context_for_ai,
        model=model_to_use,
        user_id=user_id,   # timezone/jazyk
        debug_raw=True,    # nech trace existuje, keď provider vie
    )

    if not isinstance(review, dict):
        review = {}

    review.setdefault("schema_version", 1)
    review.setdefault("generated_at", _now_iso())
    review["model"] = str(review.get("model") or model_to_use)
    review.setdefault("activity_id", activity_id)

    print("[AR][service] ai_review_keys", sorted(list(review.keys())))
    print("[AR][service] ai_summary", review.get("summary"))

    # billing
    usage = extract_usage_from_trace(trace)
    print("[AR][service] usage", usage)

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

    try:
        db_upsert_enrichment_rows(
            [{"user_id": user_id, "activity_id": activity_id, "ai_review": review}],
            user_jwt=jwt if not service else None,
            service=service,
        )
        print("[AR][service] saved_ai_review", {"activity_id": activity_id})
    except Exception as e:  # noqa: BLE001
        print("[AR][service] db_upsert_enrichment_rows error:", repr(e))

    return {
        "ok": True,
        "activity_id": activity_id,
        "model": review.get("model"),
        "review": review,
        "summary": review.get("summary"),
        "highlights": review.get("highlights"),
        "recommendations": review.get("next_steps"),
        "error": None,
        "input": input_data,     # nech to vidíš hneď v response
        "debug_trace": trace,    # tiež
        "ai_usage": usage,
    }


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

    # NOTE: updated_at ti padá, lebo ho v tabuľke nemáš.
    return {
        "user_id": user_id,
        "activity_id": activity_id,
        "ai_review": row.get("ai_review"),
        "updated_at": None,
    }