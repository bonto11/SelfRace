# Routes/analytics_pareto8020.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from Modules.SQL.db_handler import get_client
from Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_ENRICHMENT,
)

from Services.activity_zones import preview_zones_for_activities, upsert_enrichment_minutes

router = APIRouter(prefix="/analytics/pareto8020", tags=["analytics"])
sb = get_client()


def _monday(dt: datetime) -> datetime:
    # ISO týždeň – posuň na pondelok 00:00 UTC
    d = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return d - timedelta(days=d.weekday())

def _wk_label(monday_dt: datetime) -> str:
    # "22.–28.9." (lokálne jednoduché)
    start = monday_dt
    end   = monday_dt + timedelta(days=6)
    s = f"{start.day}.–{end.day}.{end.month}."
    return s

def _to_dt(val: Any) -> Optional[datetime]:
    if not val:
        return None
    s = str(val)
    s = s.replace(" ", "T").replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
    except Exception:
        return None

def _nint(x: Any) -> int:
    try:
        return int(round(float(x)))
    except Exception:
        return 0
    
def _iso_midnight_utc_minus_days(days: int) -> str:
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=max(1, days))).replace(hour=0, minute=0, second=0, microsecond=0)
    return start.strftime("%Y-%m-%d")

# ---------- GET /analytics/pareto8020/{user_id}?weeks=8&sport=all ----------
@router.get("/{user_id}")
def pareto_weeks(user_id: int, weeks: int = 8, sport: str = "all"):
    """
    Vráti weekly trend (posledných 2/4/8/12 týždňov):
      [{ label, week_start, easy_min, hard_min, total_min, easy_pct, hard_pct }]
    Filter: sport_type_fe == sport (ak sport != 'all')
    """
    weeks = max(2, min(12, int(weeks)))
    today = datetime.now(timezone.utc)
    start_monday = _monday(today) - timedelta(weeks=weeks-1)

    # 1) summary → activity_id + date + sport (na filter + zaradenie do týždňov)
    q = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("activity_id,date,sport_type_fe")
        .eq("user_id", user_id)
        .gte("date", start_monday.strftime("%Y-%m-%d"))
    )
    if sport and sport.lower() != "all":
        q = q.eq("sport_type_fe", sport.lower())
    res = q.execute()

    if not res.data:
        return {"success": True, "data": []}

    # zoskup podľa týždňa a priprav zoznam id → týždeň
    by_week_ids: Dict[str, List[int]] = {}
    week_labels: Dict[str, str] = {}

    for r in res.data:
        aid = _nint(r.get("activity_id"))
        dt  = _to_dt(r.get("date"))
        if not aid or not dt:
            continue
        wk = _monday(dt).strftime("%Y-%m-%d")
        by_week_ids.setdefault(wk, []).append(aid)
        if wk not in week_labels:
            week_labels[wk] = _wk_label(_monday(dt))

    # 2) enrichment → načítaj všetky záznamy pre tieto activity_id
    all_ids = [aid for ids in by_week_ids.values() for aid in ids]
    chunks = [all_ids[i:i+500] for i in range(0, len(all_ids), 500)]

    enr: Dict[int, Dict[str,int]] = {}
    for ch in chunks:
        if not ch: continue
        er = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
            .select("activity_id,z1_min,z2_min,z3_min,z4_min,z5_min")
            .in_("activity_id", ch)
            .execute()
        )
        for row in er.data or []:
            enr[int(row["activity_id"])] = {
                "z1": _nint(row.get("z1_min")),
                "z2": _nint(row.get("z2_min")),
                "z3": _nint(row.get("z3_min")),
                "z4": _nint(row.get("z4_min")),
                "z5": _nint(row.get("z5_min")),
            }

    # 3) agregácia do týždňov
    out: List[Dict[str, Any]] = []
    # zoradíme týždne chronologicky
    week_keys_sorted = sorted(by_week_ids.keys())
    for wk in week_keys_sorted:
        z1=z2=z3=z4=z5=0
        for aid in by_week_ids[wk]:
            z = enr.get(aid)
            if not z: 
                continue
            z1 += z["z1"]; z2 += z["z2"]; z3 += z["z3"]; z4 += z["z4"]; z5 += z["z5"]
        easy = z1 + z2
        hard = z3 + z4 + z5
        total = max(1, easy + hard)
        out.append({
            "label": week_labels.get(wk, wk),
            "week_start": wk,
            "easy_min": easy,
            "hard_min": hard,
            "total_min": total,
            "easy_pct": round(100.0 * easy / total, 1),
            "hard_pct": round(100.0 * hard / total, 1),
        })

    return {"success": True, "weeks": weeks, "sport": sport, "data": out}

# ---------- GET /analytics/pareto8020/widget/{user_id}?weeks=2&sport=all ----------
@router.get("/widget/{user_id}")
def pareto_widget(user_id: int, days: int = 14, sport: str = "all") -> Dict[str, Any]:
    """
    Widget 80/20 za posledných `days` dní (default 14).
    - najprv zabezpečí enrichment (streamy + výpočet) pre aktivity v rozsahu,
    - potom agreguje a vráti easy/hard/total.
    """
    try:
        start_iso = _iso_midnight_utc_minus_days(days)
        # 1) activity_ids v rozsahu (podľa date v summary)
        q = (
            sb.table(TABLE_ACTIVITIES_SUMMARY)
              .select("activity_id,sport_type_fe,date")
              .eq("user_id", user_id)
              .gte("date", start_iso)
              .order("date", desc=True)
        )
        if sport and sport != "all":
            q = q.eq("sport_type_fe", sport)
        res = q.execute()
        ids = [int(r["activity_id"]) for r in (res.data or []) if r.get("activity_id")]

        if ids:
            # 2) self-heal: spočítaj chýbajúce enrichment
            prev = preview_zones_for_activities(user_id, ids, fetch_if_missing=True)
            if prev.get("ok"):
                upsert_enrichment_minutes(user_id, prev.get("items") or [])

        # 3) agregácia z enrichment (po self-heal-e)
        q2 = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
              .select("z1_min,z2_min,z3_min,z4_min,z5_min,activity_id")
              .eq("user_id", user_id)
        )
        if ids:
            q2 = q2.in_("activity_id", ids)  # filtrujeme len aktuálne obdobie
        agg = q2.execute()

        z1 = sum(int(r.get("z1_min") or 0) for r in (agg.data or []))
        z2 = sum(int(r.get("z2_min") or 0) for r in (agg.data or []))
        z3 = sum(int(r.get("z3_min") or 0) for r in (agg.data or []))
        z4 = sum(int(r.get("z4_min") or 0) for r in (agg.data or []))
        z5 = sum(int(r.get("z5_min") or 0) for r in (agg.data or []))

        easy = z1 + z2                  # tvoja definícia 80
        hard = z4 + z5                  # tvoja definícia 20 (z3 = neutrál)
        total = easy + z3 + hard

        return {
            "success": True,
            "data": {
                "easy_min": easy,
                "hard_min": hard,
                "total_min": total,
                "days": int(days),
                "count": len(ids),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))