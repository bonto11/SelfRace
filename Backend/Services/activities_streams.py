from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

from Modules.Strava.activities import StravaActivitiesClient
from Routes_DB.activities_streams import (
    db_get_streams_one,
    db_upsert_streams_with_sport,
)
from Services.users import require_jwt


# --------------------------------------------------------------------
# Debug helper
# --------------------------------------------------------------------

DEBUG_STREAMS = True


def _dbg(*args: Any, **kwargs: Any) -> None:
    if DEBUG_STREAMS:
        print("[streams]", *args, **kwargs, flush=True)


# --------------------------------------------------------------------
# Common helper – práca s key_by_type JSONom zo Stravy
# --------------------------------------------------------------------


def _arr(j: Dict[str, Any], key: str):
    """
    Helper: vytiahne 'data' pole z key_by_type stream JSONu.
    Očakávaný tvar:
      { "time": { "data": [...] }, "heartrate": { "data": [...] }, ... }
    """
    val = (j.get(key) or {}).get("data") or []
    _dbg(f"_arr('{key}') -> len={len(val)}")
    return val


# ====================================================================
# 1) STRAVA LAYER – čisto HTTP, žiadna DB
# ====================================================================


def fetch_streams_from_strava(
    activity_id: int,
    *,
    timeout: int = 30,
) -> Dict[str, Any]:
    """
    Načíta streams pre JEDNU aktivitu zo Stravy.
    """
    client = StravaActivitiesClient()
    j = client.fetch_activity_streams(int(activity_id), timeout=timeout)
    _dbg(
        f"fetch_streams_from_strava({activity_id}) "
        f"keys={sorted(list((j or {}).keys()))}"
    )
    return j


def fetch_streams_batch_from_strava(
    activity_ids: List[int],
    *,
    timeout: int = 30,
    sleep_seconds: float = 0.1,
) -> Dict[str, Any]:
    """
    Batch fetch zo Stravy – žiadna DB.
    """
    client = StravaActivitiesClient()
    out: Dict[str, Any] = {
        "ok": True,
        "count": len(activity_ids),
        "items": [],
    }

    for idx, aid in enumerate(activity_ids):
        try:
            j = client.fetch_activity_streams(int(aid), timeout=timeout)
            if idx < 10:
                _dbg(
                    f"fetch_streams_batch_from_strava activity_id={aid} "
                    f"keys={sorted(list((j or {}).keys()))}"
                )
            out["items"].append(
                {
                    "activity_id": aid,
                    "ok": True,
                    "json": j,
                }
            )

        except Exception as e:  # noqa: BLE001
            _dbg(f"fetch_streams_batch_from_strava activity_id={aid} ERROR: {e}")
            out["items"].append(
                {
                    "activity_id": aid,
                    "ok": False,
                    "error": str(e),
                }
            )
        time.sleep(sleep_seconds)

    _dbg(
        "fetch_streams_batch_from_strava summary:",
        {"count": out["count"], "items_len": len(out["items"])},
    )
    return out


# ====================================================================
# 2) DB LAYER – čisto Supabase, žiadna Strava
# ====================================================================


def save_streams_with_sport_to_db(
    user_id: int,
    activity_id: int,
    streams_json: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Tuple[bool, str]:
    """
    Uloží streamy cez RPC upsert_streams_with_sport.

    Jediný zápis do public.activities_streams – vrátane altitude/speed/grade/temp.
    """
    try:
        _dbg(
            f"save_streams_with_sport_to_db user={user_id} act={activity_id} "
            f"raw_keys={sorted(list(streams_json.keys()))}"
        )

        # základné polia
        times = _arr(streams_json, "time")
        hr = _arr(streams_json, "heartrate")
        cad = _arr(streams_json, "cadence")
        poww = _arr(streams_json, "watts")
        dist = _arr(streams_json, "distance")

        # nové streamy
        alt = _arr(streams_json, "altitude")
        vel = _arr(streams_json, "velocity_smooth")
        grade = _arr(streams_json, "grade_smooth")
        temp = _arr(streams_json, "temp")

        _dbg(
            "save_streams_with_sport_to_db sizes:",
            {
                "time": len(times),
                "heartrate": len(hr),
                "cadence": len(cad),
                "watts": len(poww),
                "distance": len(dist),
                "altitude": len(alt),
                "velocity_smooth": len(vel),
                "grade_smooth": len(grade),
                "temp": len(temp),
            },
        )

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
            user_jwt=user_jwt,
            service=service,
        )
        return True, ""
    except Exception as e:  # noqa: BLE001
        _dbg(
            f"save_streams_with_sport_to_db ERROR user={user_id} "
            f"act={activity_id}: {e}"
        )
        return False, str(e)


