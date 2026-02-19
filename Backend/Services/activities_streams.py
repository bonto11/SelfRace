from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

from Modules.Strava.activities import StravaActivitiesClient
from Routes_DB.activities_streams import (
    db_get_streams_one,
    db_upsert_streams_with_sport,  # ✅ Vrátili sme sa k tvojmu spoľahlivému RPC
)

from Modules.Supabase.auth import AuthCtx


# --------------------------------------------------------------------
# Helper: práca s key_by_type JSONom zo Stravy
# --------------------------------------------------------------------

def _arr(j: Dict[str, Any], key: str):
    return (j.get(key) or {}).get("data") or []


# --------------------------------------------------------------------
# Strava client pre konkrétneho usera
# --------------------------------------------------------------------

def _get_strava_client_for_user(user_id: int) -> StravaActivitiesClient:
    from Services.synchronization_single import _get_access_token_for_user

    token = _get_access_token_for_user(user_id)
    if not token:
        raise RuntimeError(
            f"Missing Strava access token for user_id={user_id} in strava_accounts"
        )

    return StravaActivitiesClient(access_token=token)


# ====================================================================
# 1) STRAVA LAYER
# ====================================================================

def fetch_streams_from_strava(
    user_id: int,
    activity_id: int,
    *,
    timeout: int = 30,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    client = _get_strava_client_for_user(user_id)
    j = client.fetch_activity_streams(int(activity_id), timeout=timeout)
    return j


def fetch_streams_batch_from_strava(
    user_id: int,
    activity_ids: List[int],
    *,
    timeout: int = 30,
    sleep_seconds: float = 0.1,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    client = _get_strava_client_for_user(user_id)

    out: Dict[str, Any] = {
        "ok": True,
        "count": len(activity_ids),
        "items": [],
    }

    for idx, aid in enumerate(activity_ids):
        try:
            j = client.fetch_activity_streams(int(aid), timeout=timeout)
            out["items"].append({"activity_id": aid, "ok": True, "json": j})
        except Exception as e:  # noqa: BLE001
            out["items"].append({"activity_id": aid, "ok": False, "error": str(e)})

        time.sleep(sleep_seconds)

    return out


# ====================================================================
# 2) DB LAYER
# ====================================================================

def save_streams_with_sport_to_db(
    user_id: int,
    activity_id: int,
    streams_json: Dict[str, Any],
    *,
    ctx: AuthCtx,
) -> Tuple[bool, str]:
    try:
        times = _arr(streams_json, "time")
        hr = _arr(streams_json, "heartrate")
        cad = _arr(streams_json, "cadence")
        poww = _arr(streams_json, "watts")
        dist = _arr(streams_json, "distance")
        alt = _arr(streams_json, "altitude")
        vel = _arr(streams_json, "velocity_smooth")
        grade = _arr(streams_json, "grade_smooth")
        temp = _arr(streams_json, "temp")

        # Voláme bezpečné RPC (doplnili sme tam trik s Delete, aby sa obnovil čas expirácie)
        db_upsert_streams_with_sport(
            user_id=int(user_id),
            activity_id=int(activity_id),
            time_s=[int(x) for x in times],
            heartrate=[int(x) for x in hr] if hr else [],
            cadence=[int(x) for x in cad] if cad else [],
            power=[int(x) for x in poww] if poww else [],
            distance=[float(x) for x in dist] if dist else [],
            altitude=[float(x) for x in alt] if alt else [],
            speed=[float(x) for x in vel] if vel else [],
            grade=[float(x) for x in grade] if grade else [],
            temp=[float(x) for x in temp] if temp else [],
            ctx=ctx
        )
        return True, ""
    except Exception as e:  # noqa: BLE001
        print(f"[ERROR in save_streams_with_sport_to_db] {e}")
        return False, str(e)


def service_get_streams_one(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    row = db_get_streams_one(
        user_id=user_id,
        activity_id=activity_id,
        ctx=ctx,
    )

    if not row:
        return {
            "time_s": [],
            "heartrate_bpm": [],
            "cadence_rpm": [],
            "power_w": [],
            "distance_m": [],
            "altitude_m": [],
            "speed_mps": [],
            "grade_smooth": [],
            "temp_c": [],
        }

    row.setdefault("time_s", row.get("time_s") or [])
    row.setdefault("heartrate_bpm", row.get("heartrate_bpm") or [])
    row.setdefault("cadence_rpm", row.get("cadence_rpm") or [])
    row.setdefault("power_w", row.get("power_w") or [])
    row.setdefault("distance_m", row.get("distance_m") or [])
    row.setdefault("altitude_m", row.get("altitude_m") or [])
    row.setdefault("speed_mps", row.get("speed_mps") or [])
    row.setdefault("grade_smooth", row.get("grade_smooth") or [])
    row.setdefault("temp_c", row.get("temp_c") or [])

    return row


# ====================================================================
# 3) KOMBINOVANÉ HELPERY
# ====================================================================

def fetch_and_optionally_store_batch(
    user_id: int,
    activity_ids: List[int],
    store: bool = False,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    fetch_res = fetch_streams_batch_from_strava(ctx=ctx, user_id=user_id, activity_ids=activity_ids)
    items_in = fetch_res.get("items") or []

    out: Dict[str, Any] = {
        "ok": bool(fetch_res.get("ok", True)),
        "count": int(fetch_res.get("count", len(activity_ids))),
        "stored": 0,
        "items": [],
    }

    for item in items_in:
        aid = item.get("activity_id")
        ok = bool(item.get("ok"))
        if not ok:
            out["items"].append({"activity_id": aid, "ok": False, "error": item.get("error")})
            continue

        j = item.get("json") or {}
        sizes = {
            "time": len(_arr(j, "time")),
            "heartrate": len(_arr(j, "heartrate")),
            "distance": len(_arr(j, "distance")),
            "altitude": len(_arr(j, "altitude")),
            "velocity_smooth": len(_arr(j, "velocity_smooth")),
            "cadence": len(_arr(j, "cadence")),
            "watts": len(_arr(j, "watts")),
            "latlng": len(_arr(j, "latlng")),
        }

        out_item: Dict[str, Any] = {"activity_id": aid, "ok": True, "sizes": sizes}

        if store:
            stored_ok, err = save_streams_with_sport_to_db(
                user_id=user_id,
                activity_id=int(aid),
                streams_json=j,
                ctx=ctx,
            )
            out_item["stored"] = stored_ok
            if not stored_ok:
                out_item["error"] = err
            else:
                out["stored"] += 1

        out["items"].append(out_item)

    return out


def cache_streams_for_activities(
    user_id: int,
    activity_ids: List[int],
    *,
    ctx: AuthCtx,
) -> Dict[str, int]:

    fetch_res = fetch_streams_batch_from_strava(ctx=ctx, user_id=user_id, activity_ids=activity_ids)
    items_in = fetch_res.get("items") or []

    saved = 0
    failed = 0

    for item in items_in:
        aid = item.get("activity_id")
        ok = bool(item.get("ok"))
        if not ok:
            failed += 1
            continue

        j = item.get("json") or {}
        ok_db, err = save_streams_with_sport_to_db(
            user_id=user_id,
            activity_id=int(aid),
            streams_json=j,
            ctx=ctx
        )
        if ok_db:
            saved += 1
        else:
            failed += 1

    return {"saved": saved, "failed": failed, "total": len(activity_ids)}


def service_get_streams_cached_or_fetch(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    print("service_get_streams_cached_or_fetch", user_id, activity_id)
    
    row = db_get_streams_one(
        user_id=user_id,
        activity_id=activity_id,
        ctx=ctx
    )

    if row:
        row.setdefault("time_s", row.get("time_s") or [])
        row.setdefault("heartrate_bpm", row.get("heartrate_bpm") or [])
        row.setdefault("cadence_rpm", row.get("cadence_rpm") or [])
        row.setdefault("power_w", row.get("power_w") or [])
        row.setdefault("distance_m", row.get("distance_m") or [])
        row.setdefault("altitude_m", row.get("altitude_m") or [])
        row.setdefault("speed_mps", row.get("speed_mps") or [])
        row.setdefault("grade_smooth", row.get("grade_smooth") or [])
        row.setdefault("temp_c", row.get("temp_c") or [])
        row.setdefault("moving", row.get("moving") or [])

        return {"source": "db", "fetched": False, "streams": row}

    j = fetch_streams_from_strava(ctx=ctx, user_id=user_id, activity_id=activity_id)

    ok, err = save_streams_with_sport_to_db(
        user_id=user_id,
        activity_id=activity_id,
        streams_json=j,
        ctx=ctx
    )
    print("service_get_streams_cached_or_fetch save_streams_with_sport_to_db", ok)
    
    if not ok:
        raise RuntimeError(f"Failed to store streams: {err}")

    # Re-read DB
    row2 = db_get_streams_one(
        user_id=user_id,
        activity_id=activity_id,
        ctx=ctx
    )

    if not row2:
        raise RuntimeError("Streams stored but not readable from DB")

    row2.setdefault("time_s", row2.get("time_s") or [])
    row2.setdefault("heartrate_bpm", row2.get("heartrate_bpm") or [])
    row2.setdefault("cadence_rpm", row2.get("cadence_rpm") or [])
    row2.setdefault("power_w", row2.get("power_w") or [])
    row2.setdefault("distance_m", row2.get("distance_m") or [])
    row2.setdefault("altitude_m", row2.get("altitude_m") or [])
    row2.setdefault("speed_mps", row2.get("speed_mps") or [])
    row2.setdefault("grade_smooth", row2.get("grade_smooth") or [])
    row2.setdefault("temp_c", row2.get("temp_c") or [])
    row2.setdefault("moving", row2.get("moving") or [])

    return {"source": "strava", "fetched": True, "streams": row2}