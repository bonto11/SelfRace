# backend/Routes/analytics_pareto8020.py
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from typing import Any, Dict, List, Optional, Set

from Modules.SQL.db_handler import get_client
from backend.Configs.config import TABLE_ACTIVITIES_SUMMARY, TABLE_ACTIVITIES_ENRICHMENT
from backend.Configs.config_sport import (
    DEBUG_PARETO,
    normalize_sport,
    normalize_sport_list,
    PARETO_DEFAULT_SET,
    pareto_meta,
)
from Services.pareto_source import get_pareto_source

router = APIRouter(prefix="/analytics/pareto8020", tags=["analytics"])
sb = get_client()

def _log(*a): 
    if DEBUG_PARETO: 
        print("[PARETO:API]", *a)

# ----------------------- interné helpers ------------------------
def _easy(row: dict) -> int:
    z1 = int(round(float(row.get("z1_min") or 0)))
    z2 = int(round(float(row.get("z2_min") or 0)))
    return z1 + z2

def _hard(row: dict) -> int:
    z3 = int(round(float(row.get("z3_min") or 0)))
    z4 = int(round(float(row.get("z4_min") or 0)))
    z5 = int(round(float(row.get("z5_min") or 0)))
    return z3 + z4 + z5

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")

def _to_dt(s: str) -> datetime:
    x = str(s or "").replace(" ", "T")
    if x.endswith("+00"): x += ":00"
    if x.endswith("Z"):   x = x.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(x)
    except Exception:
        dt = datetime.strptime(x[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

def _week_bucket(dt: datetime) -> Dict[str, str]:
    dt = dt.astimezone(timezone.utc)
    start = dt - timedelta(days=dt.weekday())
    end   = start + timedelta(days=6)
    year, week, _ = start.isocalendar()
    key = f"{year}-W{week:02d}"
    label = f"{start.day}–{end.day}.{end.month}."
    return {"key": key, "label": label, "start": start.isoformat(), "end": end.isoformat()}

def _parse_sport_query(sport: str | None) -> Optional[Set[str]]:
    """
    Podporuje:
      - sport="all" -> None (použije sa default whitelist)
      - sport="run" -> {"run"}
      - sport="run,ride" -> {"run","ride"}
    """
    if not sport or sport.strip().lower() == "all":
        return None
    parts = [p.strip() for p in str(sport).split(",") if p.strip()]
    norm = normalize_sport_list(parts)
    return norm or None

# --------------------------- META -------------------------------
@router.get("/meta")
def pareto_meta_route() -> Dict[str, Any]:
    """
    FE si vie zobraziť, čo presne sa ráta do 80/20 a aké aliasy sú k dispozícii.
    """
    return {"success": True, "data": pareto_meta()}

# --------------------------- SOURCE -----------------------------
@router.get("/source/{user_id}")
def pareto_source(user_id: int, months: int = 3, count_no_hr_as_easy: bool = True) -> Dict[str, Any]:
    """
    Public endpoint pre veľký dataset (na SESSION).
    """
    try:
        res = get_pareto_source(user_id=user_id, months=months, count_no_hr_as_easy=count_no_hr_as_easy)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --------------------------- WIDGET -----------------------------
@router.get("/widget/{user_id}")
def pareto_widget(user_id: int, days: int = 14, sport: str = "all") -> Dict[str, Any]:
    """
    Sumár za posledné `days` (číta iba enrichment).
    - ak sport='all' => berieme iba PARETO_DEFAULT_SET
    - ak sport='run' alebo 'run,ride' => filtrujeme iba tieto športy
    """
    try:
        days = int(days)
        sports = _parse_sport_query(sport)  # None => použi default set
        since_iso = _iso(datetime.now(timezone.utc) - timedelta(days=days))

        rows = (
            sb.table(TABLE_ACTIVITIES_SUMMARY)
            .select("activity_id,date,sport_type_fe")
            .eq("user_id", user_id)
            .gte("date", since_iso)
            .order("date", desc=True)
            .execute()
        ).data or []

        def _norm_db(x: Any) -> Optional[str]:
            return normalize_sport(x)

        if sports is None:
            allowed = PARETO_DEFAULT_SET
            rows = [r for r in rows if _norm_db(r.get("sport_type_fe")) in allowed]
        else:
            rows = [r for r in rows if _norm_db(r.get("sport_type_fe")) in sports]

        ids = [int(r["activity_id"]) for r in rows]
        _log("WIDGET", {"user": user_id, "days": days, "sport": sport, "sports_used": list(sports or PARETO_DEFAULT_SET), "ids": len(ids)})

        if not ids:
            return {"success": True, "data": {"easy_min": 0, "hard_min": 0, "total_min": 0, "days": days}}

        enr = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
            .select("activity_id,z1_min,z2_min,z3_min,z4_min,z5_min")
            .eq("user_id", user_id)
            .in_("activity_id", ids)
            .execute()
        ).data or []

        easy = sum(_easy(r) for r in enr)
        hard = sum(_hard(r) for r in enr)
        total = easy + hard

        return {"success": True, "data": {"easy_min": int(easy), "hard_min": int(hard), "total_min": int(total), "days": days}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------- TREND -----------------------------
@router.get("/{user_id}")
def pareto_trend(user_id: int, weeks: int = 8, sport: str = "all") -> Dict[str, Any]:
    """
    Trend po týždňoch (posledných `weeks` týždňov) s doplnením prázdnych týždňov nulami.
    Podporuje multi-sport query (?sport=run,ride).
    """
    try:
        from Services.activity_zones import preview_zones_for_activities, upsert_enrichment_minutes  # lazy import

        weeks = max(1, int(weeks))
        sports = _parse_sport_query(sport)  # None => default set

        since = datetime.now(timezone.utc) - timedelta(weeks=weeks + 1)
        since_iso = _iso(since)

        rows = (
            sb.table(TABLE_ACTIVITIES_SUMMARY)
            .select("activity_id,date,sport_type_fe")
            .eq("user_id", user_id)
            .gte("date", since_iso)
            .order("date", desc=False)
            .execute()
        ).data or []

        def _norm_db(x: Any) -> Optional[str]:
            return normalize_sport(x)

        if sports is None:
            allowed = PARETO_DEFAULT_SET
            rows = [r for r in rows if _norm_db(r.get("sport_type_fe")) in allowed]
        else:
            rows = [r for r in rows if _norm_db(r.get("sport_type_fe")) in sports]

        if not rows:
            return {"success": True, "data": []}

        # map na týždne
        aid_by_week: Dict[str, List[int]] = {}
        week_meta: Dict[str, Dict[str, str]] = {}
        for r in rows:
            dt = _to_dt(r["date"])
            wb = _week_bucket(dt)
            k = wb["key"]
            aid_by_week.setdefault(k, []).append(int(r["activity_id"]))
            if k not in week_meta:
                week_meta[k] = {"label": wb["label"], "start": wb["start"], "end": wb["end"]}

        # recompute missing enrichment
        all_ids: List[int] = [aid for ids in aid_by_week.values() for aid in ids]
        if all_ids:
            prev = preview_zones_for_activities(user_id, list(set(all_ids)), fetch_if_missing=True)
            if prev.get("ok"):
                upsert_enrichment_minutes(user_id, prev.get("items") or [])

        # načítaj enrichment
        enr = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
            .select("activity_id,z1_min,z2_min,z3_min,z4_min,z5_min")
            .eq("user_id", user_id)
            .in_("activity_id", list(set(all_ids)) or [0])
            .execute()
        ).data or []
        emap = {int(e["activity_id"]): (_easy(e), _hard(e)) for e in enr}

        # kontinuálne posledných `weeks` pondelkov
        today = datetime.now(timezone.utc)
        this_monday = today - timedelta(days=today.weekday())
        keys_ordered: List[str] = []
        for i in range(weeks - 1, -1, -1):
            d = this_monday - timedelta(weeks=i)
            wb = _week_bucket(d)
            keys_ordered.append(wb["key"])
            week_meta.setdefault(wb["key"], {"label": wb["label"], "start": wb["start"], "end": wb["end"]})

        out: List[Dict[str, Any]] = []
        for k in keys_ordered:
            e_sum = h_sum = 0
            for aid in aid_by_week.get(k, []):
                e, h = emap.get(aid, (0, 0))
                e_sum += int(e)
                h_sum += int(h)
            t = e_sum + h_sum
            ep = int(round(100 * e_sum / t)) if t else 0
            hp = max(0, 100 - ep)
            meta = week_meta[k]
            out.append({
                "label": meta["label"],
                "easy_pct": ep,
                "hard_pct": hp,
                "easy_min": e_sum,
                "hard_min": h_sum,
                "start": meta["start"],
                "end": meta["end"],
            })

        _log("TREND", {"user": user_id, "weeks": weeks, "sport": sport, "sports_used": list(sports or PARETO_DEFAULT_SET)})
        return {"success": True, "data": out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))