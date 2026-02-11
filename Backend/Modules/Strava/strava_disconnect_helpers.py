# Modules/Strava/strava_disconnect_helpers.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Optional, Tuple, List

import requests

from Modules.Supabase.client import get_service_client
from Configs.config import TABLE_STRAVA_ACCOUNTS
supabase = get_service_client()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _select_strava_account(user_id: int) -> Optional[Mapping[str, Any]]:
    try:
        resp = (
            supabase.table(TABLE_STRAVA_ACCOUNTS)
            .select("user_id, athlete_id, access_token, refresh_token, expires_at, scope, deauthorized_at")
            .eq("user_id", int(user_id))
            .limit(1)
            .execute()
        )
        row = (getattr(resp, "data", None) or [None])[0]
        return row
    except Exception:
        return None


def strava_deauthorize_best_effort(access_token: Optional[str]) -> Dict[str, Any]:
    """
    Best-effort Strava deauthorize.
    Nikdy nefailni flow len preto, že Strava timeoutla.
    """
    if not access_token:
        return {"attempted": False, "ok": True, "status": None}

    try:
        r = requests.post(
            "https://www.strava.com/oauth/deauthorize",
            data={"access_token": access_token},
            timeout=15,
        )
        ok = r.status_code in (200, 201)
        return {"attempted": True, "ok": ok, "status": r.status_code, "text": (r.text or "")[:500]}
    except Exception as e:  # noqa: BLE001
        return {"attempted": True, "ok": False, "error": repr(e)}


def _purge_plan(*, user_id: int, athlete_id: Optional[int]) -> List[Dict[str, Any]]:
    """
    Vráti plán mazania (pre dry_run / debug), bez vykonania.
    """
    items: List[Dict[str, Any]] = [
        {"table": "activities_summary", "filters": {"user_id": int(user_id)}},
        {"table": "activities_streams", "filters": {"user_id": int(user_id)}},
        {"table": "activities_splits", "filters": {"user_id": int(user_id)}},
        {"table": "activities_laps", "filters": {"user_id": int(user_id)}},
        {"table": "activities_enrichment", "filters": {"user_id": int(user_id)}},
    ]
    if athlete_id is not None:
        items.append({"table": "strava_webhook_events", "filters": {"owner_id": int(athlete_id)}})
    return items


def purge_strava_user_data_best_effort(
    *,
    user_id: int,
    athlete_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Best-effort purge Strava-importovaných dát pre usera.
    - user_id filter pre tvoje tabuľky
    - strava_webhook_events má u teba owner_id => použijeme athlete_id
    """
    results: Dict[str, Any] = {"deleted": {}, "errors": {}}

    candidates = [(p["table"], p["filters"]) for p in _purge_plan(user_id=user_id, athlete_id=athlete_id)]

    for table, filters in candidates:
        try:
            q = supabase.table(table).delete()
            for k, v in filters.items():
                q = q.eq(k, v)
            resp = q.execute()
            data = getattr(resp, "data", None) or []
            err = getattr(resp, "error", None)
            if err:
                results["errors"][table] = str(err)
            else:
                results["deleted"][table] = len(data)
        except Exception as e:  # noqa: BLE001
            results["errors"][table] = repr(e)

    return results


def invalidate_strava_tokens_and_mark_deauthorized(
    *,
    user_id: int,
    when_iso: Optional[str] = None,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Vyčistí tokeny + nastaví deauthorized_at.
    """
    now_iso = when_iso or _now_iso()
    payload = {
        "deauthorized_at": now_iso,
        "access_token": None,
        "refresh_token": None,
        "expires_at": None,
        "scope": [],
    }

    try:
        upd = (
            supabase.table(TABLE_STRAVA_ACCOUNTS)
            .update(payload)
            .eq("user_id", int(user_id))
            .execute()
        )
        err = getattr(upd, "error", None)
        data = getattr(upd, "data", None) or []
        if err:
            return False, {"ok": False, "error": str(err)}
        return True, {"ok": True, "updated": len(data), "deauthorized_at": now_iso}
    except Exception as e:  # noqa: BLE001
        return False, {"ok": False, "error": repr(e)}


def disconnect_strava_account(
    *,
    user_id: int,
    reason: str,
    purge_data: bool = True,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Jeden “safe” entrypoint pre:
    - Strava deauthorize
    - purge dát
    - invalidácia tokenov + deauthorized_at

    dry_run=True:
    - nevykoná nič destruktívne (ani request na Stravu, ani DB delete/update)
    - vráti plán (čo by sa spravilo)
    """
    row = _select_strava_account(int(user_id))
    if not row:
        return {
            "ok": True,
            "dry_run": bool(dry_run),
            "already": True,
            "note": "no_strava_account_row",
            "purge_plan": _purge_plan(user_id=int(user_id), athlete_id=None),
        }

    athlete_id = row.get("athlete_id")
    access_token = row.get("access_token")
    already_deauthed = bool(row.get("deauthorized_at"))

    # --- DRY RUN ---
    if dry_run:
        plan = {
            "would_deauthorize_strava": bool(access_token and not already_deauthed),
            "would_purge_data": bool(purge_data),
            "would_invalidate_tokens": True,
            "would_set_deauthorized_at": _now_iso(),
            "purge_plan": _purge_plan(user_id=int(user_id), athlete_id=int(athlete_id) if athlete_id is not None else None),
        }

        return {
            "ok": True,
            "dry_run": True,
            "user_id": int(user_id),
            "athlete_id": athlete_id,
            "reason": reason,
            "current": {
                "has_access_token": bool(access_token),
                "already_deauthorized": bool(already_deauthed),
                "deauthorized_at": row.get("deauthorized_at"),
            },
            "plan": plan,
        }

    # --- REAL RUN ---
    deauth_res = {"attempted": False, "ok": True}
    if access_token and not already_deauthed:
        deauth_res = strava_deauthorize_best_effort(access_token)

    purge_res = {"skipped": True}
    if purge_data:
        purge_res = purge_strava_user_data_best_effort(
            user_id=int(user_id),
            athlete_id=int(athlete_id) if athlete_id is not None else None,
        )

    ok_update, upd_res = invalidate_strava_tokens_and_mark_deauthorized(
        user_id=int(user_id),
        when_iso=_now_iso(),
    )

    return {
        "ok": bool(ok_update),
        "dry_run": False,
        "user_id": int(user_id),
        "athlete_id": athlete_id,
        "reason": reason,
        "strava_deauthorize": deauth_res,
        "purge": purge_res,
        "account_update": upd_res,
    }