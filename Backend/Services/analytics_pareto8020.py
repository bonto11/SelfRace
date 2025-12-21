# backend/Services/analytics_pareto8020.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set
from collections import defaultdict

from Configs.config_sport import (
    DEBUG_PARETO,
    normalize_sport,
    normalize_sport_list,
    PARETO_DEFAULT_SET,
)
from Services.pareto_source import get_pareto_source
from Services.activity_zones import (
    preview_zones_for_activities,
    upsert_enrichment_minutes,
)
from Routes_DB.activities_summary import db_fetch_summary_since
from Routes_DB.activities_enrichment import db_get_enrichment_for_activities


def _log(*a: Any) -> None:
    if DEBUG_PARETO:
        print("[PARETO:SERVICE]", *a)


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
    if x.endswith("+00"):
        x += ":00"
    if x.endswith("Z"):
        x = x.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(x)
    except Exception:
        dt = datetime.strptime(x[:19], "%Y-%m-%dT%H:%M:%S").replace(
            tzinfo=timezone.utc
        )
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _week_bucket(dt: datetime) -> Dict[str, str]:
    dt = dt.astimezone(timezone.utc)
    start = dt - timedelta(days=dt.weekday())
    end = start + timedelta(days=6)
    year, week, _ = start.isocalendar()
    key = f"{year}-W{week:02d}"
    label = f"{start.day}–{end.day}.{end.month}."
    return {
        "key": key,
        "label": label,
        "start": start.isoformat(),
        "end": end.isoformat(),
    }


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


def _norm_db(x: Any) -> Optional[str]:
    return normalize_sport(x)


# --------------------------- SOURCE -----------------------------
def service_pareto_source(
    user_id: int,
    months: int = 3,
    count_no_hr_as_easy: bool = True,
) -> Dict[str, Any]:
    """
    Proxy na veľký dataset pre session (zachováva pôvodné správanie).
    """
    return get_pareto_source(
        user_id=user_id,
        months=months,
        count_no_hr_as_easy=count_no_hr_as_easy,
    )


# --------------------------- WIDGET -----------------------------
def service_pareto_widget(
    user_id: int,
    days: int = 14,
    sport: str = "all",
) -> Dict[str, Any]:
    """
    Sumár za posledné `days` – vracia iba payload `data` bez `success`.
    """
    days = int(days)
    sports = _parse_sport_query(sport)  # None => použi default set

    since_dt = datetime.now(timezone.utc) - timedelta(days=days)
    since_iso = _iso(since_dt)

    # Activities summary cez DB helper
    rows = db_fetch_summary_since(user_id=user_id, since_iso=since_iso)

    # filter podľa športu
    if sports is None:
        allowed = PARETO_DEFAULT_SET
        rows = [r for r in rows if _norm_db(r.get("sport_type_fe")) in allowed]
        sports_used = allowed
    else:
        rows = [r for r in rows if _norm_db(r.get("sport_type_fe")) in sports]
        sports_used = sports

    ids = [int(r["activity_id"]) for r in rows if r.get("activity_id")]

    _log(
        "WIDGET",
        {
            "user": user_id,
            "days": days,
            "sport": sport,
            "sports_used": list(sports_used),
            "ids": len(ids),
        },
    )

    if not ids:
        return {
            "easy_min": 0,
            "hard_min": 0,
            "total_min": 0,
            "days": days,
        }

    enr = db_get_enrichment_for_activities(user_id=user_id, activity_ids=ids)

    easy = sum(_easy(r) for r in enr)
    hard = sum(_hard(r) for r in enr)
    total = easy + hard

    return {
        "easy_min": int(easy),
        "hard_min": int(hard),
        "total_min": int(total),
        "days": days,
    }


# ---------------------------- TREND -----------------------------
def service_pareto_trend(
    user_id: int,
    weeks: int = 8,
    sport: str = "all",
) -> List[Dict[str, Any]]:
    """
    Trend po týždňoch (posledných `weeks` týždňov) s doplnením prázdnych týždňov nulami.
    Podporuje multi-sport query (?sport=run,ride).
    Vracia zoznam radkov (bez success wrappera).
    """
    weeks = max(1, int(weeks))
    sports = _parse_sport_query(sport)  # None => default set

    since = datetime.now(timezone.utc) - timedelta(weeks=weeks + 1)
    since_iso = _iso(since)

    # Activities summary cez DB helper
    rows = db_fetch_summary_since(user_id=user_id, since_iso=since_iso)
    rows = sorted(rows, key=lambda r: str(r.get("date") or ""))

    # filter podľa športu
    if sports is None:
        allowed = PARETO_DEFAULT_SET
        rows = [r for r in rows if _norm_db(r.get("sport_type_fe")) in allowed]
        sports_used = allowed
    else:
        rows = [r for r in rows if _norm_db(r.get("sport_type_fe")) in sports]
        sports_used = sports

    if not rows:
        _log(
            "TREND_EMPTY",
            {"user": user_id, "weeks": weeks, "sport": sport, "sports_used": list(sports_used)},
        )
        return []

    # map na týždne
    aid_by_week: Dict[str, List[int]] = {}
    week_meta: Dict[str, Dict[str, str]] = {}
    for r in rows:
        dt = _to_dt(r["date"])
        wb = _week_bucket(dt)
        k = wb["key"]
        aid_by_week.setdefault(k, []).append(int(r["activity_id"]))
        if k not in week_meta:
            week_meta[k] = {
                "label": wb["label"],
                "start": wb["start"],
                "end": wb["end"],
            }

    # recompute missing enrichment – necháme pôvodnú logiku
    all_ids: List[int] = [aid for ids in aid_by_week.values() for aid in ids]
    if all_ids:
        prev = preview_zones_for_activities(
            user_id, list(set(all_ids)), fetch_if_missing=True
        )
        if prev.get("ok"):
            upsert_enrichment_minutes(user_id, prev.get("items") or [])

    # načítaj enrichment z DB vrstvy
    enr = db_get_enrichment_for_activities(
        user_id=user_id,
        activity_ids=list(set(all_ids)),
    )
    emap = {
        int(e["activity_id"]): (_easy(e), _hard(e))
        for e in enr
        if e.get("activity_id") is not None
    }

    # kontinuálne posledných `weeks` pondelkov
    today = datetime.now(timezone.utc)
    this_monday = today - timedelta(days=today.weekday())
    keys_ordered: List[str] = []
    for i in range(weeks - 1, -1, -1):
        d = this_monday - timedelta(weeks=i)
        wb = _week_bucket(d)
        keys_ordered.append(wb["key"])
        week_meta.setdefault(
            wb["key"],
            {
                "label": wb["label"],
                "start": wb["start"],
                "end": wb["end"],
            },
        )

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
        out.append(
            {
                "label": meta["label"],
                "easy_pct": ep,
                "hard_pct": hp,
                "easy_min": e_sum,
                "hard_min": h_sum,
                "start": meta["start"],
                "end": meta["end"],
            }
        )

    _log(
        "TREND",
        {
            "user": user_id,
            "weeks": weeks,
            "sport": sport,
            "sports_used": list(sports_used),
        },
    )
    return out