# Routes_DB/ai_billing.py
from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import datetime, timezone

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_AI_USAGE_EVENTS, TABLE_AI_WALLET_TRANSACTION


def _get_sb():
    """
    Vráti service klienta na Supabase pre AI billing.
    Billing je backendová vec, preto vždy service=True.
    """
    return get_sb(service=True, caller="ai_billing")


# ---------------- AI USAGE EVENTS ----------------


def db_insert_ai_usage_event(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Vloží jeden riadok do ai_usage_events a vráti vložený záznam (alebo None).

    Očakávané polia v `row`:
      - user_id: int
      - model: str
      - job_type: str
      - source: str ('service' | 'user' | ...)
      - input_tokens: int
      - output_tokens: int
      - reasoning_tokens: int
      - total_tokens: int
      - unit_price_micros: int
      - cost_micros: int
      - billed_via: str ('internal' | 'included_quota' | 'wallet')
      - meta: jsonb / dict
    """
    sb = _get_sb()
    res = sb.table(TABLE_AI_USAGE_EVENTS).insert(row).execute()
    data = res.data or []
    return data[0] if data else None


# ---------------- AI WALLET TRANSACTIONS ----------------


def db_insert_ai_wallet_transaction(
    row: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Vloží jeden riadok do ai_wallet_transactions a vráti vložený záznam (alebo None).

    Očakávané polia v `row`:
      - user_id: int
      - kind: str ('usage_charge' | 'topup' | ...)
      - amount_micros: int  (kladné = dobite, záporné = odpis)
      - source: str ('ai_usage' | 'manual' | ...)
      - related_usage_event_id: int | None
      - meta: jsonb / dict
    """
    sb = _get_sb()
    res = sb.table(TABLE_AI_WALLET_TRANSACTION).insert(row).execute()
    data = res.data or []
    return data[0] if data else None


def db_get_wallet_balance_micros(user_id: int) -> int:
    """
    Jednoduchý helper: spočíta aktuálny stav walletu v µ (micros).

    Implementácia je brute-force SUM nad ai_wallet_transactions.
    Keď budeš chcieť výkon, spravíš materializovaný view / trigger.
    """
    sb = _get_sb()
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

    Nevyužíva sa v novom billing core, ale môže sa hodiť na rýchle logovanie
    bez pricingu.
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
    return db_insert_ai_usage_event(row)


def db_get_monthly_usage_tokens(
    user_id: int,
    year: int,
    month: int,
) -> int:
    """
    Spočíta total_tokens z ai_usage_events pre daného usera
    v danom mesiaci (UTC).
    """
    sb = _get_sb()

    # začiatok mesiaca
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    # prvý deň ďalšieho mesiaca
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)

    try:
        res = (
            sb.table(TABLE_AI_USAGE_EVENTS)
            .select("total_tokens")
            .eq("user_id", user_id)
            .gte("created_at", start.isoformat())
            .lt("created_at", end.isoformat())
            .execute()
        )
    except Exception as e:  # noqa: BLE001
        print("[AI_BILLING][db_get_monthly_usage_tokens] error:", repr(e))
        return 0

    rows = res.data or []
    total = 0
    for r in rows:
        try:
            total += int(r.get("total_tokens") or 0)
        except Exception:
            continue
    return total