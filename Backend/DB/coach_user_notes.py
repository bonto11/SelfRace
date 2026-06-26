# DB/coach_user_notes.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx

TABLE = "coach_user_notes"
MAX_STICKY = 2
EPHEMERAL_HISTORY_LIMIT = 2


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# =========================
# LIST
# =========================

def db_list_sticky_notes(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """Vráti všetky sticky poznámky usera zoradené od najstaršej."""
    sb = get_sb(ctx, caller="coach_user_notes.db_list_sticky_notes")
    res = (
        sb.table(TABLE)
        .select("id,type,text,created_at,updated_at")
        .eq("user_id", int(user_id))
        .eq("type", "sticky")
        .order("created_at", desc=False)
        .execute()
    )
    return res.data or []


def db_list_recent_ephemeral(
    user_id: int,
    *,
    ctx: AuthCtx,
    limit: int = EPHEMERAL_HISTORY_LIMIT,
) -> List[Dict[str, Any]]:
    """Vráti posledné N ephemeral poznámok (vrátane aplikovaných) — na zobrazenie histórie."""
    sb = get_sb(ctx, caller="coach_user_notes.db_list_recent_ephemeral")
    res = (
        sb.table(TABLE)
        .select("id,type,text,applied,created_at")
        .eq("user_id", int(user_id))
        .eq("type", "ephemeral")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = res.data or []
    return list(reversed(rows))  # vrátim od najstaršej


def db_get_pending_ephemeral(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """Vráti poslednú ephemeral poznámku, ktorá ešte nebola použitá (applied=false)."""
    sb = get_sb(ctx, caller="coach_user_notes.db_get_pending_ephemeral")
    res = (
        sb.table(TABLE)
        .select("id,type,text,applied,created_at")
        .eq("user_id", int(user_id))
        .eq("type", "ephemeral")
        .eq("applied", False)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


# =========================
# COUNT
# =========================

def db_count_sticky_notes(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> int:
    """Vráti počet existujúcich sticky poznámok."""
    sb = get_sb(ctx, caller="coach_user_notes.db_count_sticky_notes")
    res = (
        sb.table(TABLE)
        .select("id", count="exact")
        .eq("user_id", int(user_id))
        .eq("type", "sticky")
        .execute()
    )
    return res.count or 0


# =========================
# CREATE
# =========================

def db_create_note(
    user_id: int,
    *,
    type: str,
    text: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """Vytvorí novú poznámku (sticky alebo ephemeral)."""
    sb = get_sb(ctx, caller="coach_user_notes.db_create_note")
    now = _now_iso()
    row = {
        "user_id": int(user_id),
        "type": type,
        "text": text.strip(),
        "applied": False,
        "created_at": now,
        "updated_at": now,
    }
    res = sb.table(TABLE).insert(row).execute()
    rows = res.data or []
    return rows[0] if rows else {}


# =========================
# UPDATE
# =========================

def db_update_sticky_note(
    user_id: int,
    note_id: int,
    *,
    text: str,
    ctx: AuthCtx,
) -> bool:
    """Aktualizuje text sticky poznámky (len vlastné záznamy usera)."""
    sb = get_sb(ctx, caller="coach_user_notes.db_update_sticky_note")
    res = (
        sb.table(TABLE)
        .update({"text": text.strip(), "updated_at": _now_iso()})
        .eq("user_id", int(user_id))
        .eq("id", int(note_id))
        .eq("type", "sticky")
        .execute()
    )
    err = getattr(res, "error", None)
    if err:
        print(f"❌ [NOTES] db_update_sticky_note error: {err}")
        return False
    return True


def db_mark_ephemeral_applied(
    user_id: int,
    note_id: int,
    *,
    ctx: AuthCtx,
) -> bool:
    """Označí ephemeral poznámku ako použitú po vygenerovaní plánu."""
    sb = get_sb(ctx, caller="coach_user_notes.db_mark_ephemeral_applied")
    res = (
        sb.table(TABLE)
        .update({"applied": True, "updated_at": _now_iso()})
        .eq("user_id", int(user_id))
        .eq("id", int(note_id))
        .eq("type", "ephemeral")
        .execute()
    )
    err = getattr(res, "error", None)
    if err:
        print(f"❌ [NOTES] db_mark_ephemeral_applied error: {err}")
        return False
    return True


# =========================
# DELETE
# =========================

def db_delete_note(
    user_id: int,
    note_id: int,
    *,
    ctx: AuthCtx,
) -> bool:
    """Zmaže poznámku (sticky alebo ephemeral) — len vlastné záznamy usera."""
    sb = get_sb(ctx, caller="coach_user_notes.db_delete_note")
    res = (
        sb.table(TABLE)
        .delete()
        .eq("user_id", int(user_id))
        .eq("id", int(note_id))
        .execute()
    )
    err = getattr(res, "error", None)
    if err:
        print(f"❌ [NOTES] db_delete_note error: {err}")
        return False
    return True
