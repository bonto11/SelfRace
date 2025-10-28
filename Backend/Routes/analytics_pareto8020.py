# backend/Routes/analytics_pareto8020.py
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Modules.config import TABLE_ACTIVITIES_SUMMARY, TABLE_ACTIVITIES_ENRICHMENT

router = APIRouter(prefix="/analytics/pareto8020", tags=["analytics"])
sb = get_client()

# ------------------------------------------------------------------
# KONFIGURÁCIA 80/20 – JASNE DEFINOVANÉ ŠPORTY
# ------------------------------------------------------------------
# Športy, ktoré sa rátajú do 80/20, keď FE pošle sport="all".
# (Run/ Ride/ Mixed/ Skate – podľa dohody. Walk/Strength/Soccer… sú mimo.)
PARETO_SPORTS_DEFAULT = {"run", "ride", "mixed", "skate"}

# Alias mapa FE -> DB (aj case-insensitive z DB normalizujeme nižšie)
SPORT_ALIAS: Dict[str, Optional[str]] = {
    "all": None,
    "run": "run",
    "ride": "ride",
    "bike": "ride",        # FE môže poslať "bike"
    "mixed": "mixed",
    "skate": "skate",
    "swim": "swim",
    "strength": "strength",
    "walk": "walk",
    "hike": "hike",
    "soccer": "soccer",
    "other": "other",
}

DEBUG = True  # pri nasadení môžeš dať False

# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------

def _log(*a):
    if DEBUG: print("[PARETO]", *a)

def _map_sport(fe_value: Optional[str]) -> Optional[str]:
    if not fe_value:
        return None
    return SPORT_ALIAS.get(fe_value.strip().lower(), fe_value.strip().lower())

def _norm_db_sport(v: Any) -> str:
    return str(v or "").strip().lower()

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

# ------------------------------------------------------------------
# /widget
# ------------------------------------------------------------------

@router.get("/widget/{user_id}")
def pareto_widget(user_id: int, days: int = 14, sport: str = "all") -> Dict[str, Any]:
    """
    Sumár za posledné `days` pre widget (číta iba enrichment).
    Ak sport="all", zahrnie sa LEN whitelist PARETO_SPORTS_DEFAULT.
    """
    try:
        days = int(days)
        sport_db = _map_sport(sport)
        since_iso = _iso(datetime.now(timezone.utc) - timedelta(days=days))

        q = (sb.table(TABLE_ACTIVITIES_SUMMARY)
                .select("activity_id,date,sport_type_fe")
                .eq("user_id", user_id)
                .gte("date", since_iso))

        rows = q.order("date", desc=True).execute().data or []

        # Filter športov
        if sport_db:
            rows = [r for r in rows if _norm_db_sport(r.get("sport_type_fe")) == sport_db]
        else:
            rows = [r for r in rows if _norm_db_sport(r.get("sport_type_fe")) in PARETO_SPORTS_DEFAULT]

        ids = [int(r["activity_id"]) for r in rows]
        _log("WIDGET", {"user": user_id, "days": days, "sport_in": sport, "sport_db": sport_db,
                        "rows": len(rows), "sports_set": sorted({ _norm_db_sport(r.get('sport_type_fe')) for r in rows })})

        if not ids:
            return {"success": True, "data": {"easy_min": 0, "hard_min": 0, "total_min": 0, "days": days}}

        enr = (sb.table(TABLE_ACTIVITIES_ENRICHMENT)
                 .select("activity_id,z1_min,z2_min,z3_min,z4_min,z5_min")
                 .eq("user_id", user_id)
                 .in_("activity_id", ids)
                 .execute()).data or []

        easy = sum(_easy(r) for r in enr)
        hard = sum(_hard(r) for r in enr)
        total = easy + hard

        return {"success": True, "data": {
            "easy_min": int(easy),
            "hard_min": int(hard),
            "total_min": int(total),
            "days": days,
        }}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------------------------------------------------------
# /trend
# ------------------------------------------------------------------

@router.get("/{user_id}")
def pareto_trend(user_id: int, weeks: int = 8, sport: str = "all") -> Dict[str, Any]:
    """
    Trend po týždňoch (posledných `weeks` týždňov).
    - sport="all" -> berú sa iba PARETO_SPORTS_DEFAULT
    - inak presný match (po aliasoch) danej disciplíny
    Vracia pole: [{label, easy_pct, hard_pct, easy_min, hard_min, start, end}, ...]
    """
    try:
        weeks = max(1, int(weeks))
        sport_db = _map_sport(sport)

        since_iso = _iso(datetime.now(timezone.utc) - timedelta(weeks=weeks + 1))

        rows = (sb.table(TABLE_ACTIVITIES_SUMMARY)
                  .select("activity_id,date,sport_type_fe")
                  .eq("user_id", user_id)
                  .gte("date", since_iso)
                  .order("date", desc=False)
                  .execute()).data or []

        # Filter športov
        if sport_db:
            rows = [r for r in rows if _norm_db_sport(r.get("sport_type_fe")) == sport_db]
        else:
            rows = [r for r in rows if _norm_db_sport(r.get("sport_type_fe")) in PARETO_SPORTS_DEFAULT]

        if not rows:
            _log("TREND empty after sport filter", {"user": user_id, "sport_in": sport, "sport_db": sport_db})
            return {"success": True, "data": []}

        # Zoskup IDs podľa týždňov
        aid_by_week: Dict[str, List[int]] = {}
        week_meta: Dict[str, Dict[str, str]] = {}

        for r in rows:
            dt = _to_dt(r["date"])
            wb = _week_bucket(dt)
            k = wb["key"]
            aid_by_week.setdefault(k, []).append(int(r["activity_id"]))
            week_meta[k] = {"label": wb["label"], "start": wb["start"], "end": wb["end"]}

        all_ids: List[int] = [aid for ids in aid_by_week.values() for aid in ids]
        if not all_ids:
            return {"success": True, "data": []}

        enr = (sb.table(TABLE_ACTIVITIES_ENRICHMENT)
                 .select("activity_id,z1_min,z2_min,z3_min,z4_min,z5_min")
                 .eq("user_id", user_id)
                 .in_("activity_id", list(set(all_ids)))
                 .execute()).data or []

        emap = {int(e["activity_id"]): (_easy(e), _hard(e)) for e in enr}

        weekly: List[Dict[str, Any]] = []
        for k in sorted(aid_by_week.keys()):
            e_sum = h_sum = 0
            for aid in aid_by_week[k]:
                e, h = emap.get(aid, (0, 0))
                e_sum += int(e); h_sum += int(h)
            t = e_sum + h_sum
            ep = int(round(100 * e_sum / t)) if t else 0
            hp = max(0, 100 - ep)
            weekly.append({
                "label": week_meta[k]["label"],
                "easy_pct": ep,
                "hard_pct": hp,
                "easy_min": int(e_sum),
                "hard_min": int(h_sum),
                "start": week_meta[k]["start"],
                "end": week_meta[k]["end"],
            })

        weekly = weekly[-weeks:]
        _log("TREND",
             {"user": user_id, "weeks": weeks, "sport_in": sport, "sport_db": sport_db,
              "weekly_count": len(weekly)})
        return {"success": True, "data": weekly}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))