def service_get_streams_one(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Čítanie streamov z DB pre FE/AI.
    """

    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    row = db_get_streams_one(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    if not row:
        _dbg(f"service_get_streams_one user={user_id} act={activity_id} -> EMPTY")
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

    # doplň prázdne polia, aby FE malo vždy rovnaký shape
    row.setdefault("time_s", row.get("time_s") or [])
    row.setdefault("heartrate_bpm", row.get("heartrate_bpm") or [])
    row.setdefault("cadence_rpm", row.get("cadence_rpm") or [])
    row.setdefault("power_w", row.get("power_w") or [])
    row.setdefault("distance_m", row.get("distance_m") or [])
    row.setdefault("altitude_m", row.get("altitude_m") or [])
    row.setdefault("speed_mps", row.get("speed_mps") or [])
    row.setdefault("grade_smooth", row.get("grade_smooth") or [])
    row.setdefault("temp_c", row.get("temp_c") or [])

    _dbg(
        f"service_get_streams_one user={user_id} act={activity_id} "
        f"db_keys={sorted(list(row.keys()))}"
    )
    _dbg(
        "service_get_streams_one sizes:",
        {
            "time_s": len(row.get("time_s") or []),
            "heartrate_bpm": len(row.get("heartrate_bpm") or []),
            "cadence_rpm": len(row.get("cadence_rpm") or []),
            "power_w": len(row.get("power_w") or []),
            "distance_m": len(row.get("distance_m") or []),
            "altitude_m": len(row.get("altitude_m") or []),
            "speed_mps": len(row.get("speed_mps") or []),
            "grade_smooth": len(row.get("grade_smooth") or []),
            "temp_c": len(row.get("temp_c") or []),
        },
    )

    return row


# ====================================================================
# 3) KOMBINOVANÉ HELPERY – Strava + DB
# ====================================================================


def fetch_and_optionally_store_batch(
    user_id: int,
    activity_ids: List[int],
    store: bool = False,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    - Strava fetch: fetch_streams_batch_from_strava()
    - DB write (ak store=True): save_streams_with_sport_to_db()
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    fetch_res = fetch_streams_batch_from_strava(activity_ids)
    items_in = fetch_res.get("items") or []

    out: Dict[str, Any] = {
        "ok": bool(fetch_res.get("ok", True)),
        "count": int(fetch_res.get("count", len(activity_ids))),
        "stored": 0,
        "items": [],
    }

    _dbg(
        "fetch_and_optionally_store_batch start:",
        {
            "user_id": user_id,
            "activity_ids": activity_ids,
            "store": store,
            "items_in_len": len(items_in),
        },
    )

    for item in items_in:
        aid = item.get("activity_id")
        ok = bool(item.get("ok"))
        if not ok:
            _dbg(
                "fetch_and_optionally_store_batch item error:",
                {"activity_id": aid, "error": item.get("error")},
            )
            out["items"].append(
                {
                    "activity_id": aid,
                    "ok": False,
                    "error": item.get("error"),
                }
            )
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
        _dbg(
            "fetch_and_optionally_store_batch item sizes:",
            {"activity_id": aid, "sizes": sizes},
        )

        out_item: Dict[str, Any] = {"activity_id": aid, "ok": True, "sizes": sizes}

        if store:
            stored_ok, err = save_streams_with_sport_to_db(
                user_id=user_id,
                activity_id=int(aid),
                streams_json=j,
                user_jwt=jwt,
                service=service,
            )
            out_item["stored"] = stored_ok
            if not stored_ok:
                out_item["error"] = err
            else:
                out["stored"] += 1

        out["items"].append(out_item)

    _dbg(
        "fetch_and_optionally_store_batch summary:",
        {"stored": out["stored"], "items_len": len(out["items"])},
    )
    return out


def cache_streams_for_activities(
    user_id: int,
    activity_ids: List[int],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, int]:
    """
    PÔVODNÁ API pre enrichment:

    - Strava fetch pre každé activity_id
    - zápis do DB cez save_streams_with_sport_to_db()
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    _dbg(
        "cache_streams_for_activities start:",
        {"user_id": user_id, "activity_ids": activity_ids},
    )

    fetch_res = fetch_streams_batch_from_strava(activity_ids)
    items_in = fetch_res.get("items") or []

    saved = 0
    failed = 0

    for item in items_in:
        aid = item.get("activity_id")
        ok = bool(item.get("ok"))
        if not ok:
            _dbg(
                "cache_streams_for_activities item fetch ERROR:",
                {"activity_id": aid, "error": item.get("error")},
            )
            failed += 1
            continue

        j = item.get("json") or {}
        ok_db, err = save_streams_with_sport_to_db(
            user_id=user_id,
            activity_id=int(aid),
            streams_json=j,
            user_jwt=jwt,
            service=service,
        )
        if ok_db:
            saved += 1
        else:
            failed += 1
            _dbg(
                "cache_streams_for_activities item DB ERROR:",
                {"activity_id": aid, "error": err},
            )

    summary = {"saved": saved, "failed": failed, "total": len(activity_ids)}
    _dbg("cache_streams_for_activities summary:", summary)
    return summary