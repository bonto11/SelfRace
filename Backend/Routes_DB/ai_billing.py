from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import datetime, timezone

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_AI_USAGE_EVENTS, TABLE_AI_WALLET_TRANSACTION


# ---------------- AI USAGE EVENTS ----------------
def db_insert_ai_usage_event(
    ctx: AuthCtx, row: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Vloží jeden riadok do ai_usage_events a vráti vložený záznam (alebo None).
    """
    sb = get_sb(ctx, caller="billing.db_insert_ai_usage_event")

    res = sb.table(TABLE_AI_USAGE_EVENTS).insert(row).execute()
    data = res.data or []
    return data[0] if data else None


# ---------------- AI WALLET TRANSACTIONS ----------------


def db_insert_ai_wallet_transaction(
    ctx: AuthCtx,
    row: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    Vloží jeden riadok do ai_wallet_transactions a vráti vložený záznam (alebo None).
    """
    sb = get_sb(ctx, caller="billing.db_insert_ai_wallet_transaction")

    res = sb.table(TABLE_AI_WALLET_TRANSACTION).insert(row).execute()
    data = res.data or []
    return data[0] if data else None


def db_get_wallet_balance_micros(ctx: AuthCtx, user_id: int) -> int:
    """
    Jednoduchý helper: spočíta aktuálny stav walletu v µ (micros).
    """
    sb = get_sb(ctx, caller="billing.db_get_wallet_balance_micros")

    try:
        res = (
            sb.table(TABLE_AI_WALLET_TRANSACTION)
            .select("amount_micros")
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:  # noqa: BLE001
        print("[AI_BILLING][db_get_wallet_balance_micros] error:", repr(e))
        return 0

    rows = res.data or []
    total = 0
    for r in rows:
        try:
            total += int(r.get("amount_micros") or 0)
        except Exception:
            continue
    return total


def db_ai_register_usage(
    *,
    user_id: int,
    ctx: AuthCtx,
    purpose: str,
    model: Optional[str],
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    source: str,
    meta: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Legacy helper: zapíše usage event bez ceny (unit_price_micros/cost_micros = 0).
    """
    row: Dict[str, Any] = {
        "user_id": user_id,
        "model": model or "",
        "job_type": purpose,
        "source": source,
        "input_tokens": int(prompt_tokens or 0),
        "output_tokens": int(completion_tokens or 0),
        "reasoning_tokens": 0,
        "total_tokens": int(total_tokens or 0),
        "unit_price_micros": 0,
        "cost_micros": 0,
        "billed_via": "internal",
        "meta": meta or {},
    }
    return db_insert_ai_usage_event(ctx=ctx, row=row)


def db_get_monthly_usage_tokens(
    user_id: int,
    ctx: AuthCtx,
    year: int,
    month: int,
) -> Dict[str, int]:
    """
    Spočíta input_tokens a output_tokens z ai_usage_events pre daného usera
    v danom mesiaci (UTC). Vracia dictionary.
    """
    sb = get_sb(ctx, caller="billing.db_get_monthly_usage_tokens")

    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

    result = {"input_tokens": 0, "output_tokens": 0}

    try:
        # Zmenené z "total_tokens" na stiahnutie "input_tokens, output_tokens"
        res = (
            sb.table(TABLE_AI_USAGE_EVENTS)
            .select("input_tokens, output_tokens")
            .eq("user_id", user_id)
            .gte("created_at", start.isoformat())
            .lt("created_at", end.isoformat())
            .execute()
        )
    except Exception as e:  # noqa: BLE001
        print("[AI_BILLING][db_get_monthly_usage_tokens] error:", repr(e))
        return result

    rows = res.data or []
    
    total_input = 0
    total_output = 0
    for r in rows:
        try:
            total_input += int(r.get("input_tokens") or 0)
            total_output += int(r.get("output_tokens") or 0)
        except Exception:
            continue
            
    result["input_tokens"] = total_input
    result["output_tokens"] = total_output
    
    return result
