# Services/admin_alerts.py
"""
Upozornenia adminovi (users.role = 'ADMIN') cez push:
- nový user v appke (s celkovým počtom) – každú hodinu 8–22, nočné registrácie ráno o 8:00,
- kto sa len zaregistroval a nič nespravil → pošli mu pripomienku (18:00, každý user raz).

Stav je v users_preferences admina pod kľúčom `admin.alerts`:
{last_user_id, nudge_alerted: [user_id]}. PREČO pri adminovi: každý admin má
vlastnú značku „toto už videl“ a upsert na (user_id, key) netreba migráciu.
Prvé spustenie si len zapamätá posledného usera – za starých userov push nepríde.
"""
from __future__ import annotations

from typing import Any, Dict, List

from DB.user_overview import db_admin_user_ids, db_users_after, db_users_count_and_max
from DB.user_prefs import db_get_pref_single, db_upsert_pref_single
from Modules.Supabase.auth import AuthCtx

ALERTS_KEY = "admin.alerts"
ACTIVE_HOURS = range(8, 23)  # v noci adminovi nepípať
NUDGE_HOUR = 18
ADMIN_URL = "/hq-secure-zone"


def _users_word(n: int) -> str:
    if n == 1:
        return "user"
    return "useri" if 2 <= n <= 4 else "userov"


def _emails(rows: List[Dict[str, Any]], key: str, limit: int = 3) -> str:
    vals = [str(r.get(key) or f"#{r.get('id')}") for r in rows[:limit]]
    more = len(rows) - limit
    return ", ".join(vals) + (f" a ďalší ({more})" if more > 0 else "")


def _push(admin_id: int, title: str, body: str, *, ctx: AuthCtx) -> None:
    from Services.notifications import service_send_push_notification

    try:
        service_send_push_notification(user_id=admin_id, title=title, body=body, url=ADMIN_URL, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[ADMIN-ALERTS] push admin={admin_id} failed: {repr(e)}")


def service_cron_admin_alerts(*, hour: int, ctx: AuthCtx, force: bool = False) -> Dict[str, Any]:
    if not force and hour not in ACTIVE_HOURS:
        return {"skipped": "night"}
    admins = db_admin_user_ids(ctx=ctx)
    if not admins:
        return {"skipped": "no_admin"}

    total, max_id = db_users_count_and_max(ctx=ctx)

    nudge: List[Dict[str, Any]] | None = None
    if force or hour == NUDGE_HOUR:
        from Services.admin_outreach import list_nudge_candidates

        try:
            nudge = list_nudge_candidates(ctx=ctx)
        except Exception as e:  # noqa: BLE001
            print(f"[ADMIN-ALERTS] nudge candidates failed: {repr(e)}")

    out: Dict[str, Any] = {"admins": len(admins), "total_users": total, "signups": 0, "nudge": 0}
    for admin_id in admins:
        row = db_get_pref_single(admin_id, ALERTS_KEY, ctx=ctx) or {}
        state = row.get("value") if isinstance(row.get("value"), dict) else {}
        changed = False

        last = state.get("last_user_id")
        if last is None:
            state["last_user_id"] = max_id
            changed = True
        else:
            new = db_users_after(int(last), ctx=ctx)
            if new:
                n = len(new)
                title = "🎉 Nový user v SelfRace" if n == 1 else f"🎉 {n} noví useri v SelfRace" if n <= 4 else f"🎉 {n} nových userov v SelfRace"
                _push(admin_id, title, f"{_emails(new, 'mail_address')} · spolu už {total} {_users_word(total)}", ctx=ctx)
                state["last_user_id"] = max(int(r["id"]) for r in new)
                out["signups"] = n
                changed = True

        if nudge:
            alerted = {int(x) for x in state.get("nudge_alerted") or [] if str(x).isdigit()}
            fresh = [c for c in nudge if int(c["id"]) not in alerted]
            if fresh:
                n = len(fresh)
                verb = "sa len zaregistroval" if n == 1 else "sa len zaregistrovali" if n <= 4 else "sa len zaregistrovalo"
                _push(
                    admin_id,
                    f"📧 {n} {_users_word(n)} {verb}",
                    f"{_emails(fresh, 'email')} – pošli pripomienku v admin paneli",
                    ctx=ctx,
                )
                state["nudge_alerted"] = sorted(alerted | {int(c["id"]) for c in fresh})[-500:]
                out["nudge"] = n
                changed = True

        if changed:
            try:
                db_upsert_pref_single(admin_id, ALERTS_KEY, state, ctx=ctx)
            except Exception as e:  # noqa: BLE001
                print(f"[ADMIN-ALERTS] state save admin={admin_id} failed: {repr(e)}")
    return out
