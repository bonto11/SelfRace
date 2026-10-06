# Services/welcome_week.py
"""
Uvítací týždeň - prvé dni dostane user AI hodnotenie každej novej aktivity
automaticky a zadarmo (nezapočíta sa do mesačného limitu).

PREČO: prvý týždeň rozhoduje, či user v appke ostane. Hodnotenie hneď po
tréningu je najrýchlejší "wow" moment, ale user ho bez návodu nenájde.

Tri okná (stačí jedno), všetky uložené v user_prefs pod `onboarding.welcome`
(nie v coach.prefs - tie idú do AI kontextu):
- prvý týždeň aktivít: 7 dní od prvej novej aktivity po pripojení Stravy
  (`activities_started_at`, len nový účet; starý dostane `not_eligible`),
- prvý týždeň plánu: 7 dní od začiatku aktívneho plánu (`plan_window`),
- ručne od admina (`manual_window`) - napr. pre starší účet, ktorý začína.

Okno sa vyhodnotí raz (pri aktivácii plánu, prvej aktivite alebo v admin
paneli) a zapíše do DB; ďalej sa už len číta zapísaná hodnota.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional

from DB.user_prefs import db_get_pref_single, db_upsert_pref_single
from DB.coach_plan_meta import db_get_active_plan_meta_for_user
from DB.activities_enrichment import db_get_review_thread
from DB.users import db_get_auth_uid
from Modules.Supabase.auth import AuthCtx

WELCOME_DAYS = 7
# Okno aktivít len pre nové účty - existujúci useri by ho inak dostali pri
# prvej aktivite po nasadení (nemajú zapísaný začiatok).
NEW_ACCOUNT_MAX_AGE_DAYS = 14
WELCOME_PREF_KEY = "onboarding.welcome"

# Zdroj automatického hodnotenia v uvítacom týždni - billing ho nezapočíta
# do limitu (viď DB.ai_billing.db_get_monthly_usage_tokens).
WELCOME_REVIEW_SOURCE = "welcome"
WELCOME_BILLED_VIA = "welcome_free"


def _parse_dt(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:  # noqa: BLE001
        return None


def _is_new_account(user_id: int, *, ctx: AuthCtx) -> Optional[bool]:
    """None = nepodarilo sa zistiť (vtedy sa nič nezapisuje, skúsi sa nabudúce)."""
    from Services.supabase_auth_admin import admin_get_auth_user_created_at

    uid = db_get_auth_uid(user_id, ctx=ctx)
    created = _parse_dt(admin_get_auth_user_created_at(uid or ""))
    if created is None:
        return None
    return datetime.now(timezone.utc) - created < timedelta(days=NEW_ACCOUNT_MAX_AGE_DAYS)


def _activities_window_open(user_id: int, *, ctx: AuthCtx) -> bool:
    """Prvý týždeň aktivít. Pri prvej aktivite okno otvorí (zapíše začiatok)."""
    now = datetime.now(timezone.utc)
    row = db_get_pref_single(user_id=user_id, key=WELCOME_PREF_KEY, ctx=ctx)
    value: Dict[str, Any] = dict((row or {}).get("value") or {})
    started = _parse_dt(value.get("activities_started_at"))

    if value.get("not_eligible"):
        return False

    if started is None:
        is_new = _is_new_account(user_id, ctx=ctx)
        if is_new is None:
            return False
        if not is_new:
            # zapamätať, aby sa Supabase Auth nevolal pri každej aktivite
            value["not_eligible"] = True
            db_upsert_pref_single(user_id=user_id, key=WELCOME_PREF_KEY, value=value, ctx=ctx)
            return False
        value["activities_started_at"] = now.isoformat()
        db_upsert_pref_single(user_id=user_id, key=WELCOME_PREF_KEY, value=value, ctx=ctx)
        return True

    return now - started < timedelta(days=WELCOME_DAYS)


def _read_state(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    row = db_get_pref_single(user_id=user_id, key=WELCOME_PREF_KEY, ctx=ctx)
    return dict((row or {}).get("value") or {})


def _write_state(user_id: int, value: Dict[str, Any], *, ctx: AuthCtx) -> None:
    db_upsert_pref_single(user_id=user_id, key=WELCOME_PREF_KEY, value=value, ctx=ctx)


def _window_open(win: Any, now: datetime) -> bool:
    if not isinstance(win, dict):
        return False
    frm, to = _parse_dt(win.get("from")), _parse_dt(win.get("to"))
    return bool(frm and to and frm <= now < to)


def _plan_window_from_meta(meta: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        start = date.fromisoformat(str(meta.get("start_date"))[:10])
    except Exception:  # noqa: BLE001
        return None
    frm = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
    return {
        "meta_id": meta.get("id"),
        "from": frm.isoformat(),
        "to": (frm + timedelta(days=WELCOME_DAYS)).isoformat(),
    }


def _ensure_plan_window(user_id: int, value: Dict[str, Any], *, ctx: AuthCtx) -> bool:
    """
    Prvý týždeň aktívneho plánu. Uložené okno sa len prečíta; aktívny plán
    sa v DB hľadá iba keď uložené okno neplatí (mohol pribudnúť nový plán).
    Vráti True, ak sa `value` zmenilo (treba zapísať).
    """
    if _window_open(value.get("plan_window"), datetime.now(timezone.utc)):
        return False

    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    if not meta or not meta.get("id") or not meta.get("start_date"):
        return False
    if (value.get("plan_window") or {}).get("meta_id") == meta.get("id"):
        return False

    win = _plan_window_from_meta(meta)
    if not win:
        return False
    value["plan_window"] = win
    return True


def service_welcome_ensure(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Vyhodnotí uvítací týždeň plánu a zapíše ho do DB, ak tam ešte nie je.
    Volá sa pri aktivácii plánu a z admin panelu. Okno aktivít sa tu
    neotvára - to začína až prvou aktivitou.
    """
    value = _read_state(user_id, ctx=ctx)
    if _ensure_plan_window(user_id, value, ctx=ctx):
        _write_state(user_id, value, ctx=ctx)
    return value


