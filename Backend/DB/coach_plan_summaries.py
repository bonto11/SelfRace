# DB/coach_plan_summaries.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_PLAN_SUMMARIES


def db_insert_plan_summary(
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_summaries.db_insert_plan_summary")
    try:
        res = sb.table(TABLE_COACH_PLAN_SUMMARIES).insert(row).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-SUMMARIES] insert error:", repr(e))
        return None


def db_get_summary_exists_for_plan(
    plan_meta_id: int,
    *,
    ctx: AuthCtx,
) -> bool:
    """Poistka proti duplicitám - ak by sa import spustil viackrát pre tú
    istú aktivitu (re-sync), nechceme vygenerovať dva sumáre pre ten istý plán."""
    sb = get_sb(ctx, caller="coach_plan_summaries.db_get_summary_exists_for_plan")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_SUMMARIES)
            .select("id")
            .eq("plan_meta_id", plan_meta_id)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-SUMMARIES] check_exists error:", repr(e))
        return False


def db_list_plan_summaries_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_summaries.db_list_plan_summaries_for_user")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_SUMMARIES)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-SUMMARIES] list_for_user error:", repr(e))
        return []


def db_get_latest_plan_summary_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="coach_plan_summaries.db_get_latest_plan_summary_for_user")
    try:
        res = (
            sb.table(TABLE_COACH_PLAN_SUMMARIES)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-SUMMARIES] get_latest error:", repr(e))
        return None