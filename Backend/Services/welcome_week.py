# Services/welcome_week.py
"""
Uvítací týždeň - prvé dni dostane user AI hodnotenie každej novej aktivity
automaticky a zadarmo (nezapočíta sa do mesačného limitu).

PREČO: prvý týždeň rozhoduje, či user v appke ostane. Hodnotenie hneď po
tréningu je najrýchlejší "wow" moment, ale user ho bez návodu nenájde.

Dve okná (stačí jedno):
- prvý týždeň aktivít: 7 dní od prvej novej aktivity po pripojení Stravy
  (začiatok sa zapíše pri prvej aktivite do user_prefs, nie do coach.prefs -
  tie idú do AI kontextu),
- prvý týždeň plánu: 7 dní od začiatku aktívneho plánu.
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


def _plan_window_open(user_id: int, *, ctx: AuthCtx) -> bool:
    """Prvý týždeň aktívneho plánu."""
    meta = db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx)
    start_raw = (meta or {}).get("start_date")
    if not start_raw:
        return False
    try:
        start = date.fromisoformat(str(start_raw)[:10])
    except Exception:  # noqa: BLE001
        return False
    today = date.today()
    return start <= today < start + timedelta(days=WELCOME_DAYS)


def welcome_review_eligible(user_id: int, activity_id: int, *, ctx: AuthCtx) -> bool:
    """
    True, ak má nová aktivita dostať automatické uvítacie hodnotenie.
    Pri chybe False - zlyhanie tejto vedľajšej veci nesmie zhodiť import.
    """
    try:
        # aktivita už hodnotenie má (napr. opakovaný webhook) - nič
        if db_get_review_thread(user_id, activity_id, ctx=ctx):
            return False
        # plán najprv - nezapisuje nič do DB
        if _plan_window_open(user_id, ctx=ctx):
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

    for row in db_list_prefs_by_key(WELCOME_PREF_KEY, ctx=ctx):
        started = _parse_dt((row.get("value") or {}).get("activities_started_at"))
        if started and started >= since:
            windows.append({
                "user_id": int(row["user_id"]),
                "kind": "activities",
                "from": started,
                "to": started + timedelta(days=WELCOME_DAYS),
            })

    for meta in db_list_active_plans_started_since(since.date().isoformat(), ctx=ctx):
        try:
            start = date.fromisoformat(str(meta.get("start_date"))[:10])
        except Exception:  # noqa: BLE001
            continue
        frm = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
        windows.append({
            "user_id": int(meta["user_id"]),
            "kind": "plan",
            "from": frm,
            "to": frm + timedelta(days=WELCOME_DAYS),
        })

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
