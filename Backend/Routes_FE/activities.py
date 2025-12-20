# backend/Routes_FE/activities.py

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from Schemas.synchronization import (
    SyncActivitiesRequest,
    SyncActivitiesResponse,
)
from Services.synchronization import service_sync_activities

from Services.activities_summary import (
    service_get_activities,
    service_activities_in_range,
    service_select_activities,
    service_get_summary_one,

)

from Services.analytics import (
    service_get_activity_detail,
    service_get_detail_one,
    service_get_streams_one,
)


# zóny / enrichment
from Services.activity_zones import (
    preview_zones_for_activities,
    upsert_enrichment_minutes,
    backfill_enrichment_for_period,
)

router = APIRouter(prefix="/activities", tags=["activities"])


# ───────────────────────────── Activities – basic list/detail ─────────────────────────────

# GET: posledných X dní (default 30)
@router.get("/{user_id}")
def get_activities(user_id: int, days: int = 30):
    try:
        data = service_get_activities(user_id=user_id, days=days)
        return {"success": True, "data": data}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# GET: detail (summary + laps + splits)
@router.get("/detail/{activity_id}")
def get_activity_detail(user_id: int, activity_id: int):
    try:
        payload = service_get_activity_detail(user_id = user_id, activity_id=activity_id)
        return {
            "success": True,
            **payload,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ───────────────────────────── Sync Strava ─────────────────────────────

@router.post("/sync/{user_id}", response_model=SyncActivitiesResponse)
def sync_activities_endpoint(
    user_id: int,
    payload: SyncActivitiesRequest,
) -> Dict[str, Any]:
    """
    Spustí Strava sync pre daného usera.
    Body:
      - force_last_days: int | null (default 30)
      - fetch_details: bool (default True)
    """
    try:
        stats = service_sync_activities(
            user_id=user_id,
            force_last_days=payload.force_last_days,
            fetch_details=payload.fetch_details,
        )
        return {
            "success": True,
            "stats": stats,
            "note": None,
        }
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ───────────────────────────── Activities – range / select ─────────────────────────────

@router.get("/range/{user_id}")
def activities_in_range(user_id: int, start: str, end: str):
    """
    Aktivity v rozsahu [start, end] vrátane.
    """
    try:
        payload = service_activities_in_range(
            user_id=user_id,
            start=start,
            end=end,
        )
        return {
            "success": True,
            **payload,
        }
    except Exception as e:  # noqa: BLE001
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
        payload = service_select_activities(
            user_id=user_id,
            date_str=date,
            delta_days=delta_days,
            sports_csv=sports,
        )
        return {
            "success": True,
            **payload,
        }
    except Exception as e:  # noqa: BLE001
        print("❌ select_activities error:", e)
        raise HTTPException(status_code=500, detail=str(e))


# ───────────────────────────── Activities – single summary/streams/detail ─────────────────────────────

@router.get("/summary/one/{activity_id}")
def get_summary_one(activity_id: int):
    try:
        summary = service_get_summary_one(activity_id=activity_id)
        return {"success": True, "summary": summary}
    except ValueError:
        raise HTTPException(status_code=404, detail="activity not found")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/streams/one/{user_id}/{activity_id}")
def get_streams_one(
    activity_id: int,
    user_id: int,
):
    try:
        streams = service_get_streams_one(
            user_id=user_id,
            activity_id=activity_id,
        )
        return {"success": True, "streams": streams}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/detail/one/{user_id}/{activity_id}")
def get_detail_one(user_id: int,
                   activity_id: int):
    try:
        payload = service_get_detail_one(user_id = user_id, activity_id=activity_id)
        return {"success": True, **payload}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


# ───────────────────────────── Zones / enrichment (pôvodné streams_zones) ─────────────────────────────

class ZonesReq(BaseModel):
    ids: List[int]
    fetch: Optional[bool] = True


# POST – JSON body s ids, fetch; aliasujeme aj starú cestu /streams/zones/{user_id}
@router.post("/zones/{user_id}")
@router.post("/streams/zones/{user_id}")
def zones_preview_post(user_id: int, body: ZonesReq):
    """
    POST /activities/zones/{user_id}
    (alias: /activities/streams/zones/{user_id})

    Body:
      {
        "ids": [activity_id...],
        "fetch": true|false
      }
    """
    res = preview_zones_for_activities(
        user_id, body.ids or [], fetch_if_missing=bool(body.fetch)
    )
    return res


# GET – query ids, fetch, save; alias pre starý path
@router.get("/zones/{user_id}")
@router.get("/streams/zones/{user_id}")
def zones_preview_get(
    user_id: int,
    ids: str = Query(..., description="CSV activity_id (napr. 161...,101...)"),
    fetch: int = 0,  # 1 = dotiahni chýbajúce streams zo Stravy a ulož do activities_streams
    save: int = 0,  # 1 = zapíš minúty do activities_enrichment
):
    """
    GET /activities/zones/{user_id}
    (alias: /activities/streams/zones/{user_id})

    ids = 'aid1,aid2,...'
    fetch=1  -> ak chýbajú streamy v DB, dotiahne ich zo Stravy a uloží do activities_streams
    save=1   -> po výpočte minút uloží aj do activities_enrichment
    """
    try:
        activity_ids = [int(x) for x in ids.split(",") if x.strip()]
        print(f"[zones] user={user_id} ids={activity_ids} fetch={fetch} save={save}")

        preview = preview_zones_for_activities(
            user_id=user_id,
            activity_ids=activity_ids,
            fetch_if_missing=bool(fetch),
        )

        saved = 0
        if save and preview.get("items"):
            res = upsert_enrichment_minutes(user_id, preview["items"])
            saved = int(res.get("saved", 0))
            print(f"[zones] saved rows={saved}")

        return {**preview, "saved": saved}
    except Exception as e:
        print("[zones] error:", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/zones/backfill/{user_id}")
def backfill_zones_route(
    user_id: int,
    months: int = 3,
    fetch: int = 1,  # 1 = dotiahni chýbajúce streamy zo Stravy
    save: int = 1,  # 1 = ulož do activities_enrichment
    batch: int = 25,
):
    """
    GET /activities/zones/backfill/{user_id}
    """
    res = backfill_enrichment_for_period(
        user_id=user_id,
        months=months,
        fetch_if_missing=bool(fetch),
        save=bool(save),
        batch=batch,
    )
    return res