from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Routes_DB.ai_billing import (
    db_insert_ai_usage_event,
    db_insert_ai_wallet_transaction,
    db_get_wallet_balance_micros,
    db_get_monthly_usage_tokens,
)
from Configs.config_ai_pricing import (
    get_ai_pricing_for_model,
    AI_MONTHLY_FREE_TOKENS,
)
from Services.app_subscription import (
    service_get_user_app_subscription_status,
)


# ---------------------- usage extraction ----------------------


def extract_usage_from_trace(trace: Any) -> Optional[Dict[str, Any]]:
    """
    Bezpečne vytiahne usage dict z trace (ak existuje).

    Očakávaný formát:
      trace["usage"] = {
        "model": str,
        "prompt_tokens": int,
        "completion_tokens": int,
        "total_tokens": int,
        # voliteľne: "reasoning_tokens": int
      }
    """
    if not isinstance(trace, dict):
        return None

    usage = trace.get("usage")
    if not isinstance(usage, dict):
        return None

    out: Dict[str, Any] = {
        "model": str(usage.get("model") or ""),
        "prompt_tokens": int(usage.get("prompt_tokens") or 0),
        "completion_tokens": int(usage.get("completion_tokens") or 0),
        "total_tokens": int(usage.get("total_tokens") or 0),
        "reasoning_tokens": int(usage.get("reasoning_tokens") or 0),
    }

    if (
        out["prompt_tokens"] == 0
        and out["completion_tokens"] == 0
        and out["total_tokens"] == 0
    ):
        return None

    return out


# ---------------------- core cost math ------------------------


def _calc_cost_micros(
    *,
    input_tokens: int,
    output_tokens: int,
    reasoning_tokens: int,
    price_input_micros_per_1k: int,
    price_output_micros_per_1k: int,
    price_reasoning_micros_per_1k: int,
) -> Dict[str, int]:
    """
    Čistá matematika – žiadny I/O.
    Všetky ceny sú v µ (micros) na 1k tokenov.
    """
    ti = max(int(input_tokens or 0), 0)
    to = max(int(output_tokens or 0), 0)
    tr = max(int(reasoning_tokens or 0), 0)

    total_tokens = ti + to + tr

    price_in = int(price_input_micros_per_1k or 0)
    price_out = int(price_output_micros_per_1k or 0)
    price_reason = int(price_reasoning_micros_per_1k or 0)

    cost_input = (ti * price_in) // 1000
    cost_output = (to * price_out) // 1000
    cost_reason = (tr * price_reason) // 1000

    cost_micros = cost_input + cost_output + cost_reason

    if total_tokens > 0:
        unit_price_micros = cost_micros // total_tokens
    else:
        unit_price_micros = 0

    return {
        "total_tokens": total_tokens,
        "cost_micros": cost_micros,
        "unit_price_micros": unit_price_micros,
    }


