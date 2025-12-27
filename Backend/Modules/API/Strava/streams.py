# Modules/API/Strava/streams.py

'''
from __future__ import annotations
import time
import requests
from typing import Dict, Any, List, Tuple
from Modules.API.Strava.auth import get_access_token
from Modules.SQL.db_handler import get_client
from Configs.config import STRAVA_BASE, TABLE_ACTIVITIES_STREAMS, TABLE_USERS, TABLE_ACTIVITIES_SUMMARY

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

# ------- ukladanie do activities_streams (ARRAY stĺpce) -------
def store_streams(user_id: int, activity_id: int, streams_json: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Uloží streamy cez SQL RPC tak, aby sa user_uid a sport_type_fe dotiahli zo summary.
    """
    try:
        times = _arr(streams_json, "time")
        hr    = _arr(streams_json, "heartrate")
        cad   = _arr(streams_json, "cadence")
        poww  = _arr(streams_json, "watts")
        dist  = _arr(streams_json, "distance")

        params = {
            "p_user_id": int(user_id),
            "p_activity_id": int(activity_id),
            "p_time_s": [int(x) for x in times],
            "p_heartrate": [int(x) for x in hr] if hr else [],
            "p_cadence": [int(x) for x in cad] if cad else [],
            "p_power": [int(x) for x in poww] if poww else [],
            "p_distance": [float(x) for x in dist] if dist else [],
        }
        sb.rpc("upsert_streams_with_sport", params).execute()
        return True, ""
    except Exception as e:
        return False, str(e)

# ------- batch helper -------
def fetch_and_optionally_store_batch(user_id: int, activity_ids: List[int], store: bool = False) -> Dict[str, Any]:
    sess = _session()
    out = {"ok": True, "count": len(activity_ids), "stored": 0, "items": []}
    for i, aid in enumerate(activity_ids, start=1):
        try:
            # ⬇️ FIX: volaj internú verziu so session
            res = _fetch_streams_with_session(sess, int(aid))
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
                ok, err = store_streams(user_id, int(aid), j)
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

def fetch_streams_for_activity(activity_id: int) -> Dict[str, Any]:
    s = _session()
    return _fetch_streams_with_session(s, activity_id)

def _fetch_streams_with_session(s: requests.Session, activity_id: int) -> Dict[str, Any]:
    # time, hr, distance, altitude, velocity_smooth, cadence, watts, latlng
    r = s.get(
        f"{STRAVA_BASE}/activities/{activity_id}/streams",
        params={"keys": "time,heartrate,distance,altitude,velocity_smooth,cadence,watts,latlng",
                "key_by_type": "true"},
        timeout=30,
    )
    if r.status_code in (403, 404):
        return {"ok": False, "status": r.status_code, "activity_id": activity_id}
    r.raise_for_status()
    j = r.json() or {}
    return {"ok": True, "activity_id": activity_id, "json": j}

def _store_stream_arrays(user_id: int, activity_id: int, j: Dict[str, Any]) -> None:
    # upsert do activities_streams (arrays)
    row = {
        "activity_id": int(activity_id),
        "user_id": int(user_id),
        # user_uid necháme NULL – RLS pre streams to nepotrebuje
        "user_uid": None,
        "sport_type_fe": "other",
        "time_s":         _arr(j, "time"),
        "heartrate_bpm":  _arr(j, "heartrate") or None,
        "cadence_rpm":    _arr(j, "cadence") or None,
        "power_w":        _arr(j, "watts") or None,
        "distance_m":     _arr(j, "distance") or None,
    }
    sb.table(TABLE_ACTIVITIES_STREAMS).upsert(row, on_conflict="activity_id").execute()

def cache_streams_for_activities(user_id: int, activity_ids: List[int]) -> dict:
    s = _session()
    saved = 0
    failed = 0
    for aid in activity_ids:
        try:
            res = _fetch_streams_with_session(s, int(aid))
            if not res.get("ok"):
                failed += 1
                continue
            _store_stream_arrays(user_id, int(aid), res["json"])
            saved += 1
        except Exception as e:
            print(f"[streams] save failed id={aid}: {e}")
            failed += 1
    return {"saved": saved, "failed": failed, "total": len(activity_ids)}
    '''