# Services/engagement.py
"""
Správy, ktoré udržia usera pri tréningu - beží raz denne (10:00).

PREČO: user, ktorý pár dní nič nevidí, appku zabudne. Tu sú momenty, keď
má zmysel ozvať sa s niečím konkrétnym:
- koniec uvítacieho týždňa (súhrn prvých 7 dní),
- prvý odtrénovaný týždeň plánu (koľko splnil),
- séria týždňov (2, 4, 8, 12... týždňov po sebe),
- návrat po pauze (6+ dní bez aktivity).

Max 1 takáto správa denne na usera - viac by bol spam. Čo sa už poslalo,
je v user_prefs pod kľúčom engagement.state (nie v coach.prefs - tie idú do AI).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from DB.activities_summary import db_get_activities_in_range_basic
from DB.coach_plan_daily import db_get_planned_range_rows
from DB.coach_plan_meta import db_get_active_plan_meta_for_user
from DB.user_prefs import db_get_pref_single, db_upsert_pref_single
from DB.users import db_list_users_for_cron
from Modules.Supabase.auth import AuthCtx

STATE_KEY = "engagement.state"
WELCOME_KEY = "onboarding.welcome"

COMEBACK_AFTER_DAYS = 6
# kto je preč dlhšie, toho už pushom nenaháňame
COMEBACK_MAX_DAYS = 30
STREAK_MILESTONES = (2, 4, 8, 12, 26, 52)

TEXTS: Dict[str, Dict[str, str]] = {
    "sk": {
        "welcome_title": "Tvoj prvý týždeň so SelfRace 🎉",
        "welcome_body": "{count}× tréning, spolu {time}. Pozri si, čo o tebe AI zistila - a poďme ďalej!",
        "plan_week_title": "Prvý týždeň plánu za tebou 💪",
        "plan_week_body": "Splnené {done} z {total} tréningov. {tail}",
        "plan_week_tail_good": "Výborný štart, takto ďalej!",
        "plan_week_tail_ok": "Nevadí, ak niečo vypadlo - plán sa ti prispôsobí.",
        "streak_title": "{weeks} týždne v rade! 🔥",
        "streak_title_many": "{weeks} týždňov v rade! 🔥",
        "streak_body": "Pravidelnosť je to, čo robí formu. Drž sériu aj tento týždeň.",
        "comeback_title": "Dlhšie sme ťa nevideli 👋",
        "comeback_body_plan": "Aj 20 minút ľahkého pohybu sa počíta. Pozri, čo máš dnes v pláne.",
        "comeback_body": "Aj 20 minút ľahkého pohybu sa počíta - AI ti tréning hneď vyhodnotí.",
    },
    "en": {
        "welcome_title": "Your first week with SelfRace 🎉",
        "welcome_body": "{count} workouts, {time} in total. See what the AI learned about you - and keep going!",
        "plan_week_title": "First plan week done 💪",
        "plan_week_body": "{done} of {total} workouts completed. {tail}",
        "plan_week_tail_good": "Great start, keep it up!",
        "plan_week_tail_ok": "No worries if something slipped - the plan adapts to you.",
        "streak_title": "{weeks} weeks in a row! 🔥",
        "streak_title_many": "{weeks} weeks in a row! 🔥",
        "streak_body": "Consistency is what builds fitness. Keep the streak going this week.",
        "comeback_title": "We haven't seen you in a while 👋",
        "comeback_body_plan": "Even 20 minutes of easy movement counts. See what's in your plan today.",
        "comeback_body": "Even 20 minutes of easy movement counts - the AI reviews it right away.",
    },
}


def _fmt_hours(seconds: int) -> str:
    m = max(0, int(seconds) // 60)
    h, rest = divmod(m, 60)
    if not h:
        return f"{rest} min"
    return f"{h} h" + (f" {rest} min" if rest else "")


def _parse_dt(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:  # noqa: BLE001
        return None


def _pref_value(user_id: int, key: str, *, ctx: AuthCtx) -> Dict[str, Any]:
    row = db_get_pref_single(user_id=user_id, key=key, ctx=ctx)
    val = (row or {}).get("value")
    return dict(val) if isinstance(val, dict) else {}


def _activities(user_id: int, start: datetime, end: datetime, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    return db_get_activities_in_range_basic(
        ctx=ctx, user_id=user_id, start_ts_iso=start.isoformat(), end_ts_iso=end.isoformat()
    ) or []


# ------------------------------------------------------------------
# Jednotlivé momenty - každý vráti (správa, zmena stavu) alebo None
# ------------------------------------------------------------------

Msg = Tuple[str, str, str, Dict[str, Any]]  # title, body, url, state_patch


def _welcome_summary(user_id: int, state: Dict[str, Any], t: Dict[str, str], *, ctx: AuthCtx) -> Optional[Msg]:
    if state.get("welcome_summary_sent"):
        return None
    started = _parse_dt(_pref_value(user_id, WELCOME_KEY, ctx=ctx).get("activities_started_at"))
    if started is None:
        return None
    age = datetime.now(timezone.utc) - started
    if age < timedelta(days=7):
        return None
    if age > timedelta(days=10):
        # zmeškané okno (napr. výpadok cronu) - neskorý súhrn nemá zmysel
        return ("", "", "", {"welcome_summary_sent": True})

    acts = _activities(user_id, started - timedelta(hours=1), started + timedelta(days=7), ctx=ctx)
    if not acts:
        return ("", "", "", {"welcome_summary_sent": True})
    total_s = sum(int(a.get("moving_time_s") or 0) for a in acts)
    body = t["welcome_body"].format(count=len(acts), time=_fmt_hours(total_s))
    return (t["welcome_title"], body, "/activities", {"welcome_summary_sent": True})


def _first_plan_week(user_id: int, state: Dict[str, Any], t: Dict[str, str], *, ctx: AuthCtx) -> Optional[Msg]:
    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta or not meta.get("id") or not meta.get("start_date"):
        return None
    meta_id = meta.get("id")
    if state.get("plan_week_sent_for") == meta_id:
        return None
    try:
        start = date.fromisoformat(str(meta["start_date"])[:10])
    except Exception:  # noqa: BLE001
        return None
    week_end = start + timedelta(days=6)
    today = date.today()
    if today <= week_end:
        return None
    if today > week_end + timedelta(days=3):
        return ("", "", "", {"plan_week_sent_for": meta_id})

    rows = db_get_planned_range_rows(
        user_id=user_id, plan_meta_id=meta_id,
        date_from=start.isoformat(), date_to=week_end.isoformat(), ctx=ctx,
    )
    trainings = [
        r for r in rows if str(r.get("sport") or "").lower() not in ("rest", "other", "")
    ]
    if not trainings:
        return ("", "", "", {"plan_week_sent_for": meta_id})
    done = len([r for r in trainings if r.get("status") == "done"])
    total = len(trainings)
    tail = t["plan_week_tail_good"] if done >= total * 0.7 else t["plan_week_tail_ok"]
    body = t["plan_week_body"].format(done=done, total=total, tail=tail)
    return (t["plan_week_title"], body, "/coach/compliance", {"plan_week_sent_for": meta_id})


def _streak(user_id: int, state: Dict[str, Any], t: Dict[str, str], *, ctx: AuthCtx) -> Optional[Msg]:
    from Services.coach_streak import service_get_streak

    current = int((service_get_streak(user_id, ctx=ctx) or {}).get("current_streak") or 0)
    celebrated = int(state.get("streak_celebrated") or 0)

    # séria sa prerušila - ďalšia môže byť znova oslávená
    if current < 2:
        return ("", "", "", {"streak_celebrated": 0}) if celebrated else None
    if current not in STREAK_MILESTONES or current == celebrated:
        return None
    title_key = "streak_title" if current < 5 else "streak_title_many"
    return (t[title_key].format(weeks=current), t["streak_body"], "/activities/streak",
            {"streak_celebrated": current})


def _comeback(user_id: int, state: Dict[str, Any], t: Dict[str, str], *, ctx: AuthCtx) -> Optional[Msg]:
    now = datetime.now(timezone.utc)
    acts = _activities(user_id, now - timedelta(days=COMEBACK_MAX_DAYS), now, ctx=ctx)
    if not acts:
        return None  # bez aktivít 30 dní - nenaháňame
    last_raw = acts[0].get("date")  # zoradené od najnovšej
    last = _parse_dt(last_raw)
    if last is None:
        return None
    if now - last < timedelta(days=COMEBACK_AFTER_DAYS):
        return None
    last_key = str(last_raw)[:10]
    if state.get("comeback_sent_for") == last_key:
        return None  # za túto pauzu už raz poslané

    from Services.notifications import _daily_plan_url

    has_plan = bool(db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx))
    body = t["comeback_body_plan"] if has_plan else t["comeback_body"]
    # coach aj advisor majú denný plán inde - URL podľa režimu
    url = _daily_plan_url(user_id, ctx) if has_plan else "/activities"
    return (t["comeback_title"], body, url, {"comeback_sent_for": last_key})


# poradie = priorita; pošle sa len prvá skutočná správa
_MOMENTS = (_welcome_summary, _first_plan_week, _streak, _comeback)


def service_run_engagement_for_user(user_id: int, *, ctx: AuthCtx) -> Optional[str]:
    """Vyhodnotí momenty pre jedného usera, pošle max 1 push. Vráti názov momentu."""
    from Services.notifications import (
        NOTIF_MOTIVATION,
        _get_user_language,
        notification_enabled,
        service_send_push_notification,
    )

    from Services.plan_pending import sent_reminder_today

    # max 1 push denne - v deň pripomienky nespusteného plánu nič ďalšie
    if sent_reminder_today(user_id, ctx=ctx):
        return None
    # motivácia vypnutá - momenty sa ani nevyhodnocujú (zbytočné DB čítania)
    if not notification_enabled(user_id, NOTIF_MOTIVATION, ctx=ctx):
        return None

    state = _pref_value(user_id, STATE_KEY, ctx=ctx)
    lang = _get_user_language(user_id, ctx)
    t = TEXTS.get(lang) or TEXTS["en"]

    patch: Dict[str, Any] = {}
    sent_name: Optional[str] = None
    for fn in _MOMENTS:
        try:
            res = fn(user_id, {**state, **patch}, t, ctx=ctx)
        except Exception as e:  # noqa: BLE001
            print(f"[ENGAGEMENT] {fn.__name__} user={user_id} failed: {repr(e)}")
            continue
        if not res:
            continue
        title, body, url, state_patch = res
        patch.update(state_patch)
        if title:
            service_send_push_notification(
                user_id=user_id, title=title, body=body, url=url, ctx=ctx, category=NOTIF_MOTIVATION
            )
            sent_name = fn.__name__
            break

    if patch:
        db_upsert_pref_single(user_id=user_id, key=STATE_KEY, value={**state, **patch}, ctx=ctx)
    return sent_name


def service_cron_engagement(ctx: AuthCtx) -> Dict[str, Any]:
    """Denný cron - prejde všetkých userov."""
    sent: Dict[str, int] = {}
    for u in db_list_users_for_cron(ctx=ctx):
        uid = u.get("id")
        if not uid:
            continue
        try:
            name = service_run_engagement_for_user(int(uid), ctx=ctx)
            if name:
                sent[name] = sent.get(name, 0) + 1
        except Exception as e:  # noqa: BLE001
            print(f"[ENGAGEMENT] user={uid} failed: {repr(e)}")
    return {"success": True, "sent": sent}
