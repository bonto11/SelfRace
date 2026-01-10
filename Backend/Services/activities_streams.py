# Services/activities_streams.py
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

from Modules.Strava.activities import StravaActivitiesClient
from Routes_DB.activities_streams import (
    db_get_streams_one,
    db_upsert_streams_with_sport,
    db_upsert_stream_arrays,
)
from Services.users import require_jwt


# --------------------------------------------------------------------
# Common helper – práca s key_by_type JSONom zo Stravy
# --------------------------------------------------------------------


def _arr(j: Dict[str, Any], key: str):
    """
    Helper: vytiahne 'data' pole z key_by_type stream JSONu.
    Očakávaný tvar:
      { "time": { "data": [...] }, "heartrate": { "data": [...] }, ... }
    """
    return (j.get(key) or {}).get("data") or []


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

    - používa StravaActivitiesClient.fetch_activity_streams()
    - NEROBÍ žiadne DB operácie
    - vyhadzuje výnimky pri HTTP errore (raise_for_status)
    """
    client = StravaActivitiesClient()
    return client.fetch_activity_streams(int(activity_id), timeout=timeout)


def fetch_streams_batch_from_strava(
    activity_ids: List[int],
    *,
    timeout: int = 30,
    sleep_seconds: float = 0.1,
) -> Dict[str, Any]:
    """
    Batch fetch zo Stravy – žiadna DB.

    Výstup:
    {
      "ok": True/False,
      "count": N,
      "items": [
        {
          "activity_id": ...,
          "ok": True/False,
          "json": { ... }   # len ak ok=True
          "error": "..."    # len ak ok=False
        },
        ...
      ]
    }
    """
    client = StravaActivitiesClient()
    out: Dict[str, Any] = {
        "ok": True,
        "count": len(activity_ids),
        "items": [],
    }

    for aid in activity_ids:
        try:
            j = client.fetch_activity_streams(int(aid), timeout=timeout)
            out["items"].append(
                {
                    "activity_id": aid,
                    "ok": True,
                    "json": j,
                }
            )
            print("fetch_streams_batch_from_strava out",out)
        except Exception as e:  # noqa: BLE001
            out["items"].append(
                {
                    "activity_id": aid,
                    "ok": False,
                    "error": str(e),
                }
            )
        time.sleep(sleep_seconds)

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
    Uloží streamy cez RPC upsert_streams_with_sport:

    - dotiahne user_uid a sport_type_fe zo summary (logika v DB)
    - používa db_upsert_streams_with_sport
    - NEROBÍ žiadny HTTP request na Stravu

    RLS vs service:
      - ak service=False + user_jwt nie je None → ideš cez RLS klienta
      - ak service=True (typicky user_jwt=None) → service role (worker/webhook)
    """
    try:
        times = _arr(streams_json, "time")
        hr = _arr(streams_json, "heartrate")
        cad = _arr(streams_json, "cadence")
        poww = _arr(streams_json, "watts")
        dist = _arr(streams_json, "distance")

        db_upsert_streams_with_sport(
            user_id=int(user_id),
            activity_id=int(activity_id),
            time_s=[int(x) for x in times],
            heartrate=[int(x) for x in hr] if hr else [],
            cadence=[int(x) for x in cad] if cad else [],
            power=[int(x) for x in poww] if poww else [],
            distance=[float(x) for x in dist] if dist else [],
            user_jwt=user_jwt,
            service=service,
        )
        return True, ""
    except Exception as e:  # noqa: BLE001
        return False, str(e)


def save_streams_arrays_to_db(
    user_id: int,
    activity_id: int,
    streams_json: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Tuple[bool, str]:
    """
    Jednoduchší zápis streamov priamo do TABLE_ACTIVITIES_STREAMS:

    - používa db_upsert_stream_arrays
    - NEROBÍ žiadny HTTP request na Stravu

    RLS vs service:
      - ak service=False + user_jwt nie je None → RLS klient
      - ak service=True                        → service role
    """
    try:
        times = _arr(streams_json, "time")
        hr = _arr(streams_json, "heartrate")
        cad = _arr(streams_json, "cadence")
        poww = _arr(streams_json, "watts")
        dist = _arr(streams_json, "distance")

        # 🔹 nové streamy zo Stravy
        alt = _arr(streams_json, "altitude")
        vel = _arr(streams_json, "velocity_smooth")
        grade = _arr(streams_json, "grade_smooth")
        temp = _arr(streams_json, "temp")

        db_upsert_stream_arrays(
            user_id=int(user_id),
            activity_id=int(activity_id),
            time_s=[int(x) for x in times],

            heartrate_bpm=[int(x) for x in hr] if hr else None,
            cadence_rpm=[int(x) for x in cad] if cad else None,
            power_w=[int(x) for x in poww] if poww else None,
            distance_m=[float(x) for x in dist] if dist else None,

            # 🔹 nové polia – presne ako máš stĺpce v public.activities_streams
            altitude_m=[float(x) for x in alt] if alt else None,
            speed_mps=[float(x) for x in vel] if vel else None,
            grade_smooth=[float(x) for x in grade] if grade else None,
            temp_c=[float(x) for x in temp] if temp else None,

            user_jwt=user_jwt,
            service=service,
        )
        return True, ""
    except Exception as e:  # noqa: BLE001
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

    - service=False + user_jwt → RLS klient (bežný FE request)
    - service=True             → service klient (worker/cron/webhook)

    Vždy vráti dict s rovnakými kľúčmi.
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
        # default shape – aby FE nemusel riešiť None / chýbajúce kľúče
        return {
            "time_s": [],
            "heartrate_bpm": [],
            "cadence_rpm": [],
            "power_w": [],
            "distance_m": [],
        }

    # ak DB vráti len čas a HR (staršie riadky), dopoň prázdne polia:
    row.setdefault("cadence_rpm", [])
    row.setdefault("power_w", [])
    row.setdefault("distance_m", [])
    row.setdefault("time_s", row.get("time_s") or [])
    row.setdefault("heartrate_bpm", row.get("heartrate_bpm") or [])

    return row

# ====================================================================
# 3) KOMBINOVANÉ HELPERY – Strava + DB (backward kompatibilita)
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
    PÔVODNÁ API, ale teraz čistejšie:

    - Strava fetch: fetch_streams_batch_from_strava()
    - DB write (ak store=True): save_streams_with_sport_to_db()

    RLS vs service:
      - FE sync:   service=False, pass user_jwt (RLS)
      - worker:    service=True, user_jwt=None → service role

    Výstup:
    {
      "ok": True/False,
      "count": N,
      "stored": M,
      "items": [
        {
          "activity_id": ...,
          "ok": True/False,
          "sizes": {...},
          "stored": True/False,  # len ak store=True
          "error": "..."         # len pri chybe
        },
        ...
      ]
    }
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

    print("fetch_and_optionally_store_batch items_in",items_in)

    for item in items_in:
        aid = item.get("activity_id")
        ok = bool(item.get("ok"))
        if not ok:
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
    - zápis do DB cez save_streams_arrays_to_db()

    Typicky:
      - worker / cron / webhook  → service=True, user_jwt=None (service role)
      - ak by si to volal z FE (skôr debug) → service=False, pass user_jwt (RLS)
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    fetch_res = fetch_streams_batch_from_strava(activity_ids)
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
        ok_db, _ = save_streams_arrays_to_db(
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

    return {"saved": saved, "failed": failed, "total": len(activity_ids)}