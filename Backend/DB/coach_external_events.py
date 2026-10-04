from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_EXTERNAL_EVENTS


# 1=Mon..7=Sun
def _wk(v: Any) -> int:
    try:
        n = int(v)
        return n if 1 <= n <= 7 else 99
    except Exception:  # noqa: BLE001
        return 99


def db_list_external_events_for_user(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Vráti všetky externé eventy pre usera.
    Triedi primárne podľa weekday_int (1..7), potom created_at.
    """
    try:
        sb = get_sb(
            ctx, caller="coach_external_events.db_list_external_events_for_user"
        )

        res = (
            sb.table(TABLE_COACH_EXTERNAL_EVENTS)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .execute()
        )
        rows = res.data or []

        # stable sort: weekday_int then created_at
        rows.sort(
            key=lambda r: (_wk(r.get("weekday_int")), str(r.get("created_at") or ""))
        )
        return rows
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] list error:", repr(e))
        return []


def db_insert_external_events_returning(
    rows: List[Dict[str, Any]],
    *,
    ctx: AuthCtx,
) -> Optional[List[Dict[str, Any]]]:
    """
    Vloží riadky a vráti ich (s novými id). None = insert zlyhal.
    Jeden insert = jeden SQL príkaz, takže sa vloží buď všetko, alebo nič.
    """
    if not rows:
        return []

    try:
        sb = get_sb(
            ctx, caller="coach_external_events.db_insert_external_events_returning"
        )

        try:
            res = sb.table(TABLE_COACH_EXTERNAL_EVENTS).insert(rows).execute()
        except Exception as e:  # noqa: BLE001
            # PREČO: stĺpec intensity pribudol neskôr. Kým nebeží migrácia,
            # insert s ním padne - radšej uložiť bez náročnosti (odvodí sa
            # z priority) než nič.
            if "intensity" not in repr(e):
                raise
            print("[DB-COACH-EXT] insert without intensity column:", repr(e))
            stripped = [{k: v for k, v in r.items() if k != "intensity"} for r in rows]
            res = sb.table(TABLE_COACH_EXTERNAL_EVENTS).insert(stripped).execute()
        return list(res.data or [])
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] insert error:", repr(e))
        return None


def db_delete_external_events_except(
    user_id: int,
    keep_ids: List[int],
    *,
    ctx: AuthCtx,
) -> Optional[int]:
    """
    Zmaže všetky externé aktivity usera okrem keep_ids. Vráti počet
    zmazaných, None = zlyhalo.
    """
    try:
        sb = get_sb(
            ctx, caller="coach_external_events.db_delete_external_events_except"
        )
        q = sb.table(TABLE_COACH_EXTERNAL_EVENTS).delete().eq("user_id", user_id)
        if keep_ids:
            q = q.not_.in_("id", keep_ids)
        res = q.execute()
        return len(res.data or [])
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] delete except error:", repr(e))
        return None


def db_delete_external_events_by_ids(
    user_id: int,
    ids: List[int],
    *,
    ctx: AuthCtx,
) -> bool:
    """Zmaže konkrétne riadky (rollback práve vložených). False = zlyhalo."""
    if not ids:
        return True
    try:
        sb = get_sb(
            ctx, caller="coach_external_events.db_delete_external_events_by_ids"
        )
        (
            sb.table(TABLE_COACH_EXTERNAL_EVENTS)
            .delete()
            .eq("user_id", user_id)
            .in_("id", ids)
            .execute()
        )
        return True
    except Exception as e:  # noqa: BLE001
        print("[DB-COACH-EXT] delete by ids error:", repr(e))
        return False