def log_ai_usage_and_charge(
    user_id: int,
    *,
    model: str,
    job_type: str,
    source: str,
    input_tokens: int,
    output_tokens: int,
    reasoning_tokens: int,
    price_input_micros_per_1k: int,
    price_output_micros_per_1k: int,
    price_reasoning_micros_per_1k: int,
    billed_via: str = "internal",  # 'internal' | 'included_quota' | 'wallet'
    meta: Optional[Dict[str, Any]] = None,
    charge_wallet: bool = False,  # či má spraviť zápis do wallet
) -> Dict[str, Any]:
    """
    Zapíše ai_usage_events + (voliteľne) ai_wallet_transactions.

    - čistú matematiku robí _calc_cost_micros
    - DB zápisy idú cez Routes_DB.ai_billing
    """
    if not user_id:
        raise ValueError("user_id is required")

    meta = meta or {}

    calc = _calc_cost_micros(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        reasoning_tokens=reasoning_tokens,
        price_input_micros_per_1k=price_input_micros_per_1k,
        price_output_micros_per_1k=price_output_micros_per_1k,
        price_reasoning_micros_per_1k=price_reasoning_micros_per_1k,
    )

    total_tokens = calc["total_tokens"]
    cost_micros = calc["cost_micros"]
    unit_price_micros = calc["unit_price_micros"]

    usage_row: Dict[str, Any] = {
        "user_id": user_id,
        "model": model,
        "job_type": job_type,
        "source": source,
        "input_tokens": int(input_tokens or 0),
        "output_tokens": int(output_tokens or 0),
        "reasoning_tokens": int(reasoning_tokens or 0),
        "total_tokens": total_tokens,
        "unit_price_micros": unit_price_micros,
        "cost_micros": cost_micros,
        "billed_via": billed_via,
        "meta": meta,
    }

    usage = None
    wallet_tx = None

    try:
        usage = db_insert_ai_usage_event(usage_row)
        usage_id = usage.get("id") if isinstance(usage, dict) else None
    except Exception as e:  # noqa: BLE001
        print("[AI_BILLING] insert ai_usage_events error:", repr(e))
        return {
            "usage": None,
            "wallet_tx": None,
            "total_tokens": total_tokens,
            "cost_micros": cost_micros,
        }

    if charge_wallet and billed_via == "wallet" and cost_micros > 0:
        tx_row: Dict[str, Any] = {
            "user_id": user_id,
            "kind": "usage_charge",
            "amount_micros": -cost_micros,  # mínus = odpis
            "source": "ai_usage",
            "related_usage_event_id": usage_id,
            "meta": {
                "job_type": job_type,
                "model": model,
                **meta,
            },
        }
        try:
            wallet_tx = db_insert_ai_wallet_transaction(tx_row)
        except Exception as e:  # noqa: BLE001
            print("[AI_BILLING] insert ai_wallet_transactions error:", repr(e))

    return {
        "usage": usage,
        "wallet_tx": wallet_tx,
        "total_tokens": total_tokens,
        "cost_micros": cost_micros,
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
) -> Dict[str, Any]:
    """
    Vezme usage dict z extract_usage_from_trace a:

      - vyberie model a tokeny,
      - vytiahne pricing z Configs.ai_pricing,
      - zavolá log_ai_usage_and_charge.
    """
    if not user_id or not usage:
        return {
            "usage": None,
            "wallet_tx": None,
            "total_tokens": 0,
            "cost_micros": 0,
        }

    model = str(usage.get("model") or "").strip()
    pricing = get_ai_pricing_for_model(model)

    return log_ai_usage_and_charge(
        user_id=user_id,
        model=model or "unknown",
        job_type=job_type,
        source=source,
        input_tokens=int(usage.get("prompt_tokens") or 0),
        output_tokens=int(usage.get("completion_tokens") or 0),
        reasoning_tokens=int(usage.get("reasoning_tokens") or 0),
        price_input_micros_per_1k=pricing["price_input_micros_per_1k"],
        price_output_micros_per_1k=pricing["price_output_micros_per_1k"],
        price_reasoning_micros_per_1k=pricing["price_reasoning_micros_per_1k"],
        billed_via=billed_via,
        charge_wallet=charge_wallet,
        meta=meta or {},
    )


def get_user_wallet_balance_micros(user_id: int) -> int:
    """
    Helper – prečíta celkový stav walletu v µ.
    """
    return db_get_wallet_balance_micros(user_id)


def get_user_monthly_usage_tokens(
    user_id: int,
    *,
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> int:
    """
    Celkový počet tokenov za daný mesiac (default = aktuálny).
    """
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month
    return db_get_monthly_usage_tokens(
        user_id=user_id,
        year=y,
        month=m,
    )


# ---------------------- quota podľa tieru --------------------


def get_user_ai_quota_status_for_current_tier(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Vráti info o kvóte podľa aktuálneho app subscription tieru:

      {
        "user_id": int,
        "tier_code": "...",
        "limit_tokens": int,
        "used_tokens": int,
        "remaining_tokens": int,
        "is_over": bool,
        "reset_at": str | None,
      }
    """
    # Zober status z app_subscription service
    status: Dict[str, Any] = service_get_user_app_subscription_status(
        user_id=user_id,
        user_jwt=user_jwt,
        service=service,
    )

    tier_code = (status or {}).get("tier_code") or "free"
    tiers = (status or {}).get("tiers") or []
    active_sub = (status or {}).get("active_subscription") or None

    limit_tokens: Optional[int] = None
    for t in tiers:
        if str(t.get("code")) == str(tier_code):
            try:
                limit_tokens = int(t.get("ai_monthly_tokens_limit") or 0)
            except Exception:
                limit_tokens = 0
            break

    # Fallback na globálnu free hodnotu (staré správanie), ak nič v DB
    if limit_tokens is None or limit_tokens <= 0:
        try:
            limit_tokens = int(AI_MONTHLY_FREE_TOKENS or 0)
        except Exception:
            limit_tokens = 0

    used_tokens = get_user_monthly_usage_tokens(user_id)
    remaining_tokens = max(limit_tokens - used_tokens, 0) if limit_tokens > 0 else 0
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
    }


def is_user_over_token_quota(
    user_id: int,
    limit_tokens: Optional[int] = None,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> bool:
    """
    True = user má minutý (alebo prebitý) mesačný limit AI tokenov.

    - Ak `limit_tokens` je zadaný, použije sa priamo.
    - Ak je None, použije sa limit podľa aktuálneho tieru.
    """
    # Nové správanie – podľa tieru
    if limit_tokens is None:
        quota = get_user_ai_quota_status_for_current_tier(
            user_id=user_id,
            user_jwt=user_jwt,
            service=service,
        )
        return bool(quota.get("is_over"))

    # Manuálne zadaný limit (kompatibilita so starým použitím)
    if limit_tokens <= 0:
        return False
    used = get_user_monthly_usage_tokens(user_id)
    return used >= int(limit_tokens)