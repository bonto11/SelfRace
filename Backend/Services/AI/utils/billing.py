# Services/AI/billing.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Routes_DB.ai_billing import (
    db_insert_ai_usage_event,
    db_get_monthly_usage_tokens,
)
from Configs.config_ai_pricing import (
    AI_MONTHLY_FREE_TOKENS,
)
from Services.app_subscription import (
    service_get_user_app_subscription_status,
)
from Modules.Supabase.auth import AuthCtx

# ---------------------- usage extraction ----------------------

def extract_usage_from_trace(trace: Any, *, model_fallback: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Bezpečne vytiahne usage dict z trace (ak existuje) v NOVOM formáte.

    Očakávame:
      trace = {
        "models_tried": [...],
        "attempts": [...],
        "usage": { "prompt_tokens": int, "completion_tokens": int, "total_tokens": int, ... } | None,
        "ok_model": "gpt-4o-mini" | None
      }

    Vrátime jednotný dict pre billing:
      {
        "model": str,
        "prompt_tokens": int,
        "completion_tokens": int,
        "total_tokens": int,
        "reasoning_tokens": int
      }
    """
    if not isinstance(trace, dict):
        return None

    usage = trace.get("usage")
    if not isinstance(usage, dict):
        return None

    def _i(x: Any) -> int:
        try:
            return int(x or 0)
        except Exception:
            return 0

    # ✅ model už nie je v usage -> doplníme ho z trace
    model = (
        str(usage.get("model") or "").strip()
        or str(trace.get("ok_model") or "").strip()
        or str(trace.get("model") or "").strip()
        or str(model_fallback or "").strip()
        or "unknown"
    )

    out: Dict[str, Any] = {
        "model": model,
        "prompt_tokens": _i(usage.get("prompt_tokens")),
        "completion_tokens": _i(usage.get("completion_tokens")),
        "total_tokens": _i(usage.get("total_tokens")),
        "reasoning_tokens": _i(usage.get("reasoning_tokens")),  # väčšinou 0
    }

    # ak provider nedáva total_tokens, dopočítaj (bez vymýšľania)
    if out["total_tokens"] <= 0 and (out["prompt_tokens"] > 0 or out["completion_tokens"] > 0):
        out["total_tokens"] = out["prompt_tokens"] + out["completion_tokens"] + out["reasoning_tokens"]

    if out["prompt_tokens"] == 0 and out["completion_tokens"] == 0 and out["total_tokens"] == 0:
        return None

    return out


# ---------------------- core logging ------------------------

def log_ai_usage(
    user_id: int,
    *,
    model: str,
    job_type: str,
    source: str,
    input_tokens: int,
    output_tokens: int,
    reasoning_tokens: int,
    billed_via: str = "internal",
    meta: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    
    if not user_id:
        raise ValueError("user_id is required")

    meta = meta or {}

    ti = max(int(input_tokens or 0), 0)
    to = max(int(output_tokens or 0), 0)
    tr = max(int(reasoning_tokens or 0), 0)

    total_tokens = ti + to + tr

    usage_row: Dict[str, Any] = {
        "user_id": user_id,
        "model": model,
        "job_type": job_type,
        "source": source,
        "input_tokens": ti,
        "output_tokens": to,
        "reasoning_tokens": tr,
        "total_tokens": total_tokens,
        # Natvrdo nastavíme nuly, keďže micros už nelogujeme
        "unit_price_micros": 0,
        "cost_micros": 0,
        "billed_via": billed_via,
        "meta": meta,
    }

    usage = None

    try:
        usage = db_insert_ai_usage_event(row=usage_row, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print("[AI_BILLING] insert ai_usage_events error:", repr(e))
        return {
            "usage": None,
            "total_tokens": total_tokens,
        }

    return {
        "usage": usage,
        "total_tokens": total_tokens,
    }


# ---------------------- high-level helpers -------------------

def log_ai_usage_for_user(
    *,
    user_id: int,
    usage: Dict[str, Any],
    job_type: str,
    source: str,
    billed_via: str = "internal",
    charge_wallet: bool = False, # Parameter ignorujeme, ale nechávame ho v signatúre, aby sme nerozbili kód, ktorý ho posiela
    meta: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    if not user_id or not usage:
        return {"usage": None, "total_tokens": 0}

    model = str(usage.get("model") or "").strip()

    return log_ai_usage(
        user_id=user_id,
        model=model or "unknown",
        job_type=job_type,
        source=source,
        input_tokens=int(usage.get("prompt_tokens") or 0),
        output_tokens=int(usage.get("completion_tokens") or 0),
        reasoning_tokens=int(usage.get("reasoning_tokens") or 0),
        billed_via=billed_via,
        meta=meta or {},
        ctx=ctx,
    )


def get_user_monthly_usage_tokens(
    user_id: int,
    *,
    year: Optional[int] = None,
    month: Optional[int] = None,
    ctx: AuthCtx,
) -> int:
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month
    return db_get_monthly_usage_tokens(ctx=ctx, user_id=user_id, year=y, month=m)


# ---------------------- quota podľa tieru --------------------

def get_user_ai_quota_status_for_current_tier(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    status: Dict[str, Any] = service_get_user_app_subscription_status(
        user_id=user_id,
        ctx=ctx,
    )

    tier_code = (status or {}).get("tier_code") or "free"
    tiers = (status or {}).get("tiers") or []
    active_sub = (status or {}).get("active_subscription") or None

    # Získanie základného limitu pre daný tier
    limit_tokens: Optional[int] = None
    for t in tiers:
        if str(t.get("code")).lower() == str(tier_code).lower():
            try:
                limit_tokens = int(t.get("ai_monthly_tokens_limit") or 0)
            except Exception:
                limit_tokens = 0
            break

    if limit_tokens is None or limit_tokens <= 0:
        try:
            limit_tokens = int(AI_MONTHLY_FREE_TOKENS or 0)
        except Exception:
            limit_tokens = 0

    # SUPER USER / FAMILY BYPASS
    # Ak má používateľ tier "family" alebo "admin", dáme mu astronomický limit (napr. 50 miliónov),
    # takže de facto nikdy nenarazí na strop, ale tokeny sa stále budú logovať.
    is_vip = str(tier_code).lower() in ["family", "admin", "super_user"]
    if is_vip:
        limit_tokens = 50_000_000  # 50 miliónov tokenov

    used_tokens = get_user_monthly_usage_tokens(user_id=user_id, ctx=ctx)
    remaining_tokens = max(limit_tokens - used_tokens, 0) if limit_tokens > 0 else 0
    
    # VIP user nie je "over quota", pokiaľ neprekročí tých astronomických 50M.
    is_over = used_tokens >= limit_tokens if limit_tokens > 0 else False

    reset_at: Optional[str] = None
    if isinstance(active_sub, dict):
        reset_at = active_sub.get("current_period_end")

    return {
        "user_id": user_id,
        "tier_code": tier_code,
        "limit_tokens": limit_tokens,
        "used_tokens": used_tokens,
        "remaining_tokens": remaining_tokens,
        "is_over": is_over,
        "reset_at": reset_at,
        "is_vip": is_vip, # Pridáme flag pre debug / frontend
    }


def is_user_over_token_quota(
    user_id: int,
    ctx: AuthCtx,
    limit_tokens: Optional[int] = None,
) -> bool:
    if limit_tokens is None:
        quota = get_user_ai_quota_status_for_current_tier(
            user_id=user_id,
             ctx=ctx,
        )
        return bool(quota.get("is_over"))

    if limit_tokens <= 0:
        return False

    used = get_user_monthly_usage_tokens(user_id=user_id, ctx=ctx)
    return used >= int(limit_tokens)