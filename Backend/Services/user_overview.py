# Services/user_overview.py
"""
Admin prehľad userov – čo si kto v appke nastavil, čo robí a kedy naposledy.

Zdroje: Supabase Auth (registrácia, posledné prihlásenie, Google/e-mail),
users_preferences (zameranie, coach prefs, šablóny, app.seen), plán,
zápisy (sila, recovery, zdravie), vlastné AI požiadavky, Strava, push.

„Posledný vlastný zásah“ = najnovšia vec, ktorú urobil user sám: uložené
nastavenia (ui.widgets, coach.prefs, šablóny, user.settings), silový zápis,
zdravotný záznam, ručné recovery (nie zo intervals.icu) a vlastná AI požiadavka.
PREČO nie plán ani aktivity: plán mení aj AI (autoadjust) a aktivity
posiela Strava aj userovi, ktorý appku neotvára.

Otvorenie appky a PWA na ploche vidno až z app.seen (zapisuje FE od
nasadenia sledovania), starší useri ho nemajú.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

from DB.user_overview import (
    db_overview_activities,
    db_overview_ai_usage,
    db_overview_health,
    db_overview_intervals,
    db_overview_plan_daily,
    db_overview_plan_meta,
    db_overview_prefs,
    db_overview_profile_static,
    db_overview_push,
    db_overview_recovery,
    db_overview_strava,
    db_overview_strength,
    db_overview_subscriptions,
    db_overview_users,
)
from Modules.Supabase.auth import AuthCtx

# kľúče, ktoré mení user sám (iné, napr. onboarding.welcome / engagement.*, píše systém)
USER_PREF_KEYS = ("ui.widgets", "coach.prefs", "advisor.session_templates", "user.settings")
APP_SEEN_KEY = "app.seen"
# záznam pripomienkových e-mailov z admin panelu (Services/admin_outreach.py)
OUTREACH_KEY = "admin.outreach"
WINDOW_DAYS = 30


def _dt(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        s = str(v).replace("Z", "+00:00")
        if len(s) == 10:  # čistý dátum
            s += "T00:00:00+00:00"
        d = datetime.fromisoformat(s)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:  # noqa: BLE001
        return None


def _latest(values: Iterable[Optional[datetime]]) -> Optional[datetime]:
    vals = [v for v in values if v]
    return max(vals) if vals else None


def _iso(d: Optional[datetime]) -> Optional[str]:
    return d.isoformat() if d else None


def _push_platform(endpoint: str) -> str:
    """Podľa push služby: Apple = Safari/iPhone (na iPhone len appka z plochy), FCM = Chrome/Android."""
    host = urlparse(str(endpoint or "")).hostname or ""
    if "apple.com" in host:
        return "apple"
    if "googleapis.com" in host:
        return "chrome"
    if "mozilla" in host:
        return "firefox"
    if "windows" in host or "microsoft" in host:
        return "edge"
    return "other"


def _auth_users() -> Dict[str, Dict[str, Any]]:
    """auth_uid -> registrácia, posledné prihlásenie, spôsob prihlásenia."""
    from Services.supabase_auth_admin import supabase

    out: Dict[str, Dict[str, Any]] = {}
    page = 1
    try:
        while True:
            res = supabase.auth.admin.list_users(page=page, per_page=1000)  # type: ignore[attr-defined]
            users = res if isinstance(res, list) else getattr(res, "users", None) or []
            for u in users:
                uid = getattr(u, "id", None)
                if not uid:
                    continue
                meta = getattr(u, "app_metadata", None) or {}
                providers = meta.get("providers") or ([meta["provider"]] if meta.get("provider") else [])
                out[str(uid)] = {
                    "created_at": _dt(getattr(u, "created_at", None)),
                    "last_sign_in_at": _dt(getattr(u, "last_sign_in_at", None)),
                    "providers": [str(p) for p in providers],
                }
            if len(users) < 1000:
                return out
            page += 1
    except Exception as e:  # noqa: BLE001
        print(f"[USER-OVERVIEW] auth list_users failed: {repr(e)}")
        return out


def _by_user(rows: List[Dict[str, Any]]) -> Dict[int, List[Dict[str, Any]]]:
    out: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        uid = r.get("user_id")
        if uid is not None:
            out[int(uid)].append(r)
    return out


def _coach_prefs_info(value: Any) -> Dict[str, Any]:
    v = value if isinstance(value, dict) else {}
    races = (((v.get("targets") or {}).get("run") or {}).get("races")) or []
    sports = [s for s in [v.get("main_sport"), *(v.get("add_on_sports") or [])] if isinstance(s, str) and s]
    return {
        "mode": v.get("coach_mode") or "coach",
        "goal": v.get("goal_kind") or None,
        "sports": sports,
        "races": len(races) if isinstance(races, list) else 0,
    }


def _widgets_info(value: Any) -> Dict[str, Any]:
    v = value if isinstance(value, dict) else {}
    overrides = v.get("overrides") if isinstance(v.get("overrides"), dict) else {}
    home = v.get("home") if isinstance(v.get("home"), list) else None
    return {
        "profile": v.get("profile") or None,
        "overrides": len(overrides),
        "home_custom": home is not None,
    }


def _status(configured: bool, recent: Optional[datetime], now: datetime) -> str:
    """registered = len sa zaregistroval; active ≤ 7 dní; quiet ≤ 30 dní; inactive."""
    if not configured:
        return "registered"
    if recent and now - recent <= timedelta(days=7):
        return "active"
    if recent and now - recent <= timedelta(days=30):
        return "quiet"
    return "inactive"


def service_user_overview(*, ctx: AuthCtx) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    today = now.date()
    since = (today - timedelta(days=WINDOW_DAYS)).isoformat()
    since_long = (today - timedelta(days=180)).isoformat()

    auth = _auth_users()
    users = db_overview_users(ctx=ctx)
    # user_id -> Strava athlete_id (admin ho potrebuje pri podpore)
    strava = {int(r["user_id"]): r.get("athlete_id") for r in db_overview_strava(ctx=ctx) if r.get("user_id") is not None}
    intervals = {int(r["user_id"]) for r in db_overview_intervals(ctx=ctx) if r.get("user_id") is not None}
    tiers = {int(r["user_id"]): r.get("tier_code") for r in db_overview_subscriptions(ctx=ctx) if r.get("user_id") is not None}
    push = _by_user(db_overview_push(ctx=ctx))
    prefs = _by_user(db_overview_prefs([*USER_PREF_KEYS, APP_SEEN_KEY, OUTREACH_KEY], ctx=ctx))
    meta = _by_user(db_overview_plan_meta(ctx=ctx))
    daily = _by_user(db_overview_plan_daily(since, ctx=ctx))
    acts = _by_user(db_overview_activities(since_long, ctx=ctx))
    strength = _by_user(db_overview_strength(ctx=ctx))
    recovery = _by_user(db_overview_recovery(since_long, ctx=ctx))
    health = _by_user(db_overview_health(ctx=ctx))
    ai = _by_user(db_overview_ai_usage(since_long, ctx=ctx))
    profile = {int(r["user_id"]): r for r in db_overview_profile_static(ctx=ctx) if r.get("user_id") is not None}

    window_start = now - timedelta(days=WINDOW_DAYS)
    rows: List[Dict[str, Any]] = []

    for u in users:
        uid = int(u["id"])
        a = auth.get(str(u.get("auth_uid") or ""), {})
        p = {r.get("key"): r for r in prefs.get(uid, [])}

        widgets = _widgets_info((p.get("ui.widgets") or {}).get("value"))
        coach = _coach_prefs_info((p.get("coach.prefs") or {}).get("value")) if "coach.prefs" in p else None
        templates_val = (p.get("advisor.session_templates") or {}).get("value")
        templates = len(templates_val) if isinstance(templates_val, list) else 0
        seen = (p.get(APP_SEEN_KEY) or {}).get("value") or {}
        seen = seen if isinstance(seen, dict) else {}

        pref_updates = {k: _dt((p.get(k) or {}).get("updated_at")) for k in USER_PREF_KEYS if k in p}
        settings = (p.get("user.settings") or {}).get("value")
        lang = settings.get("language") if isinstance(settings, dict) else None
        outreach = (p.get(OUTREACH_KEY) or {}).get("value")
        outreach_sent = outreach.get("sent") if isinstance(outreach, dict) else None

        # plán: aktívny / vygenerovaný (nespustený)
        metas = sorted(meta.get(uid, []), key=lambda r: str(r.get("created_at") or ""), reverse=True)
        live = next((m for m in metas if m.get("status") in ("active", "generated")), None)
        day_rows = daily.get(uid, [])
        upcoming = [r for r in day_rows if str(r.get("plan_date") or "") >= today.isoformat()]
        week_end = (today + timedelta(days=7)).isoformat()
        plan_last_change = _latest(_dt(r.get("updated_at")) for r in day_rows)

        act_dates = sorted((str(r.get("date") or "")[:10] for r in acts.get(uid, [])), reverse=True)
        st_rows = strength.get(uid, [])
        st_last = _latest(_dt(r.get("created_at")) for r in st_rows)
        rec_rows = recovery.get(uid, [])
        rec_last = _latest(_dt(r.get("date")) for r in rec_rows)
        hl_rows = health.get(uid, [])
        hl_last = _latest(_dt(r.get("created_at")) for r in hl_rows)
        own_ai = [r for r in ai.get(uid, []) if r.get("source") == "user"]
        own_ai_last = _latest(_dt(r.get("created_at")) for r in own_ai)
        welcome_ai = sum(1 for r in ai.get(uid, []) if r.get("billed_via") == "welcome_free")

        last_seen = _dt(seen.get("last_seen_at"))
        last_action = _latest([
            *pref_updates.values(),
            st_last,
            hl_last,
            own_ai_last,
            # recovery zo intervals.icu chodí samo – za zásah ho rátame len bez neho
            None if uid in intervals else rec_last,
        ])

        prof = profile.get(uid) or {}
        configured = bool(
            widgets["profile"] or coach or uid in strava or st_rows or own_ai or templates or live
        )
        recent = _latest([last_action, last_seen, a.get("last_sign_in_at")])

        rows.append({
            "id": uid,
            "email": u.get("mail_address") or "",
            "name": u.get("display_name") or "",
            "registered_at": _iso(a.get("created_at")),
            "last_sign_in_at": _iso(a.get("last_sign_in_at")),
            "providers": a.get("providers") or [],
            "status": _status(configured, recent, now),
            "tier": tiers.get(uid) or "free",
            "strava": uid in strava,
            "strava_id": strava.get(uid),
            "intervals": uid in intervals,
            "push": sorted({_push_platform(r.get("endpoint") or "") for r in push.get(uid, [])}),
            "app": {
                "last_seen_at": seen.get("last_seen_at"),
                "last_standalone_at": seen.get("last_standalone_at"),
                "platform": seen.get("platform"),
                "platforms": seen.get("platforms") if isinstance(seen.get("platforms"), dict) else {},
            },
            "profile": widgets["profile"],
            "widgets_custom": widgets["overrides"] > 0 or widgets["home_custom"],
            "coach": coach,
            "templates": templates,
            "bio_filled": bool(prof.get("sex") or prof.get("birth_date") or prof.get("height_cm")),
            "prefs_updated": {k: _iso(v) for k, v in pref_updates.items()},
            "plan": {
                "status": (live or {}).get("status"),
                "start_date": (live or {}).get("start_date"),
                "end_date": (live or {}).get("end_date"),
                "next7": sum(1 for r in upcoming if str(r.get("plan_date")) < week_end),
                "done30": sum(1 for r in day_rows if r.get("status") == "done"),
                "last_change_at": _iso(plan_last_change),
                "plans_total": len(metas),
            },
            "activities30": sum(1 for d in act_dates if d >= since),
            "last_activity_date": act_dates[0] if act_dates else None,
            "strength_total": len(st_rows),
            "strength30": sum(1 for r in st_rows if (_dt(r.get("created_at")) or now) >= window_start),
            "strength_last_at": _iso(st_last),
            "recovery30": sum(1 for r in rec_rows if str(r.get("date") or "")[:10] >= since),
            "recovery_last": _iso(rec_last),
            "health_total": len(hl_rows),
            "health_last_at": _iso(hl_last),
            "ai_own30": sum(1 for r in own_ai if (_dt(r.get("created_at")) or now) >= window_start),
            "ai_own_last_at": _iso(own_ai_last),
            "ai_welcome": welcome_ai,
            "last_action_at": _iso(last_action),
            "lang": lang if lang in ("sk", "cs", "en") else None,
            "outreach": [o for o in (outreach_sent or []) if isinstance(o, dict)],
        })

    rows.sort(key=lambda r: r.get("registered_at") or "", reverse=True)

    def count(pred) -> int:
        return sum(1 for r in rows if pred(r))

    week_ago = (now - timedelta(days=7)).isoformat()
    summary = {
        "users": len(rows),
        "new7": count(lambda r: (r["registered_at"] or "") >= week_ago),
        "only_registered": count(lambda r: r["status"] == "registered"),
        "active7": count(lambda r: r["status"] == "active"),
        "with_profile": count(lambda r: bool(r["profile"])),
        "with_plan": count(lambda r: r["plan"]["status"] in ("active", "generated")),
        "advisor": count(lambda r: (r["coach"] or {}).get("mode") == "advisor"),
        "strava": count(lambda r: r["strava"]),
        "pwa": count(lambda r: bool(r["app"]["last_standalone_at"])),
        "push": count(lambda r: bool(r["push"])),
        "paid": count(lambda r: (r["tier"] or "free") != "free"),
    }
    # predplatné podľa tieru (prevzaté z bývalej diagnostiky)
    summary_tiers: Dict[str, int] = {}
    for r in rows:
        t = r["tier"] or "free"
        if t != "free":
            summary_tiers[t] = summary_tiers.get(t, 0) + 1
    return {"summary": summary, "tiers": summary_tiers, "users": rows, "window_days": WINDOW_DAYS, "generated_at": now.isoformat()}
