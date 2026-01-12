from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_COACH_ATHLETE_STATE


def db_insert_athlete_state(
    user_id: int,
    model: str,
    state_json: Dict[str, Any],
    *,
    version: int = 1,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[int]:
    """
    INSERT do coach_athlete_state.

    Typicky:
      - FE/AI:   user_jwt=jwt
      - worker:  service=True (ak raz spravíš batch analýzy)
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="coach_athlete_state")

    row = {
        "user_id": user_id,
        "model": model,
        "version": version,
        "state_json": state_json,
    }

    try:
        res = sb.table(TABLE_COACH_ATHLETE_STATE).insert(row).execute()
        data = res.data or []
        if data and isinstance(data, list):
            return data[0].get("id")  # type: ignore[return-value]
        return None
    except Exception:  # noqa: BLE001
        return None


def db_get_state_by_id(
    state_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Načíta konkrétny stav podľa primárneho kľúča id.

    - s user_jwt → RLS stráži, či user môže daný riadok čítať
    - so service=True → worker môže čítať hociktorého usera
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="coach_athlete_state")

    try:
        res = (
            sb.table(TABLE_COACH_ATHLETE_STATE)
            .select("id,user_id,model,version,state_json,compare_previous,created_at")
            .eq("id", state_id)
            .limit(1)
            .execute()
        )
        rows = list(res.data or [])
        return rows[0] if rows else None
    except Exception:  # noqa: BLE001
        return None


def db_get_latest_state_for_user(
    user_id: int,
    *,
    version: Optional[int] = 1,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Najnovší stav pre daného usera (podľa created_at DESC).

    Ak version je None, nefiltruje podľa verzie.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="coach_athlete_state")

    try:
        q = (
            sb.table(TABLE_COACH_ATHLETE_STATE)
            .select("id,user_id,model,version,state_json,compare_previous,created_at")
            .eq("user_id", user_id)
        )
        if version is not None:
            q = q.eq("version", version)

        res = q.order("created_at", desc=True).limit(1).execute()
        rows = list(res.data or [])
        return rows[0] if rows else None
    except Exception:  # noqa: BLE001
        return None


def db_get_latest_states_for_user(
    user_id: int,
    *,
    limit: int = 2,
    version: Optional[int] = 1,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Vráti posledné N stavov (vrátane state_json), zoradené podľa created_at DESC.

    Typické použitie:
      - limit=2 → posledná a predposledná analýza pre porovnanie.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="coach_athlete_state")

    try:
        q = (
            sb.table(TABLE_COACH_ATHLETE_STATE)
            .select("id,user_id,model,version,state_json,compare_previous,created_at")
            .eq("user_id", user_id)
        )
        if version is not None:
            q = q.eq("version", version)

        res = q.order("created_at", desc=True).limit(limit).execute()
        return list(res.data or [])
    except Exception:  # noqa: BLE001
        return []


def db_update_state_compare_previous(
    state_id: int,
    compare_previous: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Uloží JSON porovnania do stĺpca compare_previous pre daný state_id
    a vráti aktualizovaný riadok.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="coach_athlete_state")

    try:
        res = (
            sb.table(TABLE_COACH_ATHLETE_STATE)
            .update({"compare_previous": compare_previous})
            .eq("id", state_id)
            .execute()
        )
        rows = list(res.data or [])
        return rows[0] if rows else None
    except Exception:  # noqa: BLE001
        return None


def db_list_states_for_user(
    user_id: int,
    *,
    limit: int = 20,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    História stavov pre usera (bez state_json, len meta – vhodné na prehľad v UI).
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="coach_athlete_state")

    try:
        res = (
            sb.table(TABLE_COACH_ATHLETE_STATE)
            .select("id,user_id,model,version,created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return list(res.data or [])
    except Exception:  # noqa: BLE001
        return []
    
def db_get_latest_athlete_progress(
    user_id: int,
    *,
    version: Optional[int] = 1,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Vráti najnovší záznam s compare_previous pre daného usera.

    Používame stĺpec compare_previous (jsonb), ktorý drží AI progress report.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="coach_athlete_state")

    try:
        q = (
            sb.table(TABLE_COACH_ATHLETE_STATE)
            .select("id,user_id,model,version,created_at,compare_previous")
            .eq("user_id", user_id)
        )
        if version is not None:
            q = q.eq("version", version)

        # ak chceš byť super-striktný a filtrovať len riadky s ne-null compare_previous:
        # q = q.not_.is_("compare_previous", None)

        res = q.order("created_at", desc=True).limit(1).execute()
        rows = list(res.data or [])
        return rows[0] if rows else None
    except Exception:  # noqa: BLE001
        return None