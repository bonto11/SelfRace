# Services/AI_Athlete_State/coach_ai_billing.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Routes_DB.ai_billing import (
    db_insert_ai_usage_event,
    db_insert_ai_wallet_transaction,
    db_get_wallet_balance_micros,
)
from Configs.ai_pricing import get_ai_pricing_for_model


# ---------------------- usage extraction ----------------------


def extract_usage_from_trace(trace: Any) -> Optional[Dict[str, Any]]:
    """
    Bezpečne vytiahne usage dict z trace (ak existuje).
    Očakáva formát:
      trace["usage"] = {
        "model": str,
        "prompt_tokens": int,
        "completion_tokens": int,
        "total_tokens": int,
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
    billed_via: str = "internal",   # 'internal' | 'included_quota' | 'wallet'
    meta: Optional[Dict[str, Any]] = None,
    charge_wallet: bool = False,    # či má spraviť zápis do wallet
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
    purpose: str,
    source: str,
) -> None:
    """
    Jednoduchý helper, ktorý:
      - z usage zoberie tokeny
      - z Configs.ai_pricing vytiahne ceny pre daný model
      - zavolá log_ai_usage_and_charge s billed_via="internal"
    """
    if not user_id or not usage:
        return

    try:
        model = str(usage.get("model") or "").strip()
        pricing = get_ai_pricing_for_model(model)

        log_ai_usage_and_charge(
            user_id=user_id,
            model=model or "unknown",
            job_type=purpose,
            source=source,
            input_tokens=int(usage.get("prompt_tokens") or 0),
            output_tokens=int(usage.get("completion_tokens") or 0),
            reasoning_tokens=0,  # reasoning = účtujeme ako output → tu 0
            price_input_micros_per_1k=pricing["input_micros_per_1k"],
            price_output_micros_per_1k=pricing["output_micros_per_1k"],
            price_reasoning_micros_per_1k=0,
            billed_via="internal",   # nateraz len log, nie wallet
            meta=None,
            charge_wallet=False,
        )
    except Exception as e:  # noqa: BLE001
        print(
            "[AI_BILLING] log_ai_usage_for_user error:",
            repr(e),
            "user_id=",
            user_id,
            "usage=",
            usage,
        )


def get_user_wallet_balance_micros(user_id: int) -> int:
    """
    Helper – prečíta celkový stav walletu v µ.
    """
    return db_get_wallet_balance_micros(user_id)