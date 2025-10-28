# backend/Routes/activities.py
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone, time, date
from Services.time import iso_date
from Modules.SQL.db_handler import get_client
from Modules.Sync import sync_handler
from backend.Configs.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_SPLITS,
    TABLE_ACTIVITIES_LAPS,
)

router = APIRouter(prefix="/activities", tags=["activities"])
supabase = get_client()

# -------- endpoints -----------------------------------------------------------
# GET: posledných X dní (default 30)
@router.get("/{user_id}")
def get_activities(user_id: int, days: int = 30):
    try:
        since_date = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
        print(f"➡️ get_activities: user_id={user_id}, since_date={since_date}")

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
        print(f"➡️ get_activities: DB response count={len(data)}")
        return {"success": True, "data": data}

    except Exception as e:
        print("❌ get_activities error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# GET: detail (summary + laps + splits)
@router.get("/detail/{activity_id}")
def get_activity_detail(activity_id: int):
    try:
        print(f"➡️ get_activity_detail: activity_id={activity_id}")

        summary_res = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("activity_id", activity_id)
            .limit(1)
            .execute()
        )
        summary = summary_res.data[0] if summary_res.data else None
        print(f"➡️ detail: summary found={bool(summary)}")

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

        print(f"➡️ detail: laps={len(laps_res.data or [])}, splits={len(splits_res.data or [])}")

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