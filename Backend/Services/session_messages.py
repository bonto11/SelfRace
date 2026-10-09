# Services/session_messages.py
"""
Živý tréner – vlákna (správy) k tréningom medzi trénerom a zverencom.

Vlákno = jeden tréning zverenca: naplánovaná session (plan_id) alebo
aktivita mimo plánu (activity_id). Píšu len dvaja: atlét a jeho AKTÍVNY
tréner. Atlét číta aj staré vlákna (aj po ukončení spolupráce), tréner len
správy zo svojej spolupráce (link_id).

PREČO service role a nie RLS: dvojstranný vzťah, ktorý sa mení (ukončenie
spolupráce) – overenie je na jednom mieste (_resolve_role) a tabuľka je
pre klientov úplne zavretá.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from DB.activities_summary import db_get_activity_summary_one
from DB.coach_plan_daily import db_get_daily_session_by_id_full
from DB.session_messages import (
    db_insert_message,
    db_list_thread_messages,
    db_list_unread_for_reader,
    db_mark_thread_read,
)
from DB.trainer_links import db_get_active_link_for_athlete
from Modules.Supabase.auth import AuthCtx, service_ctx
from Modules.Supabase.ownership import caller_user_id
from Services.trainer_links import (
    _athlete_name,
    _athlete_url,
    _in_background,
    _push,
    service_trainer_enabled,
)

MAX_BODY_LEN = 2000
PREVIEW_LEN = 120


def _ictx(caller: str) -> AuthCtx:
    return service_ctx(f"session_messages.{caller}")


def _resolve_role(
    ctx: AuthCtx, athlete_user_id: int
) -> Tuple[Optional[str], Optional[int], Optional[Dict[str, Any]]]:
    """
    (rola, caller_id, aktívny link). rola: "athlete" | "trainer" | None.
    Atlét má rolu aj bez aktívneho linku (číta staré vlákna), tréner len
    s aktívnym linkom.
    """
    if not service_trainer_enabled(athlete_user_id):
        return None, None, None
    caller = caller_user_id(ctx)
    if not caller:
        return None, None, None
    link = db_get_active_link_for_athlete(athlete_user_id, ctx=_ictx("resolve_role"))
    if caller == athlete_user_id:
        return "athlete", caller, link
    if link and int(link["trainer_user_id"]) == caller:
        return "trainer", caller, link
    return None, caller, None


def _target(plan_id: Any, activity_id: Any) -> Tuple[Optional[int], Optional[int]]:
    """Presne jeden cieľ vlákna; plán má prednosť (spárovaná aktivita patrí k plánu)."""
    try:
        if plan_id is not None and int(plan_id) > 0:
            return int(plan_id), None
        if activity_id is not None and int(activity_id) > 0:
            return None, int(activity_id)
    except (TypeError, ValueError):
        pass
    return None, None


def _target_title(athlete_user_id: int, plan_id: Optional[int], activity_id: Optional[int]) -> Optional[str]:
    """Názov tréningu zverenca, alebo None ak tréning nepatrí atlétovi."""
    ctx = _ictx("target_title")
    if plan_id is not None:
        row = db_get_daily_session_by_id_full(athlete_user_id, plan_id, ctx=ctx)
        return str(row.get("title") or "").strip() if row else None
    row = db_get_activity_summary_one(ctx, int(activity_id))  # type: ignore[arg-type]
    if not row or int(row.get("user_id") or 0) != int(athlete_user_id):
        return None
    return str(row.get("name") or "").strip()


def service_get_thread(
    ctx: AuthCtx, athlete_user_id: int, *, plan_id: Any, activity_id: Any
) -> Dict[str, Any]:
    """Správy vlákna pre volajúceho + označenie prečítaných."""
    role, caller, link = _resolve_role(ctx, athlete_user_id)
    pid, aid = _target(plan_id, activity_id)
    if not role or not caller or (pid is None and aid is None):
        return {"enabled": False}

    # tréner vidí len správy zo svojej spolupráce
    link_filter = int(link["id"]) if role == "trainer" and link else None
    sctx = _ictx("get_thread")
    rows = db_list_thread_messages(
        athlete_user_id, plan_id=pid, activity_id=aid, link_id=link_filter, ctx=sctx
    )

    # atlét bez trénera a bez histórie vlákna = nie je čo ukázať
    if role == "athlete" and not link and not rows:
        return {"enabled": False}

    if any(r.get("author_user_id") != caller and not r.get("read_at") for r in rows):
        try:
            db_mark_thread_read(
                athlete_user_id, plan_id=pid, activity_id=aid,
                reader_user_id=caller, link_id=link_filter, ctx=sctx,
            )
        except Exception as e:  # noqa: BLE001 – neprečítaná bodka nesmie zhodiť vlákno
            print(f"[THREAD] mark read failed athlete={athlete_user_id}: {repr(e)}")

    messages = [
        {
            "id": r.get("id"),
            "body": r.get("body"),
            "created_at": r.get("created_at"),
            "mine": r.get("author_user_id") == caller,
            "author_role": "athlete" if r.get("author_user_id") == athlete_user_id else "trainer",
        }
        for r in rows
    ]
    return {"enabled": True, "role": role, "can_post": bool(link), "messages": messages}


def _notify_new_message(
    athlete_user_id: int, author_role: str, link: Dict[str, Any], title: str, body: str
) -> None:
    preview = body if len(body) <= PREVIEW_LEN else body[: PREVIEW_LEN - 1].rstrip() + "…"
    vars = {"title": title or "–", "preview": preview}
    from Services.notifications import NOTIF_ATHLETES, NOTIF_TRAINING

    if author_role == "trainer":
        _push(
            athlete_user_id, "msg_from_trainer_title", "msg_body",
            name="", url="/coach/advisor/daily", category=NOTIF_TRAINING, vars=vars,
        )
    else:
        _push(
            int(link["trainer_user_id"]), "msg_from_athlete_title", "msg_body",
            name=_athlete_name(athlete_user_id),
            url=_athlete_url(athlete_user_id, "/coach/advisor/daily"),
            category=NOTIF_ATHLETES, vars=vars,
        )


def service_post_message(
    ctx: AuthCtx, athlete_user_id: int, *, plan_id: Any, activity_id: Any, body: Any
) -> Dict[str, Any]:
    role, caller, link = _resolve_role(ctx, athlete_user_id)
    if not role or not caller:
        return {"ok": False, "code": "thread_forbidden"}
    if not link:
        return {"ok": False, "code": "thread_no_trainer"}

    pid, aid = _target(plan_id, activity_id)
    if pid is None and aid is None:
        return {"ok": False, "code": "thread_invalid_target"}

    text = str(body or "").strip()
    if not text:
        return {"ok": False, "code": "thread_empty"}
    text = text[:MAX_BODY_LEN]

    # tréning musí patriť zverencovi – inak by sa dalo písať k cudziemu id
    title = _target_title(athlete_user_id, pid, aid)
    if title is None:
        return {"ok": False, "code": "thread_invalid_target"}

    try:
        row = db_insert_message(
            {
                "athlete_user_id": int(athlete_user_id),
                "link_id": int(link["id"]),
                "daily_plan_id": pid,
                "activity_id": aid,
                "author_user_id": int(caller),
                "body": text,
            },
            ctx=_ictx("post"),
        )
    except Exception as e:  # noqa: BLE001
        print(f"[THREAD] insert failed athlete={athlete_user_id}: {repr(e)}")
        return {"ok": False, "code": "thread_send_failed"}
    if not row:
        return {"ok": False, "code": "thread_send_failed"}

    _in_background(_notify_new_message, int(athlete_user_id), role, link, title, text)

    return {
        "ok": True,
        "message": {
            "id": row.get("id"),
            "body": row.get("body"),
            "created_at": row.get("created_at"),
            "mine": True,
            "author_role": role,
        },
    }


def service_list_unread(ctx: AuthCtx, athlete_user_id: int) -> Dict[str, Any]:
    """Vlákna s neprečítanými správami pre volajúceho (bodky na kartách tréningov)."""
    role, caller, link = _resolve_role(ctx, athlete_user_id)
    if not role or not caller:
        return {"enabled": False, "threads": []}
    link_filter = int(link["id"]) if role == "trainer" and link else None
    rows = db_list_unread_for_reader(
        athlete_user_id, reader_user_id=caller, link_id=link_filter, ctx=_ictx("unread")
    )
    counts: Dict[Tuple[Optional[int], Optional[int]], int] = {}
    for r in rows:
        key = (r.get("daily_plan_id"), r.get("activity_id"))
        counts[key] = counts.get(key, 0) + 1
    threads: List[Dict[str, Any]] = [
        {"plan_id": k[0], "activity_id": k[1], "count": c} for k, c in counts.items()
    ]
    return {"enabled": True, "threads": threads}
