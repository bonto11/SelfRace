# Services/plan_pending.py
"""
Pripomienka nespusteného plánu + jeho automatické zrušenie.

PREČO: user si plán vygeneruje, ale zabudne ho spustiť (status 'generated')
- potom mu nechodí ranná notifikácia, plán sa neupravuje a nemá uvítací
týždeň. Kontrola beží každú hodinu (8:00-21:00), aby pripomienka prišla
včas: kto plán spraví večer, dostane ju ešte v ten večer, kto ráno, tak
dopoludnia - nie až večer po tréningu, ktorý mal v pláne.

- Pripomienka max 1× za deň, najskôr hodinu po vygenerovaní (nech
  neotravuje, kým je user ešte v appke). Výnimka: posledná kontrola dňa
  (21:00) pošle aj mladší plán, inak by pripomienka prišla až zajtra.
- Plán, ktorého začiatok je starší ako AUTOCANCEL_AFTER_DAYS dní, sa zruší:
  weekly/daily riadky preč, meta 'canceled' s dôvodom 'autocancel'
  (dátumy v pláne sú pevné, prvé tréningy by už boli v minulosti).

Čo sa poslalo, je v user_prefs pod `engagement.plan_pending` - podľa toho
aj engagement v ten deň nepošle druhý push.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from DB.coach_plan_meta import db_get_active_plan_meta_for_user, db_list_all_generated_plan_metas
from DB.user_prefs import db_get_pref_single, db_upsert_pref_single
from Modules.Supabase.auth import AuthCtx

REMIND_FIRST_HOUR = 8
REMIND_LAST_HOUR = 21
MIN_AGE = timedelta(hours=1)
AUTOCANCEL_AFTER_DAYS = 3
STATE_KEY = "engagement.plan_pending"
PLAN_URL = "/coach/prefs"

TZ = ZoneInfo("Europe/Bratislava")

_WEEKDAYS = {
    # "v pondelok", "vo štvrtok" - predložka podľa dňa
    "sk": ["v pondelok", "v utorok", "v stredu", "vo štvrtok", "v piatok", "v sobotu", "v nedeľu"],
    "en": ["on Monday", "on Tuesday", "on Wednesday", "on Thursday", "on Friday", "on Saturday", "on Sunday"],
}

TEXTS = {
    "sk": {
        "remind_title": "Tvoj plán čaká na spustenie",
        "remind_body": "Plán {when}. Spusti ho, nech ti chodia tréningy na každý deň.",
        "today": "začína dnes",
        "tomorrow": "začína zajtra",
        "future": "začína {weekday} {d}. {m}.",
        "yesterday": "začal včera",
        "past": "začal pred {n} dňami",
        "cancel_title": "Plán sme zrušili",
        "cancel_body": "Nebol spustený a jeho začiatok je už {n} dní za nami. Vygeneruj si nový, keď budeš chcieť začať.",
    },
    "en": {
        "remind_title": "Your plan is waiting to start",
        "remind_body": "Your plan {when}. Start it to get your daily workouts.",
        "today": "starts today",
        "tomorrow": "starts tomorrow",
        "future": "starts {weekday} {mon} {d}",
        "yesterday": "started yesterday",
        "past": "started {n} days ago",
        "cancel_title": "We canceled your plan",
        "cancel_body": "It wasn't started and its start date was {n} days ago. Generate a new one whenever you're ready.",
    },
}

_EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _parse_dt(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:  # noqa: BLE001
        return None


def plan_start_phrase(start: date, today: date, lang: str) -> str:
    """Kedy plán začína/začal - konkrétne, nie surový dátum ani 'today-2'."""
    t = TEXTS.get(lang) or TEXTS["en"]
    delta = (start - today).days
    if delta == 0:
        return t["today"]
    if delta == 1:
        return t["tomorrow"]
    if delta > 1:
        return t["future"].format(
            weekday=(_WEEKDAYS.get(lang) or _WEEKDAYS["en"])[start.weekday()],
            d=start.day,
            m=start.month,
            mon=_EN_MONTHS[start.month - 1],
        )
    if delta == -1:
        return t["yesterday"]
    return t["past"].format(n=-delta)


def sent_reminder_today(user_id: int, *, ctx: AuthCtx) -> bool:
    """Pre engagement - v deň pripomienky plánu ďalší push neposielame."""
    row = db_get_pref_single(user_id=user_id, key=STATE_KEY, ctx=ctx)
    state = (row or {}).get("value") or {}
    return state.get("last_sent_date") == datetime.now(TZ).date().isoformat()


def _process_user(meta: Dict[str, Any], now: datetime, *, ctx: AuthCtx) -> Optional[str]:
    from Services.coach_plan_active import service_cancel_generated_plan
    from Services.notifications import _get_user_language, service_send_push_notification
    from Services.coach_mode import service_get_coach_mode

    user_id = int(meta["user_id"])
    meta_id = int(meta["id"])
    today = now.date()

    try:
        start = date.fromisoformat(str(meta.get("start_date"))[:10])
    except Exception:  # noqa: BLE001
        return None

    # user s bežiacim plánom alebo v advisor režime - draft ho netrápi
    if db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx):
        return None
    if service_get_coach_mode(user_id, ctx=ctx) == "advisor":
        return None

    lang = _get_user_language(user_id, ctx)
    t = TEXTS.get(lang) or TEXTS["en"]
    row = db_get_pref_single(user_id=user_id, key=STATE_KEY, ctx=ctx)
    state: Dict[str, Any] = dict((row or {}).get("value") or {})

    days_late = (today - start).days
    if days_late > AUTOCANCEL_AFTER_DAYS:
        service_cancel_generated_plan(user_id=user_id, meta_id=meta_id, reason="autocancel", ctx=ctx)
        service_send_push_notification(
            user_id=user_id,
            title=t["cancel_title"],
            body=t["cancel_body"].format(n=days_late),
            url=PLAN_URL,
            ctx=ctx,
        )
        state.update({"autocanceled_meta_id": meta_id, "last_sent_date": today.isoformat()})
        db_upsert_pref_single(user_id=user_id, key=STATE_KEY, value=state, ctx=ctx)
        return "autocancel"

    if state.get("last_sent_date") == today.isoformat():
        return None

    created = _parse_dt(meta.get("created_at"))
    is_last_check = now.hour >= REMIND_LAST_HOUR
    if created and now - created < MIN_AGE and not is_last_check:
        return None

    service_send_push_notification(
        user_id=user_id,
        title=t["remind_title"],
        body=t["remind_body"].format(when=plan_start_phrase(start, today, lang)),
        url=PLAN_URL,
        ctx=ctx,
    )
    state.update({
        "meta_id": meta_id,
        "last_sent_date": today.isoformat(),
        "count": int(state.get("count") or 0) + 1 if state.get("meta_id") == meta_id else 1,
    })
    db_upsert_pref_single(user_id=user_id, key=STATE_KEY, value=state, ctx=ctx)
    return "reminder"


def service_cron_plan_pending(*, ctx: AuthCtx, force: bool = False) -> Dict[str, Any]:
    """Hodinová kontrola nespustených plánov. force = ručné spustenie mimo 8-21."""
    now = datetime.now(TZ)
    if not force and not (REMIND_FIRST_HOUR <= now.hour <= REMIND_LAST_HOUR):
        return {"skipped": "quiet_hours"}

    # na usera len najnovší draft (zoradené od najnovšieho)
    latest: Dict[int, Dict[str, Any]] = {}
    for m in db_list_all_generated_plan_metas(ctx=ctx):
        uid = m.get("user_id")
        if uid is not None and m.get("id") is not None and int(uid) not in latest:
            latest[int(uid)] = m

    out = {"checked": len(latest), "reminder": 0, "autocancel": 0}
    for meta in latest.values():
        try:
            res = _process_user(meta, now, ctx=ctx)
            if res:
                out[res] += 1
        except Exception as e:  # noqa: BLE001
            print(f"[PLAN-PENDING] user={meta.get('user_id')} failed: {repr(e)}")
    return out
