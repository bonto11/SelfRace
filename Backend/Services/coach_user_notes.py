# Services/coach_user_notes.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx
from DB.coach_user_notes import (
    MAX_STICKY,
    db_list_sticky_notes,
    db_list_recent_ephemeral,
    db_get_pending_ephemeral,
    db_count_sticky_notes,
    db_create_note,
    db_update_sticky_note,
    db_mark_ephemeral_applied,
    db_delete_note,
)

MAX_TEXT_LEN = 500


def _validate_text(text: Optional[str]) -> Optional[str]:
    if not isinstance(text, str):
        return None
    t = text.strip()
    if not t:
        return None
    if len(t) > MAX_TEXT_LEN:
        t = t[:MAX_TEXT_LEN].rstrip()
    return t


# =========================
# READ
# =========================

def service_list_notes(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vráti sticky poznámky + ephemeral históriu (posledné 2).
    Toto je hlavný read endpoint — widget aj detail page volajú len toto.
    """
    sticky = db_list_sticky_notes(user_id=user_id, ctx=ctx)
    ephemeral_history = db_list_recent_ephemeral(user_id=user_id, ctx=ctx)
    pending = db_get_pending_ephemeral(user_id=user_id, ctx=ctx)
    return {
        "sticky": sticky,
        "ephemeral_history": ephemeral_history,
        "pending_ephemeral": pending,
        "sticky_slots_used": len(sticky),
        "sticky_slots_max": MAX_STICKY,
    }


# =========================
# STICKY CRUD
# =========================

def service_create_sticky(
    user_id: int,
    *,
    text: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vytvorí novú sticky poznámku.
    Limit: max 2 sticky na usera.
    """
    t = _validate_text(text)
    if not t:
        return {"ok": False, "code": "empty_text", "message": "Text nesmie byť prázdny."}

    count = db_count_sticky_notes(user_id=user_id, ctx=ctx)
    if count >= MAX_STICKY:
        return {
            "ok": False,
            "code": "sticky_limit_reached",
            "message": f"Môžeš mať najviac {MAX_STICKY} trvalé poznámky.",
        }

    note = db_create_note(user_id=user_id, type="sticky", text=t, ctx=ctx)
    if not note:
        return {"ok": False, "code": "db_error", "message": "Nepodarilo sa uložiť poznámku."}

    return {"ok": True, "note": note}


def service_update_sticky(
    user_id: int,
    note_id: int,
    *,
    text: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """Aktualizuje text existujúcej sticky poznámky."""
    t = _validate_text(text)
    if not t:
        return {"ok": False, "code": "empty_text", "message": "Text nesmie byť prázdny."}

    ok = db_update_sticky_note(user_id=user_id, note_id=note_id, text=t, ctx=ctx)
    if not ok:
        return {"ok": False, "code": "db_error", "message": "Nepodarilo sa aktualizovať poznámku."}

    return {"ok": True}


def service_delete_note(
    user_id: int,
    note_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """Zmaže sticky alebo ephemeral poznámku."""
    ok = db_delete_note(user_id=user_id, note_id=note_id, ctx=ctx)
    if not ok:
        return {"ok": False, "code": "db_error", "message": "Nepodarilo sa zmazať poznámku."}
    return {"ok": True}


# =========================
# EPHEMERAL
# =========================

def service_add_ephemeral(
    user_id: int,
    *,
    text: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Uloží jednorazovú poznámku pred regenerovaním plánu.
    Vždy vytvára nový záznam (staré applied=false sa ignorujú — pri generovaní
    sa berie vždy posledný pending, starší sa automaticky prepisuje applied=true
    cez service_consume_pending_ephemeral).
    """
    t = _validate_text(text)
    if not t:
        return {"ok": False, "code": "empty_text", "message": "Text nesmie byť prázdny."}

    note = db_create_note(user_id=user_id, type="ephemeral", text=t, ctx=ctx)
    if not note:
        return {"ok": False, "code": "db_error", "message": "Nepodarilo sa uložiť poznámku."}

    return {"ok": True, "note": note}


def service_consume_pending_ephemeral(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[str]:
    """
    Používa sa z buildera pri generovaní plánu.
    Vráti text pending ephemeral (alebo None) a označí ho ako applied.
    """
    pending = db_get_pending_ephemeral(user_id=user_id, ctx=ctx)
    if not pending:
        return None

    db_mark_ephemeral_applied(user_id=user_id, note_id=int(pending["id"]), ctx=ctx)
    return pending.get("text")


def service_get_notes_for_builder(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Kompaktný read pre AI builder — vráti sticky texty + pending ephemeral text.
    Neoznačuje ephemeral ako applied — to robí service_consume_pending_ephemeral
    až po úspešnom vygenerovaní.
    """
    sticky = db_list_sticky_notes(user_id=user_id, ctx=ctx)
    pending = db_get_pending_ephemeral(user_id=user_id, ctx=ctx)
    return {
        "sticky_notes": [n["text"] for n in sticky],
        "ephemeral_note": pending.get("text") if pending else None,
        "ephemeral_note_id": int(pending["id"]) if pending else None,
    }