def service_welcome_ensure_safe(user_id: int, *, ctx: AuthCtx) -> None:
    """Pre aktiváciu plánu - chyba tu nesmie zhodiť uloženie plánu."""
    try:
        service_welcome_ensure(user_id, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[WELCOME] ensure failed user={user_id}: {repr(e)}")


def welcome_review_eligible(user_id: int, activity_id: int, *, ctx: AuthCtx) -> bool:
    """
    True, ak má nová aktivita dostať automatické uvítacie hodnotenie.
    Pri chybe False - zlyhanie tejto vedľajšej veci nesmie zhodiť import.
    """
    try:
        # aktivita už hodnotenie má (napr. opakovaný webhook) - nič
        if db_get_review_thread(user_id, activity_id, ctx=ctx):
            return False
        now = datetime.now(timezone.utc)
        value = _read_state(user_id, ctx=ctx)
        if _window_open(value.get("manual_window"), now):
            return True
        if _ensure_plan_window(user_id, value, ctx=ctx):
            _write_state(user_id, value, ctx=ctx)
        if _window_open(value.get("plan_window"), now):
            return True
        return _activities_window_open(user_id, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[WELCOME] eligibility check failed user={user_id}: {repr(e)}")
        return False


# ============================================================
# ADMIN PREHĽAD - kto má uvítací týždeň a koľko stál
# ============================================================

# Orientačné ceny (USD za 1M tokenov: vstup, výstup) - len na odhad v admin
# paneli, nie na účtovanie. Neznámy model = cena Haiku.
_PRICE_PER_MTOK = {
    "claude-haiku": (1.0, 5.0),
    "claude-sonnet": (2.0, 10.0),
    "claude-opus": (4.0, 20.0),
}
ADMIN_LOOKBACK_DAYS = 14


def _estimate_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    price = next(
        (p for prefix, p in _PRICE_PER_MTOK.items() if str(model or "").startswith(prefix)),
        _PRICE_PER_MTOK["claude-haiku"],
    )
    return (input_tokens * price[0] + output_tokens * price[1]) / 1_000_000


def service_welcome_week_admin_status(*, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Useri s uvítacím týždňom za posledných 14 dní (aktívnym aj skončeným),
    od-do, počet automatických hodnotení a ich spotreba.
    """
    from DB.retention import (
        db_get_user_emails,
        db_list_active_plans_started_since,
        db_list_prefs_by_key,
        db_list_welcome_usage_since,
    )

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=ADMIN_LOOKBACK_DAYS + WELCOME_DAYS)
    windows: list = []

    seen: set = set()

    def _add(user_id: int, kind: str, frm: Optional[datetime], to: Optional[datetime]) -> None:
        if not frm or not to or to < since:
            return
        k = (user_id, kind, frm.date().isoformat())
        if k in seen:
            return
        seen.add(k)
        windows.append({"user_id": user_id, "kind": kind, "from": frm, "to": to})

    for row in db_list_prefs_by_key(WELCOME_PREF_KEY, ctx=ctx):
        uid = int(row["user_id"])
        value = row.get("value") or {}
        started = _parse_dt(value.get("activities_started_at"))
        if started:
            _add(uid, "activities", started, started + timedelta(days=WELCOME_DAYS))
        for kind, key in (("plan", "plan_window"), ("admin", "manual_window")):
            win = value.get(key) or {}
            _add(uid, kind, _parse_dt(win.get("from")), _parse_dt(win.get("to")))

    # aktívne plány, ktoré ešte nemajú zapísané okno (napr. aktivované pred
    # zavedením zápisu) - zapíšeme ich, nabudúce už idú z user_prefs
    for meta in db_list_active_plans_started_since(since.date().isoformat(), ctx=ctx):
        win = _plan_window_from_meta(meta)
        if not win:
            continue
        uid = int(meta["user_id"])
        _add(uid, "plan", _parse_dt(win["from"]), _parse_dt(win["to"]))
        try:
            service_welcome_ensure(uid, ctx=ctx)
        except Exception as e:  # noqa: BLE001
            print(f"[WELCOME] admin ensure failed user={uid}: {repr(e)}")

    usage = db_list_welcome_usage_since(since.isoformat(), ctx=ctx)
    emails = db_get_user_emails(sorted({w["user_id"] for w in windows}), ctx=ctx)

    rows = []
    totals = {"reviews": 0, "input_tokens": 0, "output_tokens": 0, "est_usd": 0.0}
    for w in windows:
        in_window = [
            u for u in usage
            if int(u.get("user_id") or 0) == w["user_id"]
            and w["from"] <= (_parse_dt(u.get("created_at")) or w["from"] - timedelta(1)) < w["to"]
        ]
        tin = sum(int(u.get("input_tokens") or 0) for u in in_window)
        tout = sum(int(u.get("output_tokens") or 0) for u in in_window)
        usd = sum(
            _estimate_usd(u.get("model") or "", int(u.get("input_tokens") or 0), int(u.get("output_tokens") or 0))
            for u in in_window
        )
        rows.append({
            "user_id": w["user_id"],
            "email": emails.get(w["user_id"], ""),
            "kind": w["kind"],
            "from": w["from"].isoformat(),
            "to": w["to"].isoformat(),
            "active": w["from"] <= now < w["to"],
            "reviews": len(in_window),
            "input_tokens": tin,
            "output_tokens": tout,
            "est_usd": round(usd, 4),
        })
        totals["reviews"] += len(in_window)
        totals["input_tokens"] += tin
        totals["output_tokens"] += tout
        totals["est_usd"] += usd

    # aktívne hore, potom od najnovšieho
    rows.sort(key=lambda r: r["from"], reverse=True)
    rows.sort(key=lambda r: not r["active"])  # stabilné - aktívne ostanú hore
    totals["est_usd"] = round(totals["est_usd"], 4)
    return {
        "rows": rows,
        "active_count": len([r for r in rows if r["active"]]),
        "totals": totals,
        "lookback_days": ADMIN_LOOKBACK_DAYS,
        "generated_at": now.isoformat(),
    }


# ============================================================
# ADMIN - ručné nastavenie okna
# ============================================================

def _window_summary(value: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    started = _parse_dt(value.get("activities_started_at"))
    activities = None
    if started:
        activities = {
            "from": started.isoformat(),
            "to": (started + timedelta(days=WELCOME_DAYS)).isoformat(),
        }
    windows = {
        "activities": activities,
        "plan": value.get("plan_window"),
        "admin": value.get("manual_window"),
    }
    return {
        "windows": windows,
        "not_eligible": bool(value.get("not_eligible")),
        "active": any(_window_open(w, now) for w in windows.values()),
    }


def service_welcome_admin_get(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """Stav usera pre admin panel - pri čítaní sa okno plánu aj zapíše."""
    value = service_welcome_ensure(user_id, ctx=ctx)
    return _window_summary(value, datetime.now(timezone.utc))


def service_welcome_admin_set(
    user_id: int,
    *,
    days: int,
    start: Optional[str],
    note: Optional[str],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    days = max(1, min(int(days or WELCOME_DAYS), 60))
    now = datetime.now(timezone.utc)
    frm = now
    if start:
        try:
            d = date.fromisoformat(str(start)[:10])
            frm = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
        except Exception:  # noqa: BLE001
            return {"ok": False, "code": "invalid_start"}

    value = _read_state(user_id, ctx=ctx)
    value["manual_window"] = {
        "from": frm.isoformat(),
        "to": (frm + timedelta(days=days)).isoformat(),
        "note": (note or "").strip()[:200] or None,
        "set_at": now.isoformat(),
    }
    _write_state(user_id, value, ctx=ctx)
    return {"ok": True, **_window_summary(value, now)}


def service_welcome_admin_clear(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    value = _read_state(user_id, ctx=ctx)
    value.pop("manual_window", None)
    _write_state(user_id, value, ctx=ctx)
    return {"ok": True, **_window_summary(value, datetime.now(timezone.utc))}
