from __future__ import annotations

import time
import requests
from typing import Dict, Any, List, Tuple, Optional

from Modules.API.Strava.auth import get_access_token
from Configs.config import STRAVA_BASE
from Routes_DB.activities_streams import (
    db_upsert_streams_with_sport,
    db_upsert_stream_arrays,
)

# ------- low-level Strava session -------


def _session() -> requests.Session:
    tok = get_access_token()
    if not tok:
        raise RuntimeError("Chýba Strava access token (get_access_token())")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def _arr(j: Dict[str, Any], key: str):
    return (j.get(key) or {}).get("data") or []


# ------- ukladanie do activities_streams (ARRAY stĺpce) -------


def store_streams(
    user_id: int,
    activity_id: int,
    streams_json: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Uloží streamy cez SQL RPC tak, aby sa user_uid a sport_type_fe dotiahli zo summary.
    Celá DB logika ide cez Routes_DB.activities_streams.
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
        )

        return True, ""
    except Exception as e:  # noqa: BLE001
        return False, str(e)


# ------- batch helper -------


def fetch_and_optionally_store_batch(
    user_id: int,
    activity_ids: List[int],
    store: bool = False,
    *,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    sess = _session()
    out: Dict[str, Any] = {
        "ok": True,
        "count": len(activity_ids),
        "stored": 0,
        "items": [],
    }
    for i, aid in enumerate(activity_ids, start=1):
        try:
            res = _fetch_streams_with_session(sess, int(aid))
            if not res.get("ok"):
                out["items"].append(
                    {
                        "activity_id": aid,
                        "ok": False,
                        "error": res.get("error"),
                        "status": res.get("status"),
                    }
                )
                continue

            j = res["json"]
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
            item: Dict[str, Any] = {"activity_id": aid, "ok": True, "sizes": sizes}

            if store:
                ok, err = store_streams(
                    user_id,
                    int(aid),
                    j,
                    user_jwt=user_jwt,
                )
                item["stored"] = ok
                if not ok:
                    item["error"] = err
                else:
                    out["stored"] += 1

            out["items"].append(item)
            time.sleep(0.1)  # gentle rate-limit
        except Exception as e:  # noqa: BLE001
            out["items"].append(
                {"activity_id": aid, "ok": False, "error": str(e)}
            )
    return out


def _fetch_streams_with_session(
    s: requests.Session,
    activity_id: int,
) -> Dict[str, Any]:
    # time, hr, distance, altitude, velocity_smooth, cadence, watts, latlng
    r = s.get(
        f"{STRAVA_BASE}/activities/{activity_id}/streams",
        params={
            "keys": "time,heartrate,distance,altitude,velocity_smooth,cadence,watts,latlng",
            "key_by_type": "true",
        },
        timeout=30,
    )
    if r.status_code in (403, 404):
        return {"ok": False, "status": r.status_code, "activity_id": activity_id}
    r.raise_for_status()
    j = r.json() or {}
    return {"ok": True, "activity_id": activity_id, "json": j}


def _store_stream_arrays(
    user_id: int,
    activity_id: int,
    j: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
) -> None:
    """
    Jednoduchšie uloženie streamov priamo do TABLE_ACTIVITIES_STREAMS
    cez Route_DB helper (bez RPC).
    """
    times = _arr(j, "time")
    hr = _arr(j, "heartrate")
    cad = _arr(j, "cadence")
    poww = _arr(j, "watts")
    dist = _arr(j, "distance")

    db_upsert_stream_arrays(
        user_id=int(user_id),
        activity_id=int(activity_id),
        time_s=[int(x) for x in times],
        heartrate_bpm=[int(x) for x in hr] if hr else None,
        cadence_rpm=[int(x) for x in cad] if cad else None,
        power_w=[int(x) for x in poww] if poww else None,
        distance_m=[float(x) for x in dist] if dist else None,
        user_jwt=user_jwt,
    )


def cache_streams_for_activities(
    user_id: int,
    activity_ids: List[int],
    *,
    user_jwt: Optional[str] = None,
) -> dict:
    """
    Ľahká cache varianta – používa priamy upsert do TABLE_ACTIVITIES_STREAMS.
    Typicky sa volá zo workerov (user_jwt=None → service role).
    """
    s = _session()
    saved = 0
    failed = 0
    for aid in activity_ids:
        try:
            res = _fetch_streams_with_session(s, int(aid))
            if not res.get("ok"):
                failed += 1
                continue
            _store_stream_arrays(
                user_id,
                int(aid),
                res["json"],
                user_jwt=user_jwt,
            )
            saved += 1
        except Exception as e:  # noqa: BLE001
            print(f"[streams] save failed id={aid}: {e}")
            failed += 1
    return {"saved": saved, "failed": failed, "total": len(activity_ids)}