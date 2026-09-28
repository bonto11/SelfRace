# DB/exercise_suggestions.py
"""
⚠️ TENTO SÚBOR JE NAJISTEJŠÍ ODHAD, NIE OVERENÝ VZOR.

Nemám k dispozícii žiadny existujúci DB/*.py modul z tohto projektu, takže
neviem, akým presným spôsobom sa u vás získava Supabase klient scoped na
`ctx` (RLS). Funkcie nižšie majú správne mená a signatúry (podľa toho, ako
ich volá Services/exercise_suggestions.py), ale telo funkcie `_client(ctx)`
je nutné nahradiť tým, čo reálne robí napr. DB/strength_sessions.py alebo
akýkoľvek iný váš existujúci DB modul. Skopíruj odtiaľ hlavičku importu
a spôsob získania klienta, ostatné (insert/select) už bude sedieť na
rovnaký vzor ako zvyšok tohto súboru.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx

TABLE = "exercise_suggestions"


def _client(ctx: AuthCtx):
    """
    ⚠️ NAHRAĎ týmto istým spôsobom, akým iné DB moduly získavajú klienta,
    napr. (over si presný import a názov funkcie vo vašom kóde):

        from Modules.Supabase.client import get_client_for_ctx
        return get_client_for_ctx(ctx)

    alebo ak ctx už samo o sebe nesie klienta:

        return ctx.client
    """
    raise NotImplementedError(
        "DB/exercise_suggestions.py: _client(ctx) treba napojiť na váš "
        "skutočný spôsob získania Supabase klienta - pozri iný DB modul."
    )


def db_insert_exercise_suggestion(row: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    """Vloží nový návrh cviku. Vracia vložený riadok alebo None pri zlyhaní."""
    try:
        res = _client(ctx).table(TABLE).insert(row).execute()
        rows = getattr(res, "data", None) or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print(f"[DB][exercise_suggestions] insert failed: {repr(e)}")
        return None


def db_list_exercise_suggestions_for_user(
    user_id: int, *, limit: int = 50, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """Návrhy jedného usera, najnovšie prvé."""
    try:
        res = (
            _client(ctx)
            .table(TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return getattr(res, "data", None) or []
    except Exception as e:  # noqa: BLE001
        print(f"[DB][exercise_suggestions] list failed: {repr(e)}")
        return []
