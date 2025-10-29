# Routes/activities_streams.py
from fastapi import APIRouter
from typing import List, Dict, Any
from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_ACTIVITIES_STREAMS, TABLE_ACTIVITIES_SUMMARY
from Modules.API.Strava.streams import cache_streams_for_activities

router = APIRouter(prefix="/activities", tags=["activities"])
sb = get_client()

def _downsample(xs: List[int], ys: List[int], max_points: int = 240):
    n = min(len(xs), len(ys))
    if n <= max_points:
        return xs[:n], ys[:n]
    step = max(1, n // max_points)
    xs2, ys2 = [], []
    for i in range(0, n, step):
        xs2.append(xs[i])
        ys2.append(ys[i])
    return xs2, ys2

def _find_user_id(activity_id: int) -> int | None:
    r = sb.table(TABLE_ACTIVITIES_SUMMARY)\
          .select("user_id")\
          .eq("activity_id", activity_id)\
          .limit(1).execute()
    if r.data:
        return int(r.data[0]["user_id"])
    return None

@router.get("/streams/{activity_id}")
def get_hr_stream(activity_id: int, fetch: bool = True):
    """Vráti HR stream pre aktivitu. Ak chýba, voliteľne dotiahne zo Stravy."""
    # 1) skúsiť načítať z DB
    row = sb.table(TABLE_ACTIVITIES_STREAMS)\
            .select("time_s, heartrate_bpm")\
            .eq("activity_id", activity_id)\
            .limit(1).execute()
    time_s = (row.data or [{}])[0].get("time_s") or []
    hr = (row.data or [{}])[0].get("heartrate_bpm") or []

    # 2) ak nič nie je a fetch=True, pokús sa dotiahnuť + uložiť
    if fetch and (not time_s or not hr):
        uid = _find_user_id(activity_id)
        if uid is not None:
            cache_streams_for_activities(uid, [activity_id])
            row2 = sb.table(TABLE_ACTIVITIES_STREAMS)\
                     .select("time_s, heartrate_bpm")\
                     .eq("activity_id", activity_id)\
                     .limit(1).execute()
            time_s = (row2.data or [{}])[0].get("time_s") or []
            hr = (row2.data or [{}])[0].get("heartrate_bpm") or []

    # 3) odpoveď
    if not time_s or not hr:
        return {"ok": True, "available": False, "time_s": [], "hr": []}

    xs, ys = _downsample([int(x) for x in time_s], [int(y) for y in hr])
    return {"ok": True, "available": True, "time_s": xs, "hr": ys}