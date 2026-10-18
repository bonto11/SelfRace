# DB/user_overview.py
# Čítanie dát pre admin prehľad userov (čo si kto nastavil a čo robí). Nič nemení.
#
# PREČO každý dotaz v try/except: je to prehľad naprieč mnohými tabuľkami -
# chyba v jednej (stĺpec, timeout) nesmie zhodiť celý panel, len tá časť ostane prázdna.
from __future__ import annotations

from typing import Any, Dict, List, Sequence, Tuple

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_AI_USAGE_EVENTS,
    TABLE_APP_USER_SUBSCRIPTIONS,
    TABLE_COACH_PLAN_DAILY,
    TABLE_COACH_PLAN_META,
    TABLE_PROFILE_STATIC,
    TABLE_PUSH_NOTIFICATIONS,
    TABLE_STRAVA_ACCOUNTS,
    TABLE_STRENGTH_SESSIONS,
    TABLE_USERS,
    TABLE_USERS_PREFERENCES,
    TABLE_USERS_RECOVERY,
)

_PAGE = 1000
TABLE_USERS_HEALTH_LOG = "users_health_log"
TABLE_INTERVALS_ACCOUNTS = "intervals_accounts"

# (operácia, stĺpec, hodnota) – eq / gte / gt / in / not_null
Filter = Tuple[str, str, Any]


def _select_all(
    table: str,
    cols: str,
    *,
    ctx: AuthCtx,
    filters: Sequence[Filter] = (),
    caller: str,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller=f"user_overview.{caller}")
    out: List[Dict[str, Any]] = []
    start = 0
    try:
        while True:
            q = sb.table(table).select(cols)
            for op, col, val in filters:
                if op == "eq":
                    q = q.eq(col, val)
                elif op == "gte":
                    q = q.gte(col, val)
                elif op == "gt":
                    q = q.gt(col, val)
                elif op == "in":
                    q = q.in_(col, list(val))
                elif op == "not_null":
                    q = q.not_.is_(col, "null")
            rows = q.range(start, start + _PAGE - 1).execute().data or []
            out.extend(rows)
            if len(rows) < _PAGE:
                return out
            start += _PAGE
    except Exception as e:  # noqa: BLE001
        print(f"[USER-OVERVIEW] {table} ({caller}) failed: {repr(e)}")
        return out


def db_overview_users(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(TABLE_USERS, "id, auth_uid, mail_address, display_name", ctx=ctx, caller="users")


def db_overview_strava(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(
        TABLE_STRAVA_ACCOUNTS, "user_id, athlete_id", ctx=ctx,
        filters=[("not_null", "athlete_id", None)], caller="strava",
    )


def db_overview_intervals(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(TABLE_INTERVALS_ACCOUNTS, "user_id", ctx=ctx, caller="intervals")


def db_overview_subscriptions(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(
        TABLE_APP_USER_SUBSCRIPTIONS, "user_id, tier_code", ctx=ctx,
        filters=[("eq", "status", "active")], caller="subscriptions",
    )


def db_overview_push(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(TABLE_PUSH_NOTIFICATIONS, "user_id, endpoint", ctx=ctx, caller="push")


def db_overview_prefs(keys: Sequence[str], *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(
        TABLE_USERS_PREFERENCES, "user_id, key, value, updated_at", ctx=ctx,
        filters=[("in", "key", keys)], caller="prefs",
    )


def db_overview_plan_meta(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(
        TABLE_COACH_PLAN_META, "user_id, status, start_date, end_date, created_at", ctx=ctx, caller="plan_meta",
    )


def db_overview_plan_daily(date_from: str, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(
        TABLE_COACH_PLAN_DAILY, "user_id, plan_date, status, updated_at", ctx=ctx,
        filters=[("gte", "plan_date", date_from)], caller="plan_daily",
    )


def db_overview_activities(date_from: str, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(
        TABLE_ACTIVITIES_SUMMARY, "user_id, date", ctx=ctx,
        filters=[("gte", "date", date_from)], caller="activities",
    )


def db_overview_strength(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(TABLE_STRENGTH_SESSIONS, "user_id, session_date, created_at", ctx=ctx, caller="strength")


def db_overview_recovery(date_from: str, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(
        TABLE_USERS_RECOVERY, "user_id, date", ctx=ctx,
        filters=[("gte", "date", date_from)], caller="recovery",
    )


def db_overview_health(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(TABLE_USERS_HEALTH_LOG, "user_id, created_at", ctx=ctx, caller="health")


def db_overview_ai_usage(created_from: str, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(
        TABLE_AI_USAGE_EVENTS, "user_id, source, billed_via, created_at", ctx=ctx,
        filters=[("gte", "created_at", created_from)], caller="ai_usage",
    )


def db_overview_profile_static(*, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return _select_all(TABLE_PROFILE_STATIC, "user_id, sex, birth_date, height_cm", ctx=ctx, caller="profile")


# ---------------- upozornenia adminovi (Services/admin_alerts.py) ----------------

def db_admin_user_ids(*, ctx: AuthCtx) -> List[int]:
    rows = _select_all(TABLE_USERS, "id", ctx=ctx, filters=[("eq", "role", "ADMIN")], caller="admins")
    return [int(r["id"]) for r in rows if r.get("id") is not None]


def db_users_after(last_id: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Useri s id > last_id (noví od posledného upozornenia), od najstaršieho."""
    rows = _select_all(
        TABLE_USERS, "id, mail_address, display_name", ctx=ctx,
        filters=[("gt", "id", int(last_id))], caller="users_after",
    )
    return sorted(rows, key=lambda r: int(r.get("id") or 0))


def db_users_count_and_max(*, ctx: AuthCtx) -> Tuple[int, int]:
    rows = _select_all(TABLE_USERS, "id", ctx=ctx, caller="users_count")
    ids = [int(r["id"]) for r in rows if r.get("id") is not None]
    return len(ids), (max(ids) if ids else 0)
