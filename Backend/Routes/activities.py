from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone
from Modules.SQL.db_handler import get_client
from Modules.SQL.config import TABLE_ACTIVITIES_SUMMARY, TABLE_ACTIVITIES_SPLITS, TABLE_ACTIVITIES_LAPS, TABLE_USERS_PROFILE, TABLE_USERS_ZONES, TABLE_USERS_THRESHOLDS, TABLE_USERS_BESTS, TABLE_USERS_RECOVERY

router = APIRouter(prefix="/activities", tags=["activities"])
supabase = get_client()

@router.get("/{user_id}")
def get_activities(user_id: int, days: int = 30):
    try:
        since_date = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
        rec = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("user_id", user_id)
            .gte("date", since_date)
            .order("date", desc=True)
            .execute()
        )
        return {"success": True, "data": rec.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- GET: detail aktivity podľa ID vrátane laps/splits ---
# --- GET: detail aktivity podľa ID ---
@router.get("/detail/{activity_id}")
def get_activity_detail(activity_id: int):
    try:
        summary = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("activity_id", activity_id)
            .limit(1)
            .execute()
        )

        if not summary.data:
            raise HTTPException(status_code=404, detail="Activity not found")

        laps = (
            supabase.table(TABLE_ACTIVITIES_LAPS)
            .select("*")
            .eq("activity_id", activity_id)
            .order("lap_index")
            .execute()
        )

        splits = (
            supabase.table(TABLE_ACTIVITIES_SPLITS)
            .select("*")
            .eq("activity_id", activity_id)
            .order("split_index")
            .execute()
        )

        return {
            "success": True,
            "summary": summary.data[0],
            "laps": laps.data,
            "splits": splits.data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

