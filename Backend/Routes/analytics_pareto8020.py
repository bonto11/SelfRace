# backend/Routes/analytics_pareto8020.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone
from typing import List, Any, Dict
from Modules.SQL.db_handler import get_client
from Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_ENRICHMENT,
)
from Services.activity_zones import (
    preview_zones_for_activities,
    upsert_enrichment_minutes,
)

router = APIRouter(prefix="/analytics/pareto8020", tags=["analytics"])
sb = get_client()

@router.get("/widget/{user_id}")
def pareto_widget(user_id: int, days: int = 14, sport: str = "all"):
    try:
        # 1️⃣ Spočítaj začiatok obdobia
        since = datetime.now(timezone.utc) - timedelta(days=int(days))
        since_iso = since.strftime("%Y-%m-%dT%H:%M:%S%z")  # ISO formát, ktorý Supabase akceptuje

        # 2️⃣ activity_ids z posledného obdobia
        q = (
            sb.table(TABLE_ACTIVITIES_SUMMARY)
            .select("activity_id")
            .eq("user_id", user_id)
            .gte("date", since_iso)
        )

        if sport and sport != "all":
            q = q.eq("sport_type_fe", sport)

        ids_rows = q.order("date", desc=True).execute()
        ids = [int(r["activity_id"]) for r in (ids_rows.data or []) if r.get("activity_id")]

        print(f"[pareto8020] user={user_id} days={days} found_ids={len(ids)}")

        if not ids:
            return {"success": True, "data": {"easy_min": 0, "hard_min": 0, "total_min": 0, "easy_pct": 0, "hard_pct": 0}}

        # enrichment výpočet
        prev = preview_zones_for_activities(user_id, ids, fetch_if_missing=True)
        if prev.get("ok"):
            upsert_enrichment_minutes(user_id, prev.get("items") or [])

        q2 = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
            .select("z1_min,z2_min,z3_min,z4_min,z5_min")
            .eq("user_id", user_id)
            .in_("activity_id", ids)
        )
        agg = q2.execute()

        z1=z2=z3=z4=z5=0
        for r in (agg.data or []):
            z1 += int(r.get("z1_min") or 0)
            z2 += int(r.get("z2_min") or 0)
            z3 += int(r.get("z3_min") or 0)
            z4 += int(r.get("z4_min") or 0)
            z5 += int(r.get("z5_min") or 0)

        easy = z1 + z2
        hard = z3 + z4 + z5
        total = easy + hard
        easy_pct = round((easy / total) * 100) if total > 0 else 0
        hard_pct = 100 - easy_pct if total > 0 else 0

        print(f"[pareto8020] enrichment_rows={len(agg.data or [])} easy={easy} hard={hard} total={total}")

        return {
            "success": True,
            "data": {
                "easy_min": int(easy),
                "hard_min": int(hard),
                "total_min": int(total),
                "easy_pct": int(easy_pct),
                "hard_pct": int(hard_pct),
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))