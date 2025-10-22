# Routes/activities_streams.py
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List
from datetime import datetime, timezone
from Modules.SQL.db_handler import get_client
from Modules.config import TABLE_ACTIVITIES_STREAMS

router = APIRouter(prefix="/activities", tags=["activities"])
sb = get_client()

def _downsample(xs: List[int], ys: List[int|None], max_points: int = 400):
    """Jednoduché rovnomerné riedenie (stačí na sparkline)."""
    n = min(len(xs), len(ys))
    if n <= max_points or max_points <= 0:
        return xs[:n], ys[:n]
    step = n / max_points
    out_x, out_y = [], []
    i = 0.0
    while int(i) < n:
        j = int(i)
        out_x.append(xs[j])
        out_y.append(ys[j])
        i += step
    return out_x, out_y

@router.get("/streams/{activity_id}")
def get_streams(activity_id: int, max: int = Query(400, ge=50, le=2000)) -> Dict[str, Any]:
    """Vráti čas + HR (downsample), vhodné pre mini-trend."""
    r = sb.table(TABLE_ACTIVITIES_STREAMS)\
        .select("time_s, heartrate_bpm")\
        .eq("activity_id", activity_id)\
        .limit(1).execute()

    if not r.data:
        raise HTTPException(status_code=404, detail="streams_not_found")

    row = r.data[0] or {}
    time_s: List[int] = row.get("time_s") or []
    hr: List[int|None] = row.get("heartrate_bpm") or []

    if not time_s or not hr:
        # niektoré aktivity nemajú HR – nech je FE pripravené
        return {"activity_id": activity_id, "time_s": [], "hr": [], "duration_s": 0}

    xs, ys = _downsample(time_s, hr, max_points=max)
    duration_s = int(time_s[-1]) if time_s else 0
    return {"activity_id": activity_id, "time_s": xs, "hr": ys, "duration_s": duration_s}