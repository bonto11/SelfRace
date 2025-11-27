# Routes_DB/coach_plan_log.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_COACH_PLANNED_SESSIONS

supabase = get_client()


# ───────────────────────────── základné CRUD operácie ─────────────────────────────


def db_insert_planned_session(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Vloží jeden riadok do coach_planned_sessions.
    """
    res = (
        supabase.table(TABLE_COACH_PLANNED_SESSIONS)
        .insert(data)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else {}


def db_insert_planned_sessions(rows: List[Dict[str, Any]]) -> int:
    """
    Vloží viac riadkov naraz.
    Vráti počet vložených riadkov.
    """
    if not rows:
        return 0

    res = (
        supabase.table(TABLE_COACH_PLANNED_SESSIONS)
        .insert(rows)
        .execute()
    )
    data = res.data or rows
    print(
        f"[DB-COACH-PLAN] insert_planned_sessions count={len(rows)} "
        f"db_returned={len(data)}"
    )
    return len(data)


def db_update_planned_session(session_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Upraví coach_planned_sessions.id = session_id danými dátami.
    """
    res = (
        supabase.table(TABLE_COACH_PLANNED_SESSIONS)
        .update(data)
        .eq("id", session_id)
        .execute()
    )
    rows = res.data or []
    print(
        f"[DB-COACH-PLAN] update_planned_session id={session_id} "
        f"updated={len(rows)}"
    )
    return rows[0] if rows else {}


def db_delete_planned_session(session_id: int) -> int:
    """
    Zmaže jeden riadok podľa id.
    Vráti počet zmazaných riadkov.
    """
    res = (
        supabase.table(TABLE_COACH_PLANNED_SESSIONS)
        .delete()
        .eq("id", session_id)
        .execute()
    )
    rows = res.data or []
    print(
        f"[DB-COACH-PLAN] delete_planned_session id={session_id} "
        f"deleted={len(rows)}"
    )
    return len(rows)


# ───────────────────────── špecializované helpery pre plán ─────────────────────────


def db_fetch_plan_rows_in_range(
    user_id: int,
    start_iso: str,
    end_iso: str,
    columns: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Vráti planned sessions pre usera v rozsahu dátumov (vrátane).
    Použitelné pre auto-mapovanie a iné služby.
    """
    sel = (
        columns
        or "id,user_id,plan_date,sport,title,duration_min,intensity,"
           "plan_id,activity_id,session_type,session_index,payload"
    )

    rows = (
        supabase.table(TABLE_COACH_PLANNED_SESSIONS)
        .select(sel)
        .eq("user_id", user_id)
        .gte("plan_date", start_iso)
        .lte("plan_date", end_iso)
        .execute()
    )
    data = rows.data or []
    print(
        f"[DB-COACH-PLAN] fetch_plan_rows_in_range user={user_id} "
        f"range={start_iso}..{end_iso} rows={len(data)}"
    )
    return data


def db_get_planned_range_rows(
    user_id: int,
    start_iso: str,
    end_iso: str,
) -> List[Dict[str, Any]]:
    """
    Full-select pre /range endpoint – vracia všetky stĺpce.
    """
    rows = (
        supabase.table(TABLE_COACH_PLANNED_SESSIONS)
        .select("*")
        .eq("user_id", user_id)
        .gte("plan_date", start_iso)
        .lte("plan_date", end_iso)
        .order("plan_date", desc=False)
        .execute()
    )
    data = rows.data or []

    # best-effort druhé radenie podľa session_index
    try:
        data.sort(
            key=lambda r: (r.get("plan_date"), r.get("session_index") or 0)
        )
    except Exception:
        pass

    print(
        f"[DB-COACH-PLAN] get_planned_range_rows user={user_id} "
        f"range={start_iso}..{end_iso} rows={len(data)}"
    )
    return data


def db_get_planned_sessions_filtered(
    user_id: int,
    date_from: Optional[str],
    date_to: Optional[str],
    plan_id: Optional[str],
) -> List[Dict[str, Any]]:
    """
    Pôvodný GET /coach-plan/{user_id} – filtre date_from/date_to/plan_id.
    """
    q = (
        supabase.table(TABLE_COACH_PLANNED_SESSIONS)
        .select("*")
        .eq("user_id", user_id)
    )
    if plan_id:
        q = q.eq("plan_id", plan_id)
    if date_from:
        q = q.gte("plan_date", date_from)
    if date_to:
        q = q.lte("plan_date", date_to)

    q = q.order("plan_date", desc=False)
    try:
        q = q.order("session_index", desc=False)
    except Exception:
        pass

    res = q.execute()
    data = res.data or []
    print(
        f"[DB-COACH-PLAN] get_planned_sessions_filtered user={user_id} "
        f"rows={len(data)} plan_id={plan_id} "
        f"from={date_from} to={date_to}"
    )
    return data


def db_clear_range_for_user(
    user_id: int,
    start_iso: str,
    end_iso: str,
) -> int:
    """
    Vymaže všetky planned sessions pre usera v danom rozsahu.
    """
    res = (
        supabase.table(TABLE_COACH_PLANNED_SESSIONS)
        .delete()
        .eq("user_id", user_id)
        .gte("plan_date", start_iso)
        .lte("plan_date", end_iso)
        .execute()
    )
    rows = res.data or []
    deleted = len(rows)
    print(
        f"[DB-COACH-PLAN] clear_range_for_user user={user_id} "
        f"range={start_iso}..{end_iso} deleted={deleted}"
    )
    return deleted


def db_delete_plan_for_user(
    user_id: int,
    plan_id: Optional[str],
    from_iso: Optional[str],
) -> int:
    """
    Zmazanie planned sessions:
      - ak plan_id → podľa plan_id,
      - inak od from_iso (vrátane).
    """
    q = (
        supabase.table(TABLE_COACH_PLANNED_SESSIONS)
        .delete()
        .eq("user_id", user_id)
    )
    if plan_id:
        q = q.eq("plan_id", plan_id)
    elif from_iso:
        q = q.gte("plan_date", from_iso)

    res = q.execute()
    rows = res.data or []
    deleted = len(rows)
    print(
        f"[DB-COACH-PLAN] delete_plan_for_user user={user_id} "
        f"plan_id={plan_id} from={from_iso} deleted={deleted}"
    )
    return deleted


def db_link_session_to_activity(
    session_id: int,
    activity_id: Optional[int],
) -> int:
    """
    Nastaví / resetuje väzbu na aktivitu.
    activity_id=None → odmapovanie.
    """
    payload: Dict[str, Any] = {
        "activity_id": int(activity_id) if activity_id is not None else None
    }

    res = (
        supabase.table(TABLE_COACH_PLANNED_SESSIONS)
        .update(payload)
        .eq("id", session_id)
        .execute()
    )
    rows = res.data or []
    print(
        f"[DB-COACH-PLAN] link_session_to_activity session_id={session_id} "
        f"activity_id={activity_id} updated_rows={len(rows)}"
    )
    return len(rows)

def db_reorder_planned_sessions(
    user_id: int,
    updates: List[Dict[str, Any]],
) -> int:
    """
    Batch update plan_date + session_index pre viac session_id naraz.
    Očakáva sa, že každý update má:
      { "id": int, "plan_date": "YYYY-MM-DD", "session_index": int }

    Pre istotu ešte filtrujem user_id v WHERE, nech si nemôžeš hýbať
    plánom niekoho iného.
    """
    if not updates:
        return 0

    total_updated = 0

    for u in updates:
        sid = u.get("id")
        plan_date = u.get("plan_date")
        session_index = u.get("session_index", 0)

        if sid is None or plan_date is None:
            continue

        try:
            sid_int = int(sid)
            idx_int = int(session_index)
        except Exception:
            continue

        res = (
            supabase.table(TABLE_COACH_PLANNED_SESSIONS)
            .update(
                {
                    "plan_date": plan_date,
                    "session_index": idx_int,
                }
            )
            .eq("id", sid_int)
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
        total_updated += len(rows)

    print(
        f"[DB-COACH-PLAN] reorder_planned_sessions user={user_id} "
        f"updates={len(updates)} updated_rows={total_updated}"
    )
    return total_updated