# Modules/Intervals/sync.py
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from DB.user_recovery import (
    db_get_recovery_record,
    db_insert_recovery,
    db_update_recovery,
)
from Modules.Intervals.client import fetch_wellness
from Modules.Intervals.config import (
    CRON_SYNC_DAYS,
    MAX_SYNC_DAYS,
    SYNC_HOURS,
)
from Modules.Intervals.db import (
    db_intervals_get_account,
    db_intervals_list_enabled_user_ids,
    db_intervals_mark_sync,
)
from Modules.Supabase.auth import AuthCtx

TZ = ZoneInfo("Europe/Bratislava")


def _pos_int(v: Any) -> Optional[int]:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return int(round(f)) if f > 0 else None


def _map_wellness(w: Dict[str, Any]) -> Dict[str, Any]:
    """
    intervals.icu wellness → stĺpce users_recovery.

    Len čísla z hodiniek. Faktory (alkohol, káva, jedlo) a poznámku zadáva
    user ručne – sync ich nikdy neprepisuje.

    HRV: berie sa len `hrv` (rMSSD – Garmin, Oura, Whoop). `hrvSDNN`
    (Apple) zámerne nie: je to iná metrika s inými hodnotami a zmiešanie
    by rozbilo baseline v service_check_recovery_and_adjust.
    """
    patch: Dict[str, Any] = {}

    hrv = _pos_int(w.get("hrv"))
    if hrv is not None:
        patch["HRV_avg_ms"] = hrv

    rhr = _pos_int(w.get("restingHR"))
    if rhr is not None:
        patch["RHR_bpm"] = rhr

    sleep_secs = _pos_int(w.get("sleepSecs"))
    if sleep_secs is not None:
        patch["sleep_duration_min"] = round(sleep_secs / 60)

    return patch


def _mark(user_id: int, error: Optional[str]) -> None:
    # Stav syncu je len informácia pre admina – jeho zlyhanie nesmie
    # zhodiť samotný sync.
    try:
        db_intervals_mark_sync(user_id, error)
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] mark sync failed user={user_id}: {repr(e)}")


def service_intervals_sync_user(
    user_id: int,
    days: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    account = db_intervals_get_account(user_id)
    if not account:
        return {"ok": False, "code": "intervals_not_enabled"}

    days = max(1, min(int(days), MAX_SYNC_DAYS))
    today = datetime.now(TZ).date()
    oldest = today - timedelta(days=days - 1)

    try:
        rows = fetch_wellness(
            str(account["athlete_id"]),
            str(account["api_key"]),
            oldest.isoformat(),
            today.isoformat(),
        )
    except Exception as e:  # noqa: BLE001
        print(f"[INTERVALS] fetch failed user={user_id}: {repr(e)}")
        _mark(user_id, repr(e))
        return {"ok": False, "code": "intervals_fetch_failed"}

    inserted = updated = 0
    today_changed = False

    for w in rows:
        date_iso = str(w.get("id") or "")[:10]
        try:
            date.fromisoformat(date_iso)
        except ValueError:
            continue

        patch = _map_wellness(w)
        if not patch:
            continue

        existing = db_get_recovery_record(user_id, date_iso, ctx=ctx)
        if existing:
            db_update_recovery(int(existing["id"]), patch, ctx=ctx)
            updated += 1
        else:
            db_insert_recovery({"user_id": user_id, "date": date_iso, **patch}, ctx=ctx)
            inserted += 1

        if date_iso == today.isoformat():
            today_changed = True

    # Auto-recovery kontrola len raz a len keď prišiel dnešok – kontrola
    # pozerá na najnovší riadok, staršie dni by ju spúšťali zbytočne.
    # Zlyhanie nesmie zhodiť sync, dáta sú už uložené.
    if today_changed:
        try:
            from Services.user_recovery import service_check_recovery_and_adjust

            service_check_recovery_and_adjust(user_id=user_id, ctx=ctx)
        except Exception as e:  # noqa: BLE001
            print(f"[INTERVALS] recovery check failed user={user_id}: {repr(e)}")

    _mark(user_id, None)

    return {
        "ok": True,
        "days": days,
        "fetched": len(rows),
        "inserted": inserted,
        "updated": updated,
    }


def service_intervals_sync_all(
    *,
    ctx: AuthCtx,
    days: int = CRON_SYNC_DAYS,
) -> Dict[str, Any]:
    results: Dict[int, Any] = {}
    for uid in db_intervals_list_enabled_user_ids():
        try:
            results[uid] = service_intervals_sync_user(uid, days, ctx=ctx)
        except Exception as e:  # noqa: BLE001
            print(f"[INTERVALS] sync failed user={uid}: {repr(e)}")
            results[uid] = {"ok": False, "code": "intervals_sync_failed"}
    return {"ok": True, "users": results}


def service_intervals_scheduled(*, ctx: AuthCtx, hour: int) -> Optional[Dict[str, Any]]:
    """Volané z hodinového schedulera, beží len v SYNC_HOURS."""
    if hour not in SYNC_HOURS:
        return None
    return service_intervals_sync_all(ctx=ctx)
