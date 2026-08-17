from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_STRAVA_ACCOUNTS, TABLE_ACCOUNT_DELETE_REQ

def db_get_account_delete_row(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Načíta raw riadok z account_delete_requests (alebo None).
    """
    sb = get_sb(ctx, caller="account.db_get_account_delete_row")

    resp = (
        sb.table(TABLE_ACCOUNT_DELETE_REQ)
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
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vytvorí / updatuje požiadavku na zmazanie účtu.
    - nastaví requested_at = now, delete_at = delete_at_iso, cancelled_at = NULL
    """
    sb = get_sb(ctx, caller="account.db_upsert_account_delete_request")

    now_iso = datetime.now(timezone.utc).isoformat()

    row = {
        "user_id": int(user_id),
        "requested_at": now_iso,
        "delete_at": delete_at_iso,
        "cancelled_at": None,
        # hard_deleted_at necháva na cron/hard-delete službu
    }

    resp = (
        sb.table(TABLE_ACCOUNT_DELETE_REQ).upsert(row, on_conflict="user_id").execute()
    )

    data = getattr(resp, "data", None) or []
    if not data:
        raise RuntimeError("account_delete_requests upsert failed")

    return data[0]


def db_cancel_account_delete_request(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Zruší plánované zmazanie:
      - cancelled_at = now
      - delete_at nechávame tak (DB môže mať NOT NULL)
    """
    sb = get_sb(ctx, caller="account.db_cancel_account_delete_request")
    now_iso = datetime.now(timezone.utc).isoformat()

    resp = (
        sb.table(TABLE_ACCOUNT_DELETE_REQ)
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


def mark_strava_ever_synced_now(ctx: AuthCtx, *, user_id: int) -> bool:
    """
    Nastaví ever_synced_at = now() pre usera.
    Volaj iba po úspešnom importe.
    """

    sb = get_sb(ctx, caller="account.mark_strava_ever_synced_now")
    now_iso = datetime.now(timezone.utc).isoformat()
    resp = (
        sb.table(TABLE_STRAVA_ACCOUNTS)
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


def get_strava_ever_synced_at_service(
    ctx: AuthCtx, *, user_id: int
) -> Optional[datetime]:
    """
    Service-only:
      - vráti ever_synced_at ako datetime UTC (alebo None)
    """
    sb = get_sb(ctx, caller="account.get_strava_ever_synced_at_service")
    resp = (
        sb.table(TABLE_STRAVA_ACCOUNTS)
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

def db_get_strava_admin_override(
    user_id: int, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """Vráti aktívny admin override okna importu, ak existuje (inak None)."""
    sb = get_sb(ctx, caller="account.db_get_strava_admin_override")
    resp = (
        sb.table(TABLE_STRAVA_ACCOUNTS)
        .select("admin_override_days, admin_override_note, admin_override_granted_at")
        .eq("user_id", int(user_id))
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    row = rows[0] if rows else None
    print(f"[ADMIN_OVERRIDE_DEBUG] user_id={user_id} raw_row={row}")
    if not row or not row.get("admin_override_days"):
        print(f"[ADMIN_OVERRIDE_DEBUG] user_id={user_id} -> NO override (row missing or days falsy)")
        return None
    result = {
        "days": int(row["admin_override_days"]),
        "note": row.get("admin_override_note"),
        "granted_at": row.get("admin_override_granted_at"),
    }
    print(f"[ADMIN_OVERRIDE_DEBUG] user_id={user_id} -> override FOUND: {result}")
    return result
def db_set_strava_admin_override(
    user_id: int, days: int, note: Optional[str], *, ctx: AuthCtx
) -> bool:
    """Nastaví jednorazový admin override okna importu pre usera (support case)."""
    sb = get_sb(ctx, caller="account.db_set_strava_admin_override")
    now_iso = datetime.now(timezone.utc).isoformat()
    resp = (
        sb.table(TABLE_STRAVA_ACCOUNTS)
        .update(
            {
                "admin_override_days": int(days),
                "admin_override_note": note,
                "admin_override_granted_at": now_iso,
            }
        )
        .eq("user_id", int(user_id))
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    return bool(rows)


def db_clear_strava_admin_override(user_id: int, *, ctx: AuthCtx) -> bool:
    """Vynuluje override - volať po úspešnom dobehnutí importu, čo ho spotreboval."""
    sb = get_sb(ctx, caller="account.db_clear_strava_admin_override")
    resp = (
        sb.table(TABLE_STRAVA_ACCOUNTS)
        .update(
            {
                "admin_override_days": None,
                "admin_override_note": None,
                "admin_override_granted_at": None,
            }
        )
        .eq("user_id", int(user_id))
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    return bool(rows)

def db_admin_clear_strava_reconnect_cooldown(user_id: int, *, ctx: AuthCtx) -> bool:
    """
    Admin akcia: okamžite zruší reconnect cooldown (24h od deauthorized_at)
    tým, že deauthorized_at nastaví na None. Nezasahuje do access/refresh
    tokenov - tie ostávajú tak ako sú (zvyčajne purgnuté pri disconnecte),
    takže user si aj tak musí prejsť OAuth flow znova, len naň nebude
    čakať zvyšok cooldownu.
    """
    sb = get_sb(ctx, caller="account.db_admin_clear_strava_reconnect_cooldown")
    resp = (
        sb.table(TABLE_STRAVA_ACCOUNTS)
        .update({"deauthorized_at": None})
        .eq("user_id", int(user_id))
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    return bool(rows)


def db_get_strava_admin_status(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    """Raw stav pre admin diagnostiku - service-mode, obchádza RLS."""
    sb = get_sb(ctx, caller="account.db_get_strava_admin_status")
    resp = (
        sb.table(TABLE_STRAVA_ACCOUNTS)
        .select(
            "athlete_id, expires_at, deauthorized_at, access_token, refresh_token, "
            "ever_synced_at, admin_override_days, admin_override_note, admin_override_granted_at"
        )
        .eq("user_id", int(user_id))
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    return rows[0] if rows else None