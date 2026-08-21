# DB/coach_plan_summaries.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_service_client
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_COACH_PLAN_SUMMARIES

# 🌟 Tabuľka coach_plan_summaries má RLS zapnuté BEZ policies (rovnaký
# vzor ako user_deletions) - je to čisto backend-spravovaný záznam, ku
# ktorému bežný user nemá pristupovať priamo cez RLS. Preto tu VŽDY
# používame service klienta, bez ohľadu na to, aký ctx prišiel zvonku
# (user JWT z FE requestu, alebo service_ctx z importu/cronu). Autorizácia
# "je toto tvoj user_id" sa rieši na úrovni endpointu (require_user + filter
# na user_id z JWT), nie na úrovni DB RLS pre túto konkrétnu tabuľku.

_sb = get_service_client()


def db_insert_plan_summary(
    row: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    try:
        res = _sb.table(TABLE_COACH_PLAN_SUMMARIES).insert(row).execute()
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
    try:
        res = (
            _sb.table(TABLE_COACH_PLAN_SUMMARIES)
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
    try:
        res = (
            _sb.table(TABLE_COACH_PLAN_SUMMARIES)
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
    try:
        res = (
            _sb.table(TABLE_COACH_PLAN_SUMMARIES)
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
