# backend/Routes/activities.py
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone
from Modules.SQL.db_handler import get_client
from Modules.Sync import sync_handler
from Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_SPLITS,
    TABLE_ACTIVITIES_LAPS
)

router = APIRouter(prefix="/activities", tags=["activities"])
supabase = get_client()


# --- GET: posledné X dní summary ---
@router.get("/{user_id}")
def get_activities(user_id: int, days: int = 30):
    try:
        since_date = (
            (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
        )
        print(f"➡️ get_activities: user_id={user_id}, since_date={since_date}")

        rec = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("user_id", user_id)
            .gte("date", since_date)
            .order("date", desc=True)
            .execute()
        )

        print(f"➡️ get_activities: DB response count={len(rec.data)}")

        return {"success": True, "data": rec.data}
    except Exception as e:
        print("❌ get_activities error:", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/detail/{activity_id}")
def get_activity_detail(activity_id: int):
    try:
        print(f"➡️ get_activity_detail: activity_id={activity_id}")

        summary_res = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("activity_id", activity_id)  # dôležité, používame activity_id
            .limit(1)
            .execute()
        )

        print(f"➡️ detail: summary count={len(summary_res.data)}")
        if summary_res.data:
            print("➡️ detail: summary row keys =", list(summary_res.data[0].keys()))

        laps_res = (
            supabase.table(TABLE_ACTIVITIES_LAPS)
            .select("*")
            .eq("activity_id", activity_id)
            .execute()
        )
        print(f"➡️ detail: laps count={len(laps_res.data)}")

        splits_res = (
            supabase.table(TABLE_ACTIVITIES_SPLITS)
            .select("*")
            .eq("activity_id", activity_id)
            .execute()
        )
        print(f"➡️ detail: splits count={len(splits_res.data)}")

        return {
            "success": True,
            "summary": summary_res.data[0] if summary_res.data else None,
            "laps": laps_res.data,
            "splits": splits_res.data,
        }

    except Exception as e:
        print("❌ get_activity_detail error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/{user_id}")
def sync_activities(user_id: int):
    """
    Spustí synchronizáciu aktivít pre usera (max posledných 30 dní).
    Sync sa vykoná priamo a FE dostane odpoveď až po dokončení.
    """
    try:
        saved = sync_handler.sync_activities(user_id, False, False)
        return {"success": True, "message": f"✅ Hotovo, uložených {saved} aktivít"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
