# Services/trainer_links.py
"""
Živý tréner – párovanie tréner ↔ atlét (fáza 1).

Tok: atlét pošle trénerovi svoj 6-miestny kód → tréner ho zadá (pending)
→ atlét žiadosť prijme v Coach prefs (active) → AI prestane plánovať
(coach_mode = advisor). Ukončiť môže ktorákoľvek strana.

PREČO service role: vzťah sa týka dvoch userov (hľadanie podľa kódu, meno
druhej strany) – RLS jedného by druhého nevidel. Vlastníctvo user_id
overuje route (is_owner), service potom pracuje len s linkami, kde je
user_id tréner alebo atlét.
"""
from __future__ import annotations

import secrets
import threading
import time
from typing import Any, Dict, List, Optional

from DB.trainer_links import (
    db_find_open_link,
    db_get_active_link_for_athlete,
    db_get_share_code,
    db_get_trainer_link,
    db_get_user_id_by_share_code,
    db_get_users_brief,
    db_insert_trainer_link,
    db_list_open_links_for_user,
    db_reject_other_pending_for_athlete,
    db_set_share_code,
    db_update_link_status,
)
from DB.user_prefs import db_get_pref_single, db_upsert_pref_single
from Modules.Supabase.auth import AuthCtx, service_ctx
from Configs.config import TRAINER_ENABLED_FOR_ALL, TRAINER_USER_IDS

SHARE_CODE_LEN = 6
_CODE_MIN = 10 ** (SHARE_CODE_LEN - 1)
_CODE_SPAN = 9 * _CODE_MIN

# Zlé pokusy o kód: max 10 za hodinu na trénera. PREČO v pamäti a nie
# v user_prefs: tie si user vie prepísať cez /user-prefs a počítadlo by
# si vynuloval. Reštart servera počítadlo zmaže – pri 1M kódov a potvrdení
# atlétom to stačí.
_ATTEMPTS_MAX = 10
_ATTEMPTS_WINDOW_S = 3600
_attempts: Dict[int, List[float]] = {}
_attempts_lock = threading.Lock()

COACH_PREFS_KEY = "coach.prefs"

PUSH_TEXTS = {
    "sk": {
        "request_title": "Žiadosť od trénera 🤝",
        "request_body": "{name} ťa chce trénovať v SelfRace. Potvrď to v preferenciách trénera.",
        "accepted_title": "Nový zverenec 🎉",
        "accepted_body": "Spolupráca s {name} je potvrdená. Nájdeš ju v Nastaveniach → Moji zverenci.",
        "ended_title": "Spolupráca skončila",
        "ended_body": "Spolupráca s {name} bola ukončená.",
    },
    "en": {
        "request_title": "Coach request 🤝",
        "request_body": "{name} wants to coach you in SelfRace. Confirm it in your coaching preferences.",
        "accepted_title": "New athlete 🎉",
        "accepted_body": "Coaching with {name} is confirmed. Find it in Settings → My athletes.",
        "ended_title": "Coaching ended",
        "ended_body": "Coaching with {name} has ended.",
    },
}


def _ictx(caller: str) -> AuthCtx:
    return service_ctx(f"trainer_links.{caller}")


def service_trainer_enabled(user_id: int) -> bool:
    """Rozpracovaná funkcia – na prode len pre userov z TRAINER_USERS."""
    return TRAINER_ENABLED_FOR_ALL or int(user_id) in TRAINER_USER_IDS


def _display_name(row: Optional[Dict[str, Any]]) -> str:
    row = row or {}
    return str(row.get("display_name") or row.get("name") or row.get("mail_address") or "").strip()


def _new_code() -> str:
    return str(_CODE_MIN + secrets.randbelow(_CODE_SPAN))


def _normalize_code(raw: Any) -> Optional[str]:
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    return digits if len(digits) == SHARE_CODE_LEN else None


def _too_many_attempts(trainer_user_id: int) -> bool:
    now = time.time()
    with _attempts_lock:
        recent = [t for t in _attempts.get(trainer_user_id, []) if now - t < _ATTEMPTS_WINDOW_S]
        _attempts[trainer_user_id] = recent
        return len(recent) >= _ATTEMPTS_MAX


