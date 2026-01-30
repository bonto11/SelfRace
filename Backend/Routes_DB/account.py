from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Modules.Supabase.client import get_sb


def db_get_account_delete_row(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Načíta raw riadok z account_delete_requests (alebo None).
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="account_delete")

    resp = (
        sb.table("account_delete_requests")
        .select("user_id, requested_at, delete_at, cancelled_at, hard_deleted_at")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    rows = getattr(resp, "data", None) or []
    return rows[0] if rows else None


def db_upsert_account_delete_request(
    user_id: int,
    delete_at_iso: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Vytvorí / updatuje požiadavku na zmazanie účtu.
    - nastaví requested_at = now, delete_at = delete_at_iso, cancelled_at = NULL
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="account_delete")

    now_iso = datetime.now(timezone.utc).isoformat()

    row = {
        "user_id": int(user_id),
        "requested_at": now_iso,
        "delete_at": delete_at_iso,
        "cancelled_at": None,
        # hard_deleted_at necháva na cron/hard-delete službu
    }

    resp = (
        sb.table("account_delete_requests").upsert(row, on_conflict="user_id").execute()
    )

    data = getattr(resp, "data", None) or []
    if not data:
        raise RuntimeError("account_delete_requests upsert failed")

    return data[0]


def db_cancel_account_delete_request(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Zruší plánované zmazanie:
      - cancelled_at = now
      - delete_at nechávame tak (DB môže mať NOT NULL)
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="account_delete")
    now_iso = datetime.now(timezone.utc).isoformat()

    resp = (
        sb.table("account_delete_requests")
        .update({"cancelled_at": now_iso})
        .eq("user_id", int(user_id))
        .execute()
    )

    data = getattr(resp, "data", None) or []
    if not data:
        return {
            "user_id": int(user_id),
            "requested_at": None,
            "delete_at": None,
            "cancelled_at": now_iso,
            "hard_deleted_at": None,
        }

    return data[0]


def mark_strava_ever_synced_now(*, user_id: int) -> bool:
    """
    Nastaví ever_synced_at = now() pre usera.
    Volaj iba po úspešnom importe.
    """

    sb = get_sb(user_jwt="", service=True, caller="mark_strava_ever_synced_now")
    now_iso = datetime.now(timezone.utc).isoformat()
    resp = (
        sb.table("strava_accounts")
        .update({"ever_synced_at": now_iso})
        .eq("user_id", int(user_id))
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    return bool(rows)


def _parse_timestamptz_to_dt(v: Any) -> Optional[datetime]:
    if not v:
        return None

    s = str(v).strip()

    # supabase často vracia "2026-01-05 12:33:35.08823+00"
    # Python chce ideálne "+00:00" a T medzi dátumom/časom
    s = s.replace(" ", "T")
    s = s.replace("Z", "+00:00")
    if s.endswith("+00"):
        s = s[:-3] + "+00:00"

    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
    except Exception:
        return None


def get_strava_ever_synced_at_service(*, user_id: int) -> Optional[datetime]:
    """
    Service-only:
      - vráti ever_synced_at ako datetime UTC (alebo None)
    """
    sb = get_sb(service=True, caller="get_strava_ever_synced_at_service")
    resp = (
        sb.table("strava_accounts")
        .select("ever_synced_at")
        .eq("user_id", int(user_id))
        .limit(1)
        .execute()
    )

    rows = getattr(resp, "data", None) or []
    row = rows[0] if rows else None
    if not isinstance(row, dict):
        return None

    return _parse_timestamptz_to_dt(row.get("ever_synced_at"))