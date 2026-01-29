from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Optional, Tuple

import requests

from Modules.Supabase.client import get_service_client

supabase = get_service_client()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _select_strava_account(user_id: int) -> Optional[Mapping[str, Any]]:
    try:
        resp = (
            supabase.table("strava_accounts")
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

    # ⚠️ uprav si ak treba názvy tabuliek podľa reality
    # (tu používam presne to čo si písal, len webhook events opravujem na owner_id)
    candidates = [
        ("activities_summary", {"user_id": int(user_id)}),
        ("activities_streams", {"user_id": int(user_id)}),
        ("activities_splits", {"user_id": int(user_id)}),
        ("activities_laps", {"user_id": int(user_id)}),
        ("activities_enrichment", {"user_id": int(user_id)}),
    ]

    # webhook events: u teba je owner_id == athlete_id
    if athlete_id is not None:
        candidates.append(("strava_webhook_events", {"owner_id": int(athlete_id)}))

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
            supabase.table("strava_accounts")
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
) -> Dict[str, Any]:
    """
    Jeden “safe” entrypoint pre:
    - Strava deauthorize
    - purge dát
    - invalidácia tokenov + deauthorized_at

    Použiješ ho:
    - z /api/strava/disconnect (s consentom)
    - z account delete requestu (bez consentu – interný flow)
    """
    row = _select_strava_account(int(user_id))
    if not row:
        return {"ok": True, "already": True, "note": "no_strava_account_row"}

    athlete_id = row.get("athlete_id")
    access_token = row.get("access_token")
    already_deauthed = bool(row.get("deauthorized_at"))

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
        "user_id": int(user_id),
        "athlete_id": athlete_id,
        "reason": reason,
        "strava_deauthorize": deauth_res,
        "purge": purge_res,
        "account_update": upd_res,
    }