def _record_failed_attempt(trainer_user_id: int) -> None:
    with _attempts_lock:
        _attempts.setdefault(trainer_user_id, []).append(time.time())


def _push(user_id: int, title_key: str, body_key: str, *, name: str, url: str) -> None:
    """Notifikácia druhej strane. Zlyhanie nesmie zhodiť párovanie."""
    try:
        from Services.notifications import _get_user_language, service_send_push_notification

        ctx = _ictx("push")
        lang = _get_user_language(user_id, ctx)
        t = PUSH_TEXTS.get(lang) or PUSH_TEXTS["en"]
        # bez kategórie – priama odpoveď na akciu druhej strany, nie pravidelná notifikácia
        service_send_push_notification(
            user_id=user_id,
            title=t[title_key],
            body=t[body_key].format(name=name or "SelfRace"),
            url=url,
            ctx=ctx,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[TRAINER] push failed user={user_id} {title_key}: {repr(e)}")


# ---------------------- share code ----------------------

def _set_new_share_code(user_id: int) -> Optional[str]:
    ctx = _ictx("set_share_code")
    for _ in range(5):
        code = _new_code()
        try:
            db_set_share_code(user_id, code, ctx=ctx)
            return code
        except Exception as e:  # noqa: BLE001 – kolízia s unique indexom, skús iný
            print(f"[TRAINER] share code collision/fail user={user_id}: {repr(e)}")
    return None


def service_ensure_share_code(user_id: int) -> Optional[str]:
    code = db_get_share_code(user_id, ctx=_ictx("ensure_share_code"))
    return code or _set_new_share_code(user_id)


def service_regenerate_share_code(user_id: int) -> Dict[str, Any]:
    if not service_trainer_enabled(user_id):
        return {"ok": False, "code": "trainer_not_enabled"}
    code = _set_new_share_code(user_id)
    if not code:
        return {"ok": False, "code": "share_code_failed"}
    return {"ok": True, "share_code": code}


# ---------------------- prehľad ----------------------

def service_has_active_trainer(user_id: int) -> bool:
    return bool(db_get_active_link_for_athlete(user_id, ctx=_ictx("has_active_trainer")))


def service_get_trainer_overview(user_id: int) -> Dict[str, Any]:
    # FE podľa enabled skryje voľbu v Coach prefs aj kartu v Nastaveniach
    if not service_trainer_enabled(user_id):
        return {"enabled": False}

    ctx = _ictx("overview")
    links = db_list_open_links_for_user(user_id, ctx=ctx)

    other_ids = [
        l["athlete_user_id"] if l["trainer_user_id"] == user_id else l["trainer_user_id"]
        for l in links
    ]
    users = db_get_users_brief(other_ids, ctx=ctx)

    trainer: Optional[Dict[str, Any]] = None
    trainer_requests: List[Dict[str, Any]] = []
    athletes: List[Dict[str, Any]] = []
    sent_requests: List[Dict[str, Any]] = []

    for l in links:
        if l["athlete_user_id"] == user_id:
            item = {
                "link_id": l["id"],
                "name": _display_name(users.get(l["trainer_user_id"])),
                "created_at": l.get("created_at"),
                "since": l.get("responded_at"),
            }
            if l["status"] == "active":
                trainer = item
            else:
                trainer_requests.append(item)
        else:
            if l["status"] == "active":
                athletes.append(
                    {
                        "link_id": l["id"],
                        "athlete_user_id": l["athlete_user_id"],
                        "name": _display_name(users.get(l["athlete_user_id"])),
                        "since": l.get("responded_at"),
                    }
                )
            else:
                # Kým atlét nepotvrdí, tréner nevidí jeho meno – len kód, ktorý
                # zadal. Inak by sa hádaním kódov dali zisťovať mená userov.
                sent_requests.append(
                    {
                        "link_id": l["id"],
                        "request_code": l.get("request_code"),
                        "created_at": l.get("created_at"),
                    }
                )

    return {
        "enabled": True,
        "share_code": service_ensure_share_code(user_id),
        "trainer": trainer,
        # s aktívnym trénerom sa ďalšie žiadosti nedajú prijať – neukazujú sa
        "trainer_requests": [] if trainer else trainer_requests,
        "athletes": athletes,
        "sent_requests": sent_requests,
    }


# ---------------------- tréner: žiadosť cez kód ----------------------

def service_request_athlete_by_code(trainer_user_id: int, raw_code: Any) -> Dict[str, Any]:
    code = _normalize_code(raw_code)
    if not code:
        return {"ok": False, "code": "invalid_code"}

    if not service_trainer_enabled(trainer_user_id):
        return {"ok": False, "code": "trainer_not_enabled"}

    if _too_many_attempts(trainer_user_id):
        return {"ok": False, "code": "too_many_attempts"}

    ctx = _ictx("request_by_code")
    athlete_id = db_get_user_id_by_share_code(code, ctx=ctx)
    # atlét bez zapnutej funkcie by žiadosť nemal kde potvrdiť – navonok
    # rovnako ako neexistujúci kód
    if not athlete_id or not service_trainer_enabled(athlete_id):
        _record_failed_attempt(trainer_user_id)
        return {"ok": False, "code": "code_not_found"}

    if athlete_id == trainer_user_id:
        return {"ok": False, "code": "own_code"}

    existing = db_find_open_link(trainer_user_id, athlete_id, ctx=ctx)
    if existing:
        if existing.get("status") == "active":
            return {"ok": False, "code": "already_linked"}
        return {"ok": True, "link_id": existing["id"], "already_pending": True}

    if db_get_active_link_for_athlete(athlete_id, ctx=ctx):
        return {"ok": False, "code": "athlete_has_trainer"}

    try:
        link = db_insert_trainer_link(trainer_user_id, athlete_id, code, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        # najčastejšie súbeh dvoch rovnakých žiadostí (unique index pending)
        print(f"[TRAINER] insert link failed trainer={trainer_user_id} athlete={athlete_id}: {repr(e)}")
        return {"ok": False, "code": "trainer_request_failed"}

    trainer_name = _display_name(db_get_users_brief([trainer_user_id], ctx=ctx).get(trainer_user_id))
    _push(athlete_id, "request_title", "request_body", name=trainer_name, url="/coach/prefs")

    return {"ok": True, "link_id": link["id"]}


# ---------------------- atlét: prijatie / odmietnutie ----------------------

def _set_coach_mode_advisor(user_id: int) -> None:
    """
    S trénerom plán skladá človek, nie AI – režim sa prepne na advisor.
    Všetky generátory a autoadjust už advisor gate majú, takže netreba
    nový režim v každom z nich.
    """
    ctx = _ictx("set_coach_mode")
    row = db_get_pref_single(user_id, COACH_PREFS_KEY, ctx=ctx)
    value = (row or {}).get("value")
    prefs = dict(value) if isinstance(value, dict) else {}
    if prefs.get("coach_mode") == "advisor":
        return
    prefs["coach_mode"] = "advisor"
    db_upsert_pref_single(user_id, COACH_PREFS_KEY, prefs, ctx=ctx)


def service_respond_trainer_request(athlete_user_id: int, link_id: int, accept: bool) -> Dict[str, Any]:
    if not service_trainer_enabled(athlete_user_id):
        return {"ok": False, "code": "trainer_not_enabled"}
    ctx = _ictx("respond")
    link = db_get_trainer_link(link_id, ctx=ctx)
    if not link or link.get("athlete_user_id") != athlete_user_id or link.get("status") != "pending":
        return {"ok": False, "code": "link_not_found"}

    if not accept:
        db_update_link_status(link_id, from_status="pending", to_status="rejected", ctx=ctx)
        return {"ok": True, "status": "rejected"}

    if db_get_active_link_for_athlete(athlete_user_id, ctx=ctx):
        return {"ok": False, "code": "trainer_already_active"}

    try:
        updated = db_update_link_status(link_id, from_status="pending", to_status="active", ctx=ctx)
    except Exception as e:  # noqa: BLE001 – súbeh: unique index jedného aktívneho trénera
        print(f"[TRAINER] accept failed link={link_id}: {repr(e)}")
        return {"ok": False, "code": "trainer_already_active"}
    if not updated:
        return {"ok": False, "code": "link_not_found"}

    # Bez prepnutia režimu by AI ďalej plánovala popri trénerovi – pri
    # zlyhaní sa prijatie vráti späť (Supabase REST nemá transakciu).
    try:
        _set_coach_mode_advisor(athlete_user_id)
    except Exception as e:  # noqa: BLE001
        print(f"[TRAINER] coach_mode switch failed athlete={athlete_user_id}: {repr(e)}")
        try:
            db_update_link_status(link_id, from_status="active", to_status="pending", ctx=ctx)
        except Exception as e2:  # noqa: BLE001
            print(f"[TRAINER] accept rollback failed link={link_id}: {repr(e2)}")
        return {"ok": False, "code": "trainer_accept_failed"}

    try:
        db_reject_other_pending_for_athlete(athlete_user_id, link_id, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[TRAINER] reject other pending failed athlete={athlete_user_id}: {repr(e)}")

    athlete_name = _display_name(db_get_users_brief([athlete_user_id], ctx=ctx).get(athlete_user_id))
    _push(link["trainer_user_id"], "accepted_title", "accepted_body", name=athlete_name, url="/settings")

    return {"ok": True, "status": "active"}


# ---------------------- ukončenie (obe strany) ----------------------

def service_end_trainer_link(user_id: int, link_id: int) -> Dict[str, Any]:
    """
    Tréner aj atlét môžu ukončiť aktívnu spoluprácu alebo zrušiť čakajúcu
    žiadosť. Režim atléta ostáva advisor – plán od trénera beží ďalej a
    AI coach by nemal z čoho stavať (rovnako ako advisor -> coach).

    Zámerne bez kontroly TRAINER_USERS – odvolať súhlas musí ísť vždy.
    """
    ctx = _ictx("end")
    link = db_get_trainer_link(link_id, ctx=ctx)
    if not link or user_id not in (link.get("trainer_user_id"), link.get("athlete_user_id")):
        return {"ok": False, "code": "link_not_found"}

    status = link.get("status")
    is_trainer = link.get("trainer_user_id") == user_id

    if status == "pending":
        to_status = "canceled" if is_trainer else "rejected"
        db_update_link_status(link_id, from_status="pending", to_status=to_status, ctx=ctx)
        return {"ok": True, "status": to_status}

    if status != "active":
        return {"ok": False, "code": "link_not_found"}

    updated = db_update_link_status(
        link_id, from_status="active", to_status="ended", ended_by=user_id, ctx=ctx
    )
    if not updated:
        return {"ok": False, "code": "link_not_found"}

    other_id = link["athlete_user_id"] if is_trainer else link["trainer_user_id"]
    my_name = _display_name(db_get_users_brief([user_id], ctx=ctx).get(user_id))
    _push(
        other_id,
        "ended_title",
        "ended_body",
        name=my_name,
        url="/coach/prefs" if is_trainer else "/settings",
    )
    return {"ok": True, "status": "ended"}


# ---------------------- poistka pri ukladaní coach prefs ----------------------

def enforce_trainer_coach_mode(user_id: int, prefs: Any) -> Any:
    """
    S aktívnym trénerom nesmie coach.prefs prepnúť na AI coacha. PREČO
    prepísanie a nie chyba: FE ukladá celé prefs a pri chybe by user
    nevedel uložiť nič iné (napr. cieľ). Zlyhanie kontroly nič neblokuje.
    """
    # chýbajúci coach_mode = coach (default v service_get_coach_mode)
    if not isinstance(prefs, dict) or prefs.get("coach_mode") == "advisor":
        return prefs
    # bez zapnutej funkcie user trénera mať nemôže – ušetrí dotaz pri každom uložení
    if not service_trainer_enabled(user_id):
        return prefs
    try:
        if service_has_active_trainer(user_id):
            print(f"[TRAINER] coach_mode=coach blocked, active trainer user={user_id}")
            return {**prefs, "coach_mode": "advisor"}
    except Exception as e:  # noqa: BLE001
        print(f"[TRAINER] coach_mode guard failed user={user_id}: {repr(e)}")
    return prefs
