# backend/Routes/analytics_pareto8020.py
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from typing import Any, Dict, List, Optional
from Modules.SQL.db_handler import get_client
from Modules.config import TABLE_ACTIVITIES_SUMMARY, TABLE_ACTIVITIES_ENRICHMENT

router = APIRouter(prefix="/analytics/pareto8020", tags=["analytics"])
sb = get_client()

# --- helpers -----------------------------------------------------

# FE -> DB aliasy (FE posiela "bike", v DB je "ride")
SPORT_ALIAS = {
    "all": None,
    "run": "run",
    "ride": "ride",
    "strength": "strength",
    "mixed": "mixed",
    "swim": "swim",
    "walk": "walk",
    "hike": "hike",
    "soccer": "soccer",
    "skate": "skate",
    "other": "other",
}

def _map_sport(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    return SPORT_ALIAS.get(s, s)

def _easy(row: dict) -> int:
    # Easy = Z1 + Z2 (min)
    z1 = int(round(float(row.get("z1_min") or 0)))
    z2 = int(round(float(row.get("z2_min") or 0)))
    return z1 + z2

def _hard(row: dict) -> int:
    # Hard = Z3 + Z4 + Z5 (min)
    z3 = int(round(float(row.get("z3_min") or 0)))
    z4 = int(round(float(row.get("z4_min") or 0)))
    z5 = int(round(float(row.get("z5_min") or 0)))
    return z3 + z4 + z5

def _iso(dt: datetime) -> str:
    # ISO pre DB filter (timestamptz) – UTC
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")

def _to_dt(s: str) -> datetime:
    """
    DB 'date' môže vyzerať: '2025-10-21 09:00:00+00' alebo '2025-10-21T09:00:00+00'
    Upravíme na formát akceptovaný datetime.fromisoformat (potrebuje +00:00).
    """
    x = str(s or "")
    x = x.replace(" ", "T")
    # +00 -> +00:00
    if x.endswith("+00"):
        x = x + ":00"
    if x.endswith("Z"):
        x = x.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(x)
    except Exception:
        # fallback – bez TZ ako UTC
        dt = datetime.strptime(x[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt

def _week_bucket(dt: datetime) -> Dict[str, str]:
    """
    Vráti {'key': 'YYYY-Www', 'label': 'dd–dd.mm.'} v UTC týždňoch (Po–Ne).
    Ak chceš lokálne týždne, tu zmeň .astimezone(...) na user TZ.
    """
    dt = dt.astimezone(timezone.utc)
    # pondelok
    start = dt - timedelta(days=dt.weekday())
    end = start + timedelta(days=6)
    year, week, _ = start.isocalendar()
    key = f"{year}-W{week:02d}"
    label = f"{start.day}–{end.day}.{end.month}."
    return {"key": key, "label": label, "start": start.isoformat(), "end": end.isoformat()}

# --- /widget -----------------------------------------------------

@router.get("/widget/{user_id}")
def pareto_widget(user_id: int, days: int = 14, sport: str = "all") -> Dict[str, Any]:
    """Sumár za posledné `days` pre widget (bez recompute, číta iba enrichment)."""
    try:
        days = int(days)
        sport_db = _map_sport(sport)
        since = datetime.now(timezone.utc) - timedelta(days=days)
        since_iso = _iso(since)

        q = (
            sb.table(TABLE_ACTIVITIES_SUMMARY)
            .select("activity_id,date,sport_type_fe")
            .eq("user_id", user_id)
            .gte("date", since_iso)
        )
        if sport_db:
            q = q.ilike("sport_type_fe", sport_db)
        ids_rows = q.order("date", desc=True).execute()
        ids = [int(r["activity_id"]) for r in (ids_rows.data or [])]

        if not ids:
            return {"success": True, "data": {"easy_min": 0, "hard_min": 0, "total_min": 0, "days": days}}

        enr = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
            .select("z1_min,z2_min,z3_min,z4_min,z5_min")
            .eq("user_id", user_id)
            .in_("activity_id", ids)
            .execute()
        )
        rows = enr.data or []
        easy = sum(_easy(r) for r in rows)
        hard = sum(_hard(r) for r in rows)
        total = easy + hard

        return {
            "success": True,
            "data": {
                "easy_min": int(easy),
                "hard_min": int(hard),
                "total_min": int(total),
                "days": days,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- /trend ------------------------------------------------------

@router.get("/{user_id}")
def pareto_trend(user_id: int, weeks: int = 8, sport: str = "all") -> Dict[str, Any]:
    """
    Trend po týždňoch (posledných `weeks` týždňov). Filtruje podľa sport_type_fe (s aliasmi).
    Vracia pole:
      [{ label, easy_pct, hard_pct, easy_min, hard_min, start?, end? }, ...]
    """
    try:
        weeks = max(1, int(weeks))
        sport_db = _map_sport(sport)

        # buffer o 1 týždeň dozadu
        since = datetime.now(timezone.utc) - timedelta(weeks=weeks + 1)
        since_iso = _iso(since)

        q = (
            sb.table(TABLE_ACTIVITIES_SUMMARY)
            .select("activity_id,date,sport_type_fe")
            .eq("user_id", user_id)
            .gte("date", since_iso)
        )
        if sport_db:
            q = q.ilike("sport_type_fe", sport_db)
        rows = q.order("date", desc=False).execute().data or []
        if not rows:
            return {"success": True, "data": []}

        aid_by_week: Dict[str, List[int]] = {}
        week_labels: Dict[str, str] = {}
        week_bounds: Dict[str, Dict[str, str]] = {}

        for r in rows:
            dt = _to_dt(r["date"])
            wb = _week_bucket(dt)
            k = wb["key"]
            aid_by_week.setdefault(k, []).append(int(r["activity_id"]))
            week_labels[k] = wb["label"]
            week_bounds[k] = {"start": wb["start"], "end": wb["end"]}

        # načítaj enrichment pre všetky ID naraz
        all_ids: List[int] = []
        for ids in aid_by_week.values():
            all_ids.extend(ids)

        if not all_ids:
            return {"success": True, "data": []}

        enr = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
            .select("activity_id,z1_min,z2_min,z3_min,z4_min,z5_min")
            .eq("user_id", user_id)
            .in_("activity_id", list(set(all_ids)))
            .execute()
        ).data or []

        # map activity_id -> (easy, hard)
        emap = {int(e["activity_id"]): (_easy(e), _hard(e)) for e in enr}

        # agregácia po týždňoch
        weekly: List[Dict[str, Any]] = []
        for k in sorted(aid_by_week.keys()):
            e_sum = h_sum = 0
            for aid in aid_by_week[k]:
                e, h = emap.get(aid, (0, 0))
                e_sum += int(e)
                h_sum += int(h)
            t = e_sum + h_sum
            ep = int(round(100 * e_sum / t)) if t else 0
            hp = max(0, 100 - ep)
            weekly.append({
                "label": week_labels[k],
                "easy_pct": ep,
                "hard_pct": hp,
                "easy_min": int(e_sum),
                "hard_min": int(h_sum),
                # odošleme aj hranice, FE si vie prekliknúť na detail
                "start": week_bounds[k]["start"],
                "end": week_bounds[k]["end"],
            })

        # vezmi posledných `weeks`
        weekly = weekly[-weeks:]
        return {"success": True, "data": weekly}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))