# Routes/streams_zones.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from Services.activity_zones import preview_zones_for_activities, upsert_enrichment_minutes,backfill_enrichment_for_period

router = APIRouter(prefix="/streams", tags=["streams"])

# POST { "ids":[...], "fetch": true }
class ZonesReq(BaseModel):
    ids: List[int]
    fetch: Optional[bool] = True

@router.post("/zones/{user_id}")
def zones_preview_post(user_id: int, body: ZonesReq):
    return preview_zones_for_activities(user_id, body.ids or [], fetch_if_missing=bool(body.fetch))

@router.get("/streams/zones/{user_id}")
def streams_zones_preview(user_id: int, ids: str, fetch: int = 0, save: int = 0):
    """
    ids = 'aid1,aid2,...'
    fetch=1  -> ak chýbajú streamy v DB, dotiahne ich zo Stravy a uloží do activities_streams
    save=1   -> po výpočte minút uloží aj do activities_enrichment
    """
    activity_ids = [int(x) for x in ids.split(",") if x.strip().isdigit()]

    res = preview_zones_for_activities(
        user_id=user_id,
        activity_ids=activity_ids,
        fetch_if_missing=bool(fetch)
    )
    # res: {"ok":True,"user_id":...,"zones":{...},"items":[{activity_id, ok, minutes,...}, ...]}

    if save and res.get("ok") and res.get("items"):
        # zober len tie, ktoré majú minutes
        items_with_minutes = [it for it in res["items"] if it.get("ok") and it.get("minutes")]
        save_info = upsert_enrichment_minutes(user_id, items_with_minutes)
        res["save"] = save_info  # napr. {"saved": N}

    return res


@router.get("/zones/{user_id}")
def zones_preview(
    user_id: int,
    ids: str = Query(..., description="CSV activity_id (napr. 161...,101...)"),
    fetch: int = 0,   # 1 = dotiahni chýbajúce streams zo Stravy a ulož do activities_streams
    save: int = 0     # 1 = zapíš minúty do activities_enrichment
):
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
    fetch: int = 1,     # 1 = dotiahni chýbajúce streamy zo Stravy
    save: int = 1,      # 1 = ulož do activities_enrichment
    batch: int = 25,
):
    res = backfill_enrichment_for_period(
        user_id=user_id,
        months=months,
        fetch_if_missing=bool(fetch),
        save=bool(save),
        batch=batch,
    )
    return res
