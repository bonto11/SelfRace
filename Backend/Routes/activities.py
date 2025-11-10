# backend/Routes/activities.py
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timedelta, timezone, time, date
from Modules.SQL.db_handler import get_client
from Modules.Sync import sync_handler
from Configs.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_SPLITS,
    TABLE_ACTIVITIES_LAPS,
)

from Services.time import parse_date_ymd

router = APIRouter(prefix="/activities", tags=["activities"])
supabase = get_client()

# -------- endpoints -----------------------------------------------------------
# GET: posledných X dní (default 30)
@router.get("/{user_id}")
def get_activities(user_id: int, days: int = 30):
    try:
        since_date = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()

        rec = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select(
                "activity_id,name,"
                "sport_type,sport_type_fe,sport_type_ovrd,"
                "distance_m,moving_time_s,average_heartrate_bpm,max_heartrate_bpm,date"
            )
            .eq("user_id", user_id)
            .gte("date", since_date)
            .order("date", desc=True)
            .execute()
        )

        data = rec.data or []

        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# GET: detail (summary + laps + splits)
@router.get("/detail/{activity_id}")
def get_activity_detail(activity_id: int):
    try:
        summary_res = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("activity_id", activity_id)
            .limit(1)
            .execute()
        )
        summary = summary_res.data[0] if summary_res.data else None

        laps_res = (
            supabase.table(TABLE_ACTIVITIES_LAPS)
            .select("*")
            .eq("activity_id", activity_id)
            .order("lap_index", desc=False)
            .execute()
        )

        splits_res = (
            supabase.table(TABLE_ACTIVITIES_SPLITS)
            .select("*")
            .eq("activity_id", activity_id)
            .order("split_index", desc=False)
            .execute()
        )

        return {
            "success": True,
            "summary": summary,
            "laps": laps_res.data or [],
            "splits": splits_res.data or [],
        }

    except Exception as e:
        print("❌ get_activity_detail error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# POST: sync – vráti importované/aktualizované/skipnuté
@router.post("/sync/{user_id}")
def sync_activities_route(user_id: int):
    try:
        res = sync_handler.sync_activities(user_id, force_last_days=30, fetch_details=True)
        return {"success": True, **res}
    except Exception as e:
        return {"success": False, "detail": str(e)}


@router.get("/range/{user_id}")
def activities_in_range(user_id: int, start: str, end: str):
    """
    Aktivity v rozsahu [start, end] vrátane.
    Stĺpec 'date' je timestamp -> použijeme < (end + 1 deň) ako exkluzívnu hornú hranicu.
    """
    try:
        # → urob z ISO stringov naozaj 'date'
        start_d = date.fromisoformat(start)
        end_d   = date.fromisoformat(end)

        # 00:00:00Z na začiatku 'start', a 00:00:00Z nasledujúceho dňa po 'end' (exkluzívne)
        start_ts = datetime.combine(start_d, time(0, 0, 0, tzinfo=timezone.utc))
        end_ts   = datetime.combine(end_d,   time(0, 0, 0, tzinfo=timezone.utc)) + timedelta(days=1)

        print(f"[BE] /activities/range user_id={user_id} start={start_ts.isoformat()} end<{end_ts.isoformat()}")

        res = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select(
                # ⬇️ pridávame FE/override, aby sa tabuľka zhodovala s grafom
                "activity_id,name,"
                "sport_type,sport_type_fe,sport_type_ovrd,"
                "distance_m,moving_time_s,average_heartrate_bpm,max_heartrate_bpm,date"
            )
            .eq("user_id", user_id)
            .gte("date", start_ts.isoformat())
            .lt("date",  end_ts.isoformat())   # end exkluzívne
            .order("date", desc=True)
            .execute()
        )

        data = res.data or []
        print(f"[BE] /activities/range -> {len(data)} rows")
        return {
            "success": True,
            "data": data,
            "range": {"start": start_d.isoformat(), "end": end_d.isoformat()},
        }

    except Exception as e:
        print("[BE] /activities/range error:", e)
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/select/{user_id}")
def select_activities(
    user_id: int,
    date: str = Query(..., description="YYYY-MM-DD"),
    delta_days: int = Query(1, ge=0, le=7),
    sports: str = Query("run,mixed", description="comma-separated sport_type_fe"),
):
    """
    Vráti aktivity v okne ±delta_days od dátumu (vrátane),
    filtrované podľa sport_type_fe (CSV). Minimal payload pre picker.
    """
    try:
        center = parse_date_ymd(date)
        date_from = (center - timedelta(days=delta_days)).isoformat()
        date_to   = (center + timedelta(days=delta_days)).isoformat()
        sport_list = [s.strip() for s in sports.split(",") if s.strip()]

        q = (
            supabase
            .table(TABLE_ACTIVITIES_SUMMARY)
            .select(
                "activity_id,name,"
                "sport_type_fe,"
                "date,"                      # ISO date/time
                "distance_m,moving_time_s"
            )
            .eq("user_id", user_id)
            .gte("date", date_from)
            .lte("date", date_to)
            .order("date", desc=False)
        )
        if sport_list:
            q = q.in_("sport_type_fe", sport_list)

        rec = q.execute()
        rows = rec.data or []

        items = []
        for r in rows:
            items.append({
                "id": r.get("activity_id"),
                "name": r.get("name") or "",
                "start_date": r.get("date"),
                "sport": r.get("sport_type_fe"),
                "distance_km": (r.get("distance_m") or 0) / 1000 if r.get("distance_m") is not None else None,
                "duration_min": (r.get("moving_time_s") or 0) / 60 if r.get("moving_time_s") is not None else None,
            })

        return {"success": True, "count": len(items), "items": items}

    except HTTPException:
        raise
    except Exception as e:
        print("❌ select_activities error:", e)
        raise HTTPException(status_code=500, detail=str(e))
        
        
@router.get("/summary/one/{activity_id}")
def get_summary_one(activity_id: int):
    rec = (supabase.table(TABLE_ACTIVITIES_SUMMARY)
           .select("activity_id,name,date,distance_m,moving_time_s,average_heartrate_bpm,max_heartrate_bpm,sport_type_fe")
           .eq("activity_id", activity_id).limit(1).execute())
    row = (rec.data or [None])[0]
    if not row:
        raise HTTPException(status_code=404, detail="activity not found")
    return {"success": True, "summary": row}

@router.get("/streams/one/{activity_id}")
def get_streams_one(activity_id: int):
    rec = (supabase.table(TABLE_ACTIVITIES_SPLITS)  # uprav ak máš iný zdroj HR streamu
           .select("time_s,hr").eq("activity_id", activity_id).order("time_s").execute())
    rows = rec.data or []
    xs = [r.get("time_s") for r in rows if r.get("time_s") is not None]
    ys = [r.get("hr") for r in rows]
    return {"success": True, "streams": {"time_s": xs, "hr": ys, "duration_s": (xs[-1] if xs else 0)}}

@router.get("/detail/one/{activity_id}")
def get_detail_one(activity_id: int):
    laps = (supabase.table(TABLE_ACTIVITIES_LAPS)
            .select("lap_index,distance_m,moving_time_s")
            .eq("activity_id", activity_id).order("lap_index").execute()).data or []
    splits = (supabase.table(TABLE_ACTIVITIES_SPLITS)
              .select("split_index,distance_m,moving_time_s")
              .eq("activity_id", activity_id).order("split_index").execute()).data or []
    return {"success": True, "laps": laps, "splits": splits}