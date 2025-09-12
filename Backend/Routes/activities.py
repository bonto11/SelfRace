# backend/Routes/activities.py
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone, date
from typing import List, Dict, Any
from Modules.SQL.db_handler import get_client
from Modules.Sync import sync_handler
from Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_SPLITS,
    TABLE_ACTIVITIES_LAPS,
)

router = APIRouter(prefix="/activities", tags=["activities"])
supabase = get_client()


# -------- helpers -------------------------------------------------------------

def _iso_date(d: datetime | date | str) -> str:
    """Normalize to YYYY-MM-DD (string)."""
    if isinstance(d, str):
        return d[:10]
    if isinstance(d, datetime):
        return d.date().isoformat()
    return d.isoformat()


def _parse_sync_result(res: Any) -> dict[str, int]:
    """
    Prijme rôzne formáty zo sync_handler-a a vráti počty imported/updated/skipped/count.
    Podporované:
      - int -> berieme ako imported, updated=0, skipped=0
      - tuple/list[imported, updated, (skipped?)]
      - dict s kľúčmi imported/updated/skipped/count
    """
    imported = updated = skipped = 0
    count = 0

    try:
        if isinstance(res, dict):
            imported = int(res.get("imported", 0) or 0)
            updated = int(res.get("updated", 0) or 0)
            skipped = int(res.get("skipped", 0) or 0)
            if "count" in res and res["count"] is not None:
                count = int(res["count"])
            else:
                count = imported + updated + skipped

        elif isinstance(res, (list, tuple)):
            if len(res) >= 1:
                imported = int(res[0] or 0)
            if len(res) >= 2:
                updated = int(res[1] or 0)
            if len(res) >= 3:
                skipped = int(res[2] or 0)
            count = imported + updated + skipped

        else:
            # napr. res je číslo - celkový počet uložených
            cnt = int(res or 0)
            imported = cnt
            count = cnt

    except Exception:
        # fallback – nech endpoint nikdy nespadne na castoch
        pass

    return {"imported": imported, "updated": updated, "skipped": skipped, "count": count}


# -------- endpoints -----------------------------------------------------------

# GET: posledných X dní (default 30)
@router.get("/{user_id}")
def get_activities(user_id: int, days: int = 30):
    try:
        since_date = (
            (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
        )
        print(f"➡️ get_activities: user_id={user_id}, since_date={since_date}")

        rec = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select(
                "activity_id,name,sport_type,distance_m,moving_time_s,"
                "average_heartrate_bpm,max_heartrate_bpm,date"
            )
            .eq("user_id", user_id)
            .gte("date", since_date)
            .order("date", desc=True)
            .execute()
        )

        print(f"➡️ get_activities: DB response count={len(rec.data or [])}")
        return {"success": True, "data": rec.data or []}

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

        print(
            f"➡️ detail: laps={len(laps_res.data or [])}, "
            f"splits={len(splits_res.data or [])}"
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

# GET: aktivity v rozsahu [start, end] (vrátane)
@router.get("/range/{user_id}")
def activities_in_range(user_id: int, start: str, end: str):
    """
    Vráti aktivity v rozsahu [start, end] (ISO YYYY-MM-DD).
    """
    try:
        start_d = _iso_date(start)
        end_d = _iso_date(end)
        print(f"[BE] /activities/range user_id={user_id} start={start_d} end={end_d}")

        res = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select(
                "activity_id,name,sport_type,distance_m,moving_time_s,"
                "average_heartrate_bpm,max_heartrate_bpm,date"
            )
            .eq("user_id", user_id)
            .gte("date", start_d)
            .lte("date", end_d)
            .order("date", desc=True)
            .execute()
        )
        data = res.data or []
        print(f"[BE] /activities/range -> {len(data)} rows")
        return {"success": True, "data": data, "range": {"start": start_d, "end": end_d}}

    except Exception as e:
        print("[BE] /activities/range error:", e)
        raise HTTPException(status_code=500, detail=str(e))