# Routes_DB/coach_plan_daily.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client

supabase = get_client()
TABLE = "coach_plan_daily"


# ───────────────────────────── INSERT ─────────────────────────────


def db_insert_planned_sessions(
    rows: List[Dict[str, Any]],
    table_name: str = TABLE,
) -> int:
    """
    Bulk INSERT do coach_plan_daily.
    Vracia počet vložených riadkov.
    """
    if not rows:
        return 0

    try:
        res = supabase.table(table_name).insert(rows).execute()
        data = res.data or []
        print("[DB-COACH-DAILY] inserted rows:", len(data))
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] insert error:", repr(e))
        return 0


# ───────────────────────────── SELECT ─────────────────────────────


def db_get_planned_range_rows(
    user_id: int,
    start_iso: str,
    end_iso: str,
    table_name: str = TABLE,
):
    """
    Všetky planned sessions v rozsahu [start, end].
    """
    try:
        res = (
            supabase.table(table_name)
            .select("*")
            .eq("user_id", user_id)
            .gte("plan_date", start_iso)
            .lte("plan_date", end_iso)
            .order("plan_date", desc=False)
            .order("session_index", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] get_range error:", repr(e))
        return []


def db_get_planned_sessions_filtered(
    user_id: int,
    date_from: Optional[str],
    date_to: Optional[str],
    plan_id: Optional[str],
    table_name: str = TABLE,
):
    """
    Starší univerzálny filter – podľa dátumu a/alebo plan_id.
    """
    try:
        q = supabase.table(table_name).select("*").eq("user_id", user_id)

        if date_from:
            q = q.gte("plan_date", date_from)
        if date_to:
            q = q.lte("plan_date", date_to)
        if plan_id:
            q = q.eq("plan_id", plan_id)

        res = (
            q.order("plan_date", desc=False)
            .order("session_index", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] get_filtered error:", repr(e))
        return []


def db_fetch_plan_rows_in_range(
    user_id: int,
    start_iso: str,
    end_iso: str,
    columns: Optional[str] = None,
    table_name: str = TABLE,
):
    """
    Helper – výber s možnosťou obmedziť stĺpce (napr. 'id, plan_date, plan_id').
    """
    try:
        sel = columns or "*"
        res = (
            supabase.table(table_name)
            .select(sel)
            .eq("user_id", user_id)
            .gte("plan_date", start_iso)
            .lte("plan_date", end_iso)
            .order("plan_date", desc=False)
            .order("session_index", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] fetch_range error:", repr(e))
        return []


# ───────────────────────────── DELETE ─────────────────────────────


def db_clear_range_for_user(
    user_id: int,
    start_iso: str,
    end_iso: str,
    table_name: str = TABLE,
) -> int:
    """
    Zmaže plán v danom rozsahu (typicky 1 týždeň) pre usera – bez ohľadu na plan_id.
    Vhodné pre staršie použitie.
    """
    try:
        res = (
            supabase.table(table_name)
            .delete()
            .eq("user_id", user_id)
            .gte("plan_date", start_iso)
            .lte("plan_date", end_iso)
            .execute()
        )
        data = res.data or []
        print(
            "[DB-COACH-DAILY] clear_range user=%s %s..%s deleted=%s",
            user_id,
            start_iso,
            end_iso,
            len(data),
        )
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] clear_range error:", repr(e))
        return 0


def db_clear_range_for_user_plan(
    user_id: int,
    plan_id: str,
    start_iso: str,
    end_iso: str,
    table_name: str = TABLE,
) -> int:
    """
    Zmaže plán v danom rozsahu (typicky 1 týždeň) pre usera a konkrétny plan_id.

    Toto je to, čo bude používať nový daily generátor:
      - user_id + plan_id + [week_start, week_end]
    """
    try:
        res = (
            supabase.table(table_name)
            .delete()
            .eq("user_id", user_id)
            .eq("plan_id", plan_id)
            .gte("plan_date", start_iso)
            .lte("plan_date", end_iso)
            .execute()
        )
        data = res.data or []
        print(
            "[DB-COACH-DAILY] clear_range_plan user=%s plan_id=%s %s..%s deleted=%s",
            user_id,
            plan_id,
            start_iso,
            end_iso,
            len(data),
        )
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] clear_range_plan error:", repr(e))
        return 0


def db_delete_plan_for_user(
    user_id: int,
    plan_id: Optional[str],
    from_iso: Optional[str],
    table_name: str = TABLE,
) -> int:
    """
    Zmaže plán:
      - ak plan_id je zadaný → všetky riadky daného plánu,
      - inak všetko od from_iso (vrátane).
    """
    try:
        q = supabase.table(table_name).delete().eq("user_id", user_id)

        if plan_id:
            q = q.eq("plan_id", plan_id)
        if from_iso:
            q = q.gte("plan_date", from_iso)

        res = q.execute()
        data = res.data or []
        print(
            "[DB-COACH-DAILY] delete_plan user=%s plan_id=%s from=%s deleted=%s",
            user_id,
            plan_id,
            from_iso,
            len(data),
        )
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] delete_plan error:", repr(e))
        return 0


# ───────────────────────────── LINK & REORDER ─────────────────────────────


def db_link_session_to_activity(
    session_id: int,
    activity_id: Optional[int],
    table_name: str = TABLE,
) -> int:
    """
    Update activity_id pre 1 session.
    Vracia 1 pri úspechu, inak 0.
    """
    try:
        res = (
            supabase.table(table_name)
            .update({"activity_id": activity_id})
            .eq("id", session_id)
            .execute()
        )
        data = res.data or []
        return len(data)
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-DAILY] link_session error:", repr(e))
        return 0


def db_reorder_planned_sessions(
    user_id: int,
    updates: List[Dict[str, Any]],
    table_name: str = TABLE,
) -> int:
    """
    Batch update plan_date + session_index pre viac riadkov.
    Vracia počet riadkov, ktoré update-ol.
    """
    updated_total = 0
    for u in updates:
        try:
            sid = int(u["id"])
            payload = {
                "plan_date": str(u["plan_date"])[:10],
                "session_index": int(u["session_index"]),
            }
            res = (
                supabase.table(table_name)
                .update(payload)
                .eq("user_id", user_id)
                .eq("id", sid)
                .execute()
            )
            data = res.data or []
            updated_total += len(data)
        except Exception as e:  # noqa: BLE001
            print("[DB-COACH-DAILY] reorder single error:", repr(e), "update:", u)

    print(
        "[DB-COACH-DAILY] reorder user=%s updates=%s updated=%s",
        user_id,
        len(updates),
        updated_total,
    )
    return updated_total