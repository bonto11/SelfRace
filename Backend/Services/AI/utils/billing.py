from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Routes_DB.ai_billing import (
    db_insert_ai_usage_event,
    db_get_monthly_usage_tokens,  # Očakávame, že toto teraz vráti Dict!
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
    charge_wallet: bool = False,
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
) -> Dict[str, int]:
    """
    Vráti presnú spotrebu za daný mesiac rozdelenú na Input, Output a Total.
    Predpokladá sa, že db_get_monthly_usage_tokens vracia Dict.
    """
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month
    
    # Predpoklad: db funkcia vracia napr: {"input_tokens": 15000, "output_tokens": 2000, "total_tokens": 17000}
    db_result = db_get_monthly_usage_tokens(ctx=ctx, user_id=user_id, year=y, month=m)
    
    if isinstance(db_result, dict):
        return {
            "input": int(db_result.get("input_tokens") or 0),
            "output": int(db_result.get("output_tokens") or 0),
            "total": int(db_result.get("total_tokens") or 0),
        }
    
    # Fallback, ak by DB funkcia zatiaľ vracala len číslo (int)
    if isinstance(db_result, (int, float)):
        return {"input": 0, "output": 0, "total": int(db_result)}
        
    return {"input": 0, "output": 0, "total": 0}


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

    tier_code = str((status or {}).get("tier_code") or "free").lower()
    active_sub = (status or {}).get("active_subscription") or None

    # 1. HARDCODED LIMITY PRE TIER (Podľa prepočtov z Gemini 2.5 Flash)
    limit_input = 0
    limit_output = 0
    
    if tier_code == "free":
        # Len základ (1x analyze, 1x report, 1x weekly, 1x daily, 1x review)
        limit_input = 35_000
        limit_output = 6_000
    elif tier_code == "classic":
        # Plná automatizácia + 10 recenzií
        limit_input = 300_000
        limit_output = 50_000
    elif tier_code == "pro":
        # Geek mód (časté reviews)
        limit_input = 1_000_000
        limit_output = 150_000
    elif tier_code in ["family", "admin", "super_user"]:
        # Astronomický limit (50 miliónov)
        limit_input = 50_000_000
        limit_output = 10_000_000

    # Ak by nejaký tier vypadol, dáme záchranný free limit
    if limit_input == 0 or limit_output == 0:
        limit_input = 35_000
        limit_output = 6_000

    # 2. ZISTENIE AKTUÁLNEJ SPOTREBY
    usage = get_user_monthly_usage_tokens(user_id=user_id, ctx=ctx)
    used_input = usage["input"]
    used_output = usage["output"]
    used_total = usage["total"]

    # 3. VÝPOČTY ZVYŠKOV
    remaining_input = max(limit_input - used_input, 0)
    remaining_output = max(limit_output - used_output, 0)
    
    # 4. KONTROLA PREKROČENIA (Ak vyčerpá hoci len jeden limit, je Over Quota)
    is_over = (used_input >= limit_input) or (used_output >= limit_output)

    # VIP Bypass pre UI
    is_vip = tier_code in ["family", "admin", "super_user"]

    reset_at: Optional[str] = None
    if isinstance(active_sub, dict):
        reset_at = active_sub.get("current_period_end")

    return {
        "user_id": user_id,
        "tier_code": tier_code,
        "limits": {
            "input": limit_input,
            "output": limit_output,
        },
        "usage": {
            "input": used_input,
            "output": used_output,
            "total": used_total,
        },
        "remaining": {
            "input": remaining_input,
            "output": remaining_output,
        },
        "is_over": is_over,
        "reset_at": reset_at,
        "is_vip": is_vip,
    }


def is_user_over_token_quota(
    user_id: int,
    ctx: AuthCtx,
) -> bool:
    """
    Zjednodušená kontrola: Vypočíta všetky limity a vráti True, ak je niektorý vyčerpaný.
    Odstránený ručný `limit_tokens` argument, pretože teraz máme dva oddelené limity.
    """
    quota = get_user_ai_quota_status_for_current_tier(
        user_id=user_id,
        ctx=ctx,
    )
    return bool(quota.get("is_over"))
