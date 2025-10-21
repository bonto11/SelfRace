# Modules/API/Strava/streams.py
from __future__ import annotations
import time
import requests
from typing import Dict, Any, List, Tuple
from Modules.API.Strava.auth import get_access_token
from Modules.SQL.db_handler import get_client
from Modules.config import STRAVA_BASE, TABLE_ACTIVITIES_STREAMS, TABLE_USERS, TABLE_ACTIVITIES_SUMMARY

sb = get_client()

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

def _get_user_uid(user_id: int) -> str:
    r = sb.table(TABLE_USERS).select("auth_uid").eq("id", user_id).limit(1).execute()
    if not r.data:
        raise RuntimeError(f"user_id {user_id} not found in users")
    return r.data[0]["auth_uid"]

def _get_sport_fe_or_default(user_id: int, activity_id: int) -> str:
    # len ak by si to niekedy chcel využiť; inak toto nepoužijeme
    r = sb.table(TABLE_ACTIVITIES_SUMMARY)\
          .select("sport_type_fe")\
          .eq("user_id", user_id).eq("activity_id", activity_id)\
          .limit(1).execute()
    v = (r.data or [{}])[0].get("sport_type_fe") or "other"
    return str(v).lower()

# ------- fetch (bez ukladania) -------
def fetch_streams_for_activity(sess: requests.Session, activity_id: int) -> Dict[str, Any]:
    url = f"{STRAVA_BASE}/activities/{activity_id}/streams"
    params = {
        "keys": "time,heartrate,distance,altitude,velocity_smooth,cadence,watts,latlng",
        "key_by_type": "true",
    }
    r = sess.get(url, params=params, timeout=30)
    if r.status_code in (403, 404):
        return {"ok": False, "activity_id": activity_id, "status": r.status_code, "error": r.text}
    r.raise_for_status()
    return {"ok": True, "activity_id": activity_id, "json": r.json() or {}}

# ------- ukladanie do activities_streams (ARRAY stĺpce) -------
def store_streams(user_id: int, activity_id: int, streams_json: Dict[str, Any]) -> Tuple[bool, str]:
    try:
        user_uid = _get_user_uid(user_id)
        times = _arr(streams_json, "time")
        hr    = _arr(streams_json, "heartrate")
        cad   = _arr(streams_json, "cadence")
        poww  = _arr(streams_json, "watts")
        dist  = _arr(streams_json, "distance")

        payload = {
            "user_id": user_id,
            "user_uid": user_uid,
            "activity_id": activity_id,
            "time_s":        [int(x)   for x in times],
            "heartrate_bpm": ([int(x) for x in hr]   or None),
            "cadence_rpm":   ([int(x) for x in cad]  or None),
            "power_w":       ([int(x) for x in poww] or None),
            "distance_m":    ([float(x) for x in dist] or None),
        }
        sb.table(TABLE_ACTIVITIES_STREAMS).upsert(payload, on_conflict="activity_id").execute()
        return True, ""
    except Exception as e:
        return False, str(e)

# ------- batch helper -------
def fetch_and_optionally_store_batch(user_id: int, activity_ids: List[int], store: bool = False) -> Dict[str, Any]:
    sess = _session()
    out = {"ok": True, "count": len(activity_ids), "stored": 0, "items": []}
    for i, aid in enumerate(activity_ids, start=1):
        try:
            res = fetch_streams_for_activity(sess, aid)
            if not res.get("ok"):
                out["items"].append({"activity_id": aid, "ok": False, "error": res.get("error"), "status": res.get("status")})
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
            item = {"activity_id": aid, "ok": True, "sizes": sizes}

            if store:
                ok, err = store_streams(user_id, aid, j)
                item["stored"] = ok
                if not ok:
                    item["error"] = err
                else:
                    out["stored"] += 1

            out["items"].append(item)
            time.sleep(0.1)  # gentle rate-limit
        except Exception as e:
            out["items"].append({"activity_id": aid, "ok": False, "error": str(e)})
    return out