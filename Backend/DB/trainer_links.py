# DB/trainer_links.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_TRAINER_LINKS, TABLE_USERS

# Tabuľka nemá RLS policies (sql/trainer_links.sql) – volá sa len so
# service ctx. Vlastníctvo overuje route (is_owner).

_LINK_COLS = (
    "id, trainer_user_id, athlete_user_id, status, request_code, "
    "created_at, responded_at, ended_at, ended_by"
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------- share code (users) ----------------------

def db_get_share_code(user_id: int, *, ctx: AuthCtx) -> Optional[str]:
    sb = get_sb(ctx, caller="trainer_links.db_get_share_code")
    res = sb.table(TABLE_USERS).select("share_code").eq("id", user_id).limit(1).execute()
    row = (res.data or [None])[0]
    code = (row or {}).get("share_code")
    return str(code) if code else None


def db_set_share_code(user_id: int, code: str, *, ctx: AuthCtx) -> None:
    """Pri kolízii kódu vyhodí výnimku (unique index) – rieši service."""
    sb = get_sb(ctx, caller="trainer_links.db_set_share_code")
    sb.table(TABLE_USERS).update({"share_code": code}).eq("id", user_id).execute()


def db_get_user_id_by_share_code(code: str, *, ctx: AuthCtx) -> Optional[int]:
    sb = get_sb(ctx, caller="trainer_links.db_get_user_id_by_share_code")
    res = sb.table(TABLE_USERS).select("id").eq("share_code", code).limit(1).execute()
    row = (res.data or [None])[0]
    return int(row["id"]) if row and row.get("id") is not None else None


def db_get_users_brief(user_ids: Iterable[int], *, ctx: AuthCtx) -> Dict[int, Dict[str, Any]]:
    ids = sorted({int(i) for i in user_ids if i})
    if not ids:
        return {}
    sb = get_sb(ctx, caller="trainer_links.db_get_users_brief")
    res = (
        sb.table(TABLE_USERS)
        .select("id, display_name, name, mail_address")
        .in_("id", ids)
        .execute()
    )
    return {int(r["id"]): r for r in (res.data or [])}


# ---------------------- trainer_links ----------------------

def db_insert_trainer_link(
    trainer_user_id: int,
    athlete_user_id: int,
    request_code: str,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    sb = get_sb(ctx, caller="trainer_links.db_insert_trainer_link")
    res = (
        sb.table(TABLE_TRAINER_LINKS)
        .insert(
            {
                "trainer_user_id": trainer_user_id,
                "athlete_user_id": athlete_user_id,
                "status": "pending",
                "request_code": request_code,
            }
        )
        .execute()
    )
    row = (res.data or [None])[0]
    if not row:
        raise RuntimeError("Insert trainer_link failed – empty response")
    return row


def db_get_trainer_link(link_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="trainer_links.db_get_trainer_link")
    res = sb.table(TABLE_TRAINER_LINKS).select(_LINK_COLS).eq("id", link_id).limit(1).execute()
    return (res.data or [None])[0]


def db_list_open_links_for_user(user_id: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Čakajúce a aktívne linky, kde je user tréner alebo atlét."""
    sb = get_sb(ctx, caller="trainer_links.db_list_open_links_for_user")
    res = (
        sb.table(TABLE_TRAINER_LINKS)
        .select(_LINK_COLS)
        .or_(f"trainer_user_id.eq.{int(user_id)},athlete_user_id.eq.{int(user_id)}")
        .in_("status", ["pending", "active"])
        .order("created_at", desc=False)
        .execute()
    )
    return list(res.data or [])


def db_find_open_link(
    trainer_user_id: int,
    athlete_user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="trainer_links.db_find_open_link")
    res = (
        sb.table(TABLE_TRAINER_LINKS)
        .select(_LINK_COLS)
        .eq("trainer_user_id", trainer_user_id)
        .eq("athlete_user_id", athlete_user_id)
        .in_("status", ["pending", "active"])
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def db_get_active_link_for_athlete(athlete_user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="trainer_links.db_get_active_link_for_athlete")
    res = (
        sb.table(TABLE_TRAINER_LINKS)
        .select(_LINK_COLS)
        .eq("athlete_user_id", athlete_user_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def db_update_link_status(
    link_id: int,
    *,
    from_status: str,
    to_status: str,
    ended_by: Optional[int] = None,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Podmienená zmena stavu (len ak je link stále `from_status`).
    PREČO podmienka: dvaja (tréner a atlét) môžu kliknúť naraz – bez nej by
    napr. ukončenie prepísalo práve prijatú žiadosť. Vráti None, ak sa
    stav medzitým zmenil.
    """
    fields: Dict[str, Any] = {"status": to_status}
    if from_status == "pending":
        fields["responded_at"] = _now_iso()
    if to_status == "ended":
        fields["ended_at"] = _now_iso()
        fields["ended_by"] = ended_by
    if from_status == "active" and to_status == "pending":
        # návrat po zlyhaní prijatia – prijatie sa nekonalo
        fields["responded_at"] = None

    sb = get_sb(ctx, caller="trainer_links.db_update_link_status")
    res = (
        sb.table(TABLE_TRAINER_LINKS)
        .update(fields)
        .eq("id", link_id)
        .eq("status", from_status)
        .execute()
    )
    return (res.data or [None])[0]


def db_reject_other_pending_for_athlete(
    athlete_user_id: int,
    keep_link_id: int,
    *,
    ctx: AuthCtx,
) -> None:
    sb = get_sb(ctx, caller="trainer_links.db_reject_other_pending_for_athlete")
    (
        sb.table(TABLE_TRAINER_LINKS)
        .update({"status": "rejected", "responded_at": _now_iso()})
        .eq("athlete_user_id", athlete_user_id)
        .eq("status", "pending")
        .neq("id", keep_link_id)
        .execute()
    )
