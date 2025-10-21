# Routes/streams.py
from __future__ import annotations
from fastapi import APIRouter, Query
from typing import List, Optional
from Modules.API.Strava.streams import fetch_and_optionally_store_batch

router = APIRouter(prefix="/streams", tags=["streams"])

# 1) jeden activity_id (GET)
@router.get("/cache/{user_id}/{activity_id}")
def cache_one(user_id: int, activity_id: int, store: int = 0):
    res = fetch_and_optionally_store_batch(user_id, [int(activity_id)], store=bool(store))
    # pre jeden kus vrátime priamo detail
    item = (res.get("items") or [{}])[0]
    return item

# 2) batch z query paramu ids=1,2,3 (GET)
@router.get("/cache/{user_id}")
def cache_many(user_id: int, ids: str, store: int = 0):
    try:
        id_list = [int(x) for x in ids.split(",") if x.strip()]
    except Exception:
        id_list = []
    return fetch_and_optionally_store_batch(user_id, id_list, store=bool(store))

# 3) batch z JSON body (POST)
from pydantic import BaseModel
class CacheReq(BaseModel):
    ids: List[int]
    store: Optional[bool] = False

@router.post("/cache/{user_id}")
def cache_many_post(user_id: int, body: CacheReq):
    return fetch_and_optionally_store_batch(user_id, body.ids or [], store=bool(body.store))