# Services/exercise_suggestions.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx
from Configs.strength_muscles import MUSCLE_GROUPS
from DB.exercise_suggestions import (
    db_insert_exercise_suggestion,
    db_list_exercise_suggestions_for_user,
)

VALID_MUSCLES = set(MUSCLE_GROUPS)
VALID_LOAD_MODES = {"external", "bodyweight_plus"}
VALID_MEASURES = {"reps", "time", "distance"}


def service_create_exercise_suggestion(
    *,
    user_id: int,
    name: str,
    muscles: Optional[List[str]],
    load_mode: Optional[str],
    measure: Optional[str],
    equipment: Optional[List[str]],
    notes: Optional[str],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Uloží návrh cviku od usera na doplnenie do STRENGTH_EXERCISE_CATALOG.

    🌟 ZMENA: user zadáva SVALOVÉ PARTIE, nie pohybový vzor. Vzor (pattern)
    je interná vec generátora - doplní sa ručne pri schvaľovaní návrhu,
    spolu so zápisom do Configs/strength_muscles.py.
    """
    clean_name = str(name or "").strip()[:100]
    if not clean_name:
        return {"ok": False, "code": "name_required"}

    clean_muscles = [m for m in (muscles or []) if m in VALID_MUSCLES][:6]
    if not clean_muscles:
        return {"ok": False, "code": "muscles_required"}

    row = {
        "user_id": int(user_id),
        "name": clean_name,
        "muscles": clean_muscles,
        "load_mode": str(load_mode) if load_mode in VALID_LOAD_MODES else "external",
        "measure": str(measure) if measure in VALID_MEASURES else "reps",
        "equipment": [str(e)[:50] for e in (equipment or []) if isinstance(e, str)][:10],
        "notes": str(notes)[:500] if notes else None,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    created = db_insert_exercise_suggestion(row, ctx=ctx)
    if not created:
        return {"ok": False, "code": "insert_failed"}
    return {"ok": True, "data": created}


def service_list_exercise_suggestions(
    *, user_id: int, limit: int = 50, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    return db_list_exercise_suggestions_for_user(user_id, limit=limit, ctx=ctx)

# ---------------------------------------------------------------------------
# ADMIN PANEL – Katalóg cvikov → Návrhy
# ---------------------------------------------------------------------------

# Texty upozornenia autorovi návrhu (push, inak e-mail). {name} = jeho
# názov z návrhu, {catalog} = ako sa cvik volá v appke.
_NOTIFY = {
    "sk": {
        "approved_title": "Tvoj cvik je v appke 💪",
        "approved_body": "Cvik „{name}“ sme pridali do katalógu ako „{catalog}“. Ďakujeme za tip!",
        "rejected_title": "Ďakujeme za návrh cviku",
        "rejected_body": "Cvik „{name}“ sme zatiaľ do katalógu nepridali.",
        "sign": "Ďakujeme,\nPatrik zo SelfRace",
    },
    "cs": {
        "approved_title": "Tvůj cvik je v aplikaci 💪",
        "approved_body": "Cvik „{name}“ jsme přidali do katalogu jako „{catalog}“. Díky za tip!",
        "rejected_title": "Díky za návrh cviku",
        "rejected_body": "Cvik „{name}“ jsme zatím do katalogu nepřidali.",
        "sign": "Díky,\nPatrik ze SelfRace",
    },
    "en": {
        "approved_title": "Your exercise is in the app 💪",
        "approved_body": "We added “{name}” to the exercise catalog as “{catalog}”. Thanks for the tip!",
        "rejected_title": "Thanks for the exercise suggestion",
        "rejected_body": "We haven't added “{name}” to the catalog for now.",
        "sign": "Thanks,\nPatrik from SelfRace",
    },
}


def service_admin_list_suggestions(*, status: Optional[str] = None) -> Dict[str, Any]:
    """Návrhy všetkých userov s menom a e-mailom autora."""
    from DB.exercise_suggestions import db_list_all_exercise_suggestions
    from DB.users import db_get_users_basic
    from Modules.Supabase.auth import service_ctx

    ctx = service_ctx("exercise_suggestions.admin_list")
    rows = db_list_all_exercise_suggestions(status=status, limit=500, ctx=ctx)
    users: Dict[int, Dict[str, Any]] = {}
    try:
        ids = sorted({int(r["user_id"]) for r in rows if r.get("user_id") is not None})
        users = {int(u["id"]): u for u in db_get_users_basic(ids, ctx=ctx)}
    except Exception as e:  # noqa: BLE001
        print(f"[EX-SUGGEST] users failed: {repr(e)}")
    for r in rows:
        u = users.get(int(r.get("user_id") or 0)) or {}
        r["user_email"] = u.get("mail_address")
        r["user_name"] = u.get("display_name")
    return {"ok": True, "items": rows}


def _notify_author(user_id: int, suggestion: Dict[str, Any], *, approved: bool, catalog_name: Optional[str],
                   message: Optional[str], ctx: AuthCtx) -> str:
    """Push autorovi, bez push odberu e-mail. Vráti 'push' / 'email' / 'none'."""
    from Services.notifications import _get_user_language, service_send_push_notification

    lang = _get_user_language(user_id, ctx)
    t = _NOTIFY.get(lang) or _NOTIFY["en"]
    name = str(suggestion.get("name") or "")
    title = t["approved_title"] if approved else t["rejected_title"]
    body = t["approved_body" if approved else "rejected_body"].format(name=name, catalog=catalog_name or name)
    if message:
        body = f"{body} {message.strip()}"

    try:
        res = service_send_push_notification(
            user_id=user_id, title=title, body=body, url="/activities/strength", ctx=ctx
        )
        if int(res.get("sent") or 0) > 0:
            return "push"
    except Exception as e:  # noqa: BLE001
        print(f"[EX-SUGGEST] push failed user={user_id}: {repr(e)}")

    try:
        from DB.users import db_get_users_basic
        from Modules.Email.smtp import email_configured, send_email

        users = db_get_users_basic([user_id], ctx=ctx)
        email = (users[0] if users else {}).get("mail_address")
        if email and email_configured():
            ok, _err = send_email(email, title, f"{body}\n\n{t['sign']}")
            if ok:
                return "email"
    except Exception as e:  # noqa: BLE001
        print(f"[EX-SUGGEST] email failed user={user_id}: {repr(e)}")
    return "none"


def service_admin_resolve_suggestion(
    suggestion_id: int,
    *,
    status: str,
    exercise_id: Optional[str],
    notify: bool,
    message: Optional[str],
) -> Dict[str, Any]:
    """
    Vybavenie návrhu: approved (s cvikom z katalógu) / rejected / new.
    Upozornenie autora je voliteľné – posiela sa, len keď ho admin zaškrtne.
    """
    from Configs.strength_catalog import get_exercise
    from DB.exercise_suggestions import db_get_exercise_suggestion, db_update_exercise_suggestion
    from Modules.Supabase.auth import service_ctx

    if status not in ("approved", "rejected", "new"):
        return {"ok": False, "code": "invalid_status"}
    ctx = service_ctx("exercise_suggestions.admin_resolve")
    sug = db_get_exercise_suggestion(suggestion_id, ctx=ctx)
    if not sug:
        return {"ok": False, "code": "not_found"}

    catalog_name: Optional[str] = None
    if status == "approved":
        ex = get_exercise(str(exercise_id or ""))
        if not ex:
            return {"ok": False, "code": "exercise_not_found"}
        lang = "sk"
        try:
            from Services.notifications import _get_user_language

            lang = _get_user_language(int(sug["user_id"]), ctx)
        except Exception:  # noqa: BLE001
            pass
        from Services.strength_catalog_store import exercise_name

        catalog_name = exercise_name(str(exercise_id), lang)

    now = datetime.now(timezone.utc).isoformat()
    patch: Dict[str, Any] = {
        "status": status,
        "exercise_id": exercise_id if status == "approved" else None,
        "reviewed_at": now if status != "new" else None,
        "admin_note": (message or "").strip()[:500] or None,
    }
    channel = "none"
    if notify and status != "new" and sug.get("user_id"):
        channel = _notify_author(
            int(sug["user_id"]), sug, approved=status == "approved",
            catalog_name=catalog_name, message=message, ctx=ctx,
        )
        if channel != "none":
            patch["notified_at"] = now
    saved = db_update_exercise_suggestion(suggestion_id, patch, ctx=ctx)
    if not saved:
        return {"ok": False, "code": "save_failed"}
    return {"ok": True, "item": saved, "notified": channel}
