# backend/Routes/analytics_pareto8020.py
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from typing import Any, Dict, List
from Modules.SQL.db_handler import get_client
from Modules.config import TABLE_ACTIVITIES_SUMMARY, TABLE_ACTIVITIES_ENRICHMENT
from Services.activity_zones import (
    preview_zones_for_activities,
    upsert_enrichment_minutes,
)

router = APIRouter(prefix="/analytics/pareto8020", tags=["analytics"])
sb = get_client()

def _easy(row: dict) -> int:
    # Easy = Z1 + Z2 (min)
    return int(row.get("z1_min") or 0) + int(row.get("z2_min") or 0)

def _hard(row: dict) -> int:
    # Hard = Z3 + Z4 + Z5 (min)
    return int(row.get("z3_min") or 0) + int(row.get("z4_min") or 0) + int(row.get("z5_min") or 0)

def _iso(s: datetime) -> str:
    return s.strftime("%Y-%m-%dT%H:%M:%S%z")

@router.get("/widget/{user_id}")
def pareto_widget(user_id: int, days: int = 14, sport: str = "all") -> Dict[str, Any]:
    """Sumár za posledné `days` (pre widget)."""
    try:
        since = datetime.now(timezone.utc) - timedelta(days=int(days))
        since_iso = _iso(since)

        q = (sb.table(TABLE_ACTIVITIES_SUMMARY)
               .select("activity_id,date,sport_type_fe")
               .eq("user_id", user_id)
               .gte("date", since_iso))
        if sport and sport != "all":
            q = q.eq("sport_type_fe", sport)
        ids_rows = q.order("date", desc=True).execute()
        ids = [int(r["activity_id"]) for r in (ids_rows.data or [])]

        if ids:
            prev = preview_zones_for_activities(user_id, ids, fetch_if_missing=True)
            if prev.get("ok"):
                upsert_enrichment_minutes(user_id, prev.get("items") or [])

        enr = (sb.table(TABLE_ACTIVITIES_ENRICHMENT)
                 .select("z1_min,z2_min,z3_min,z4_min,z5_min")
                 .eq("user_id", user_id)
                 .in_("activity_id", ids or [0])
                 .execute())
        easy = sum(_easy(r) for r in (enr.data or []))
        hard = sum(_hard(r) for r in (enr.data or []))
        total = easy + hard
        return {
            "success": True,
            "data": {
                "easy_min": int(easy),
                "hard_min": int(hard),
                "total_min": int(total),
                "days": int(days),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}")
def pareto_trend(user_id: int, weeks: int = 8, sport: str = "all") -> Dict[str, Any]:
    """
    Trend po týždňoch (za posledných `weeks` týždňov).
    Vracia pole [{ label: '13–19.10.', easy_pct, hard_pct, easy_min, hard_min }, ...]
    """
    try:
        # vezmeme ~weeks+1 týždňov dozadu ako buffer
        since = datetime.now(timezone.utc) - timedelta(weeks=int(weeks)+1)
        since_iso = _iso(since)

        q = (sb.table(TABLE_ACTIVITIES_SUMMARY)
               .select("activity_id,date,sport_type_fe")
               .eq("user_id", user_id)
               .gte("date", since_iso))
        if sport and sport != "all":
            q = q.eq("sport_type_fe", sport)
        rows = q.order("date", desc=False).execute().data or []
        ids = [int(r["activity_id"]) for r in rows]

        if ids:
            prev = preview_zones_for_activities(user_id, ids, fetch_if_missing=True)
            if prev.get("ok"):
                upsert_enrichment_minutes(user_id, prev.get("items") or [])

        # enrichment join + agregácia po ISO-týždňoch
        # načítaj enrichment pre dané ids
        enr = (sb.table(TABLE_ACTIVITIES_ENRICHMENT)
                 .select("activity_id,z1_min,z2_min,z3_min,z4_min,z5_min")
                 .eq("user_id", user_id)
                 .in_("activity_id", ids or [0])
                 .execute()).data or []

        # map activity_id -> (easy,hard)
        emap = { int(r["activity_id"]): (_easy(r), _hard(r)) for r in enr }

        # zoskup podľa ISO týždňa z summary
        buckets: Dict[str, Dict[str, Any]] = {}
        def week_key(iso_date: str) -> str:
            # iso_date je timestamp string z DB -> len berieme prvých 10 dní
            d = datetime.fromisoformat(iso_date[:19])
            y, w, _ = d.isocalendar()
            # label (kratký rozsah)
            start = d - timedelta(days=d.weekday())
            end   = start + timedelta(days=6)
            lab = f"{start.day}–{end.day}.{end.month}."
            return f"{y}-W{w:02d}|{lab}"

        for r in rows:
            aid = int(r["activity_id"])
            key = week_key(r["date"])
            if key not in buckets:
                buckets[key] = {"easy": 0, "hard": 0}
            e, h = emap.get(aid, (0, 0))
            buckets[key]["easy"] += int(e)
            buckets[key]["hard"] += int(h)

        # zoradenie a orez na posledných `weeks`
        ordered = sorted(buckets.items(), key=lambda kv: kv[0])[-int(weeks):]

        out: List[Dict[str, Any]] = []
        for k, v in ordered:
            label = k.split("|", 1)[1]
            e = int(v["easy"]); h = int(v["hard"]); t = e + h
            ep = int(round(100 * e / t)) if t else 0
            hp = max(0, 100 - ep)
            out.append({"label": label, "easy_pct": ep, "hard_pct": hp, "easy_min": e, "hard_min": h})

        return {"success": True, "data": out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))