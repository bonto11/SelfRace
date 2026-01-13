from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Sequence, Mapping

from Services.users import require_jwt
from Routes_DB.account_delete import (
    db_get_account_delete_row,
    db_upsert_account_delete_request,
    db_cancel_account_delete_request,
)
from Configs.config import DELETE_GRACE_DAYS
from Modules.Supabase.client import get_sb


def _row_to_status(row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Mapuje raw DB riadok -> shape pre FE:
      { pending: bool, delete_at: str | null }
    """
    if not row:
        return {"pending": False, "delete_at": None}

    delete_at = row.get("delete_at")
    cancelled_at = row.get("cancelled_at")
    hard_deleted_at = row.get("hard_deleted_at")

    pending = bool(delete_at and not cancelled_at and not hard_deleted_at)

    return {
        "pending": pending,
        "delete_at": delete_at,
    }


# -------------------------------------------------------
# 1) User-úroveň (volané z FE, cez JWT)
# -------------------------------------------------------


def service_get_account_delete_status(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Stav vymazania účtu pre daného usera.
    - service=False -> RLS (JWT povinné)
    - service=True  -> service klient (cron, admin, atď.)
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    row = db_get_account_delete_row(
        user_id=int(user_id),
        user_jwt=jwt,
        service=service,
    )

    return _row_to_status(row)


def service_request_account_delete(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Označí účet na zmazanie po DELETE_GRACE_DAYS.
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    now = datetime.now(timezone.utc)
    delete_at = now + timedelta(days=DELETE_GRACE_DAYS)
    delete_at_iso = delete_at.isoformat()

    row = db_upsert_account_delete_request(
        user_id=int(user_id),
        delete_at_iso=delete_at_iso,
        user_jwt=jwt,
        service=service,
    )

    return _row_to_status(row)


def service_cancel_account_delete(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Zruší plánované zmazanie účtu.
    """
    jwt = user_jwt if service else require_jwt(user_jwt)

    row = db_cancel_account_delete_request(
        user_id=int(user_id),
        user_jwt=jwt,
        service=service,
    )

    return _row_to_status(row)


# -------------------------------------------------------
# 2) Hard delete – volané len z cronu (service režim)
# -------------------------------------------------------


def _hard_delete_user_data(sb, user_id: int) -> None:
    """
    Jedno miesto, kde zmažeš všetky dáta usera z DB.
    TU SA BUDEŠ HRÁŤ, keď budeš pridávať nové tabuľky.
    """
    uid = int(user_id)

    # príklady – prispôsob si podľa reálneho modelu
    sb.table("activities_streams").delete().eq("user_id", uid).execute()
    sb.table("activities_splits").delete().eq("user_id", uid).execute()
    sb.table("activities_laps").delete().eq("user_id", uid).execute()
    sb.table("activity_enrichment_minutes").delete().eq("user_id", uid).execute()
    sb.table("activities_summary").delete().eq("user_id", uid).execute()

    sb.table("coach_plans").delete().eq("user_id", uid).execute()
    sb.table("coach_sessions").delete().eq("user_id", uid).execute()

    sb.table("user_prefs").delete().eq("user_id", uid).execute()
    sb.table("strava_accounts").delete().eq("user_id", uid).execute()

    # account_delete_requests nerušíme – iba nastavíme hard_deleted_at nižšie
    # user row z auth_users / users tabuľky – podľa toho, ako to máš riešené:
    # sb.table("users").delete().eq("id", uid).execute()
    # Ak používaš Supabase auth.users, to riešiš cez policies / admin script osobitne.


def service_hard_delete_due_accounts(
    *,
    limit: int = 100,
) -> Dict[str, Any]:
    """
    Hard-delete účtov, ktoré:
      - majú delete_at <= now
      - cancelled_at IS NULL
      - hard_deleted_at IS NULL

    Beží výhradne v service režime (žiadne JWT).
    """
    sb = get_sb(user_jwt=None, service=True, caller="account_hard_delete")

    now_iso = datetime.now(timezone.utc).isoformat()

    resp = (
        sb.table("account_delete_requests")
        .select(
            "user_id, delete_at, cancelled_at, hard_deleted_at"
        )
        .lte("delete_at", now_iso)
        .is_("cancelled_at", None)
        .is_("hard_deleted_at", None)
        .limit(limit)
        .execute()
    )

    rows: Sequence[Mapping[str, Any]] = getattr(resp, "data", None) or []

    processed = 0
    errors = 0
    user_ids: list[int] = []

    for row in rows:
        user_id = int(row["user_id"])
        try:
            _hard_delete_user_data(sb, user_id)

            # označiť hard_deleted_at
            hd_iso = datetime.now(timezone.utc).isoformat()
            sb.table("account_delete_requests").update(
                {"hard_deleted_at": hd_iso}
            ).eq("user_id", user_id).execute()

            processed += 1
            user_ids.append(user_id)
        except Exception as e:  # noqa: BLE001
            print("[account_hard_delete] failed for user", user_id, ":", repr(e))
            errors += 1

    return {
        "ok": True,
        "fetched": len(rows),
        "processed": processed,
        "errors": errors,
        "user_ids": user_ids,
    }