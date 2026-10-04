# DB/retention.py
# Čítanie dát pre meranie udržania userov (admin panel). Nič nemení.
from __future__ import annotations

from typing import Any, Dict, List, Set

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_AI_USAGE_EVENTS,
    TABLE_USERS,
)

_PAGE = 1000


def db_list_users_basic(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="retention.db_list_users_basic")
    out: List[Dict[str, Any]] = []
    start = 0
    while True:
        res = (
            sb.table(TABLE_USERS)
            .select("id, auth_uid")
            .order("id")
            .range(start, start + _PAGE - 1)
            .execute()
        )
        rows = res.data or []
        out.extend(rows)
        if len(rows) < _PAGE:
            return out
        start += _PAGE


def _user_ids_with_rows(
    table: str, date_col: str, user_ids: List[int], date_from: str, date_to: str,
    *, ctx: AuthCtx, extra_eq: Dict[str, Any] | None = None, caller: str,
) -> Set[int]:
    """Ktorí z userov majú aspoň 1 riadok v danom okne (len stĺpec user_id)."""
    if not user_ids:
        return set()
    sb = get_sb(ctx, caller=caller)
    found: Set[int] = set()
    start = 0
    while True:
        q = (
            sb.table(table)
            .select("user_id")
            .in_("user_id", user_ids)
            .gte(date_col, date_from)
            .lt(date_col, date_to)
        )
        for k, v in (extra_eq or {}).items():
            q = q.eq(k, v)
        rows = q.range(start, start + _PAGE - 1).execute().data or []
        found.update(int(r["user_id"]) for r in rows if r.get("user_id") is not None)
        if len(rows) < _PAGE:
            return found
        start += _PAGE


def db_users_with_activity(
    user_ids: List[int], date_from: str, date_to: str, *, ctx: AuthCtx
) -> Set[int]:
    return _user_ids_with_rows(
        TABLE_ACTIVITIES_SUMMARY, "date", user_ids, date_from, date_to,
        ctx=ctx, caller="retention.db_users_with_activity",
    )


def db_users_with_own_ai_usage(
    user_ids: List[int], date_from: str, date_to: str, *, ctx: AuthCtx
) -> Set[int]:
    # source='user' = user si sám niečo vyžiadal (nie cron, nie uvítacie hodnotenie)
    return _user_ids_with_rows(
        TABLE_AI_USAGE_EVENTS, "created_at", user_ids, date_from, date_to,
        ctx=ctx, extra_eq={"source": "user"}, caller="retention.db_users_with_own_ai_usage",
    )


# ---------------- uvítací týždeň (admin prehľad) ----------------

def db_list_prefs_by_key(key: str, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Všetky riadky user_prefs s daným kľúčom (naprieč usermi)."""
    from Configs.config import TABLE_USERS_PREFERENCES

    sb = get_sb(ctx, caller="retention.db_list_prefs_by_key")
    res = sb.table(TABLE_USERS_PREFERENCES).select("user_id, value").eq("key", key).execute()
    return list(res.data or [])


def db_list_active_plans_started_since(date_from: str, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    from Configs.config import TABLE_COACH_PLAN_META

    sb = get_sb(ctx, caller="retention.db_list_active_plans_started_since")
    res = (
        sb.table(TABLE_COACH_PLAN_META)
        .select("id, user_id, start_date, status")
        .eq("status", "active")
        .gte("start_date", date_from)
        .execute()
    )
    return list(res.data or [])


def db_list_welcome_usage_since(created_from: str, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Spotreba uvítacích hodnotení - zalogovaná, ale do limitu usera sa nepočíta."""
    sb = get_sb(ctx, caller="retention.db_list_welcome_usage_since")
    out: List[Dict[str, Any]] = []
    start = 0
    while True:
        rows = (
            sb.table(TABLE_AI_USAGE_EVENTS)
            .select("user_id, model, input_tokens, output_tokens, created_at")
            .eq("billed_via", "welcome_free")
            .gte("created_at", created_from)
            .range(start, start + _PAGE - 1)
            .execute()
        ).data or []
        out.extend(rows)
        if len(rows) < _PAGE:
            return out
        start += _PAGE


def db_get_user_emails(user_ids: List[int], *, ctx: AuthCtx) -> Dict[int, str]:
    if not user_ids:
        return {}
    sb = get_sb(ctx, caller="retention.db_get_user_emails")
    res = sb.table(TABLE_USERS).select("id, mail_address").in_("id", user_ids).execute()
    return {int(r["id"]): str(r.get("mail_address") or "") for r in (res.data or [])}
