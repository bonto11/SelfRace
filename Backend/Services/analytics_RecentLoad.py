from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from Routes_DB.activities_summary import db_fetch_summary_since
from Services.users import require_jwt


def _norm_sport(raw: str | None) -> str:
    """
    Normalizácia športu na: run / ride / strength / other.
    Používame sport_type_ovrd -> sport_type_fe -> sport_type.
    """
    s = (raw or "").lower()
    if "run" in s:
        return "run"
    if "ride" in s or "bike" in s or "cycle" in s:
        return "ride"
    if "strength" in s or "gym" in s or "workout" in s:
        return "strength"
    return "other"


def _start_of_iso_week(d: datetime) -> datetime:
    """
    ISO týždeň – pondelok je začiatok týždňa.
    """
    dow = d.weekday()  # 0 = Mon .. 6 = Sun
    return d.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=dow)


def service_build_recent_load_raw(
    user_id: int,
    window_days: int = 42,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Vypočíta weekly recent_load z tabuľky activities_summary.

    Vstup z DB (fetch_summary_since):
      - date
      - moving_time_s
      - sport_type / sport_type_fe / sport_type_ovrd

    Klient:
      - ak service = False + user_jwt nie je None → RLS klient,
      - ak service = True alebo user_jwt je None → service klient (cron/worker).

    (Voľbu klienta robí DB vrstva na základe user_jwt + service.)
    """
    today = datetime.now(timezone.utc).date()
    since = (today - timedelta(days=window_days - 1)).isoformat()

    rows: List[Dict[str, Any]] = db_fetch_summary_since(
        user_id=user_id,
        since_iso=since,
        user_jwt=user_jwt,
        service=service,
    )

    if not rows:
        return {
            "schema_version": 1,
            "window_days": window_days,
            "weeks": [],
        }

    weeks_map: Dict[str, Dict[str, Any]] = {}

    for r in rows:
        raw_date = r.get("date")
        if not raw_date:
            continue

        try:
            d = datetime.fromisoformat(str(raw_date)[:10])
        except Exception:
            continue

        week_start = _start_of_iso_week(d)
        key = week_start.date().isoformat()

        agg = weeks_map.get(key)
        if not agg:
            agg = {
                "week_start": week_start,
                "total_minutes": 0.0,
                "run_minutes": 0.0,
                "ride_minutes": 0.0,
                "strength_sessions": 0,
                "hard_sessions": 0,
            }
            weeks_map[key] = agg

        # čas
        sec = 0.0
        mv_s = r.get("moving_time_s")
        if isinstance(mv_s, (int, float)) and mv_s > 0:
            sec = float(mv_s)
        mins = sec / 60.0
        if mins <= 0:
            continue

        agg["total_minutes"] += mins

        sport = _norm_sport(
            r.get("sport_type_ovrd") or r.get("sport_type_fe") or r.get("sport_type")
        )
        if sport == "run":
            agg["run_minutes"] += mins
            # heuristika: dlhší beh počítame ako "hard" (dočasne)
            if mins >= 60:
                agg["hard_sessions"] += 1
        elif sport == "ride":
            agg["ride_minutes"] += mins
        elif sport == "strength":
            agg["strength_sessions"] += 1

    if not weeks_map:
        return {
            "schema_version": 1,
            "window_days": window_days,
            "weeks": [],
        }

    # zoradiť týždne podľa dátumu (stúpajúco)
    weeks_sorted: List[Dict[str, Any]] = sorted(
        weeks_map.values(), key=lambda w: w["week_start"]
    )

    last_idx = len(weeks_sorted) - 1
    weeks_out: List[Dict[str, Any]] = []
    for idx, w in enumerate(weeks_sorted):
        start = w["week_start"].date()
        end = start + timedelta(days=6)
        week_index_from_now = idx - last_idx

        weeks_out.append(
            {
                "week_start_iso": start.isoformat(),
                "week_end_iso": end.isoformat(),
                "week_index_from_now": week_index_from_now,
                "total_minutes": int(round(w["total_minutes"])),
                "run_minutes": int(round(w["run_minutes"])),
                "ride_minutes": int(round(w["ride_minutes"])),
                "strength_sessions": int(w["strength_sessions"]),
                "hard_sessions": int(w["hard_sessions"]),
            }
        )

    return {
        "schema_version": 1,
        "window_days": window_days,
        "weeks": weeks_out,
    }


def _prune_recent_load_for_ai(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    AI-friendly verzia – vyhodí polia s nulou (ride_minutes=0, ...).
    """
    if not raw:
        return {
            "schema_version": 1,
            "window_days": 42,
            "weeks": [],
        }

    weeks_in: List[Dict[str, Any]] = raw.get("weeks") or []
    weeks_out: List[Dict[str, Any]] = []

    for w in weeks_in:
        base = {
            "week_start_iso": w.get("week_start_iso"),
            "week_end_iso": w.get("week_end_iso"),
            "week_index_from_now": w.get("week_index_from_now"),
            "total_minutes": w.get("total_minutes"),
        }
        for key, val in w.items():
            if key in base:
                continue
            if isinstance(val, (int, float)) and val <= 0:
                continue
            base[key] = val
        weeks_out.append(base)

    return {
        "schema_version": raw.get("schema_version") or 1,
        "window_days": raw.get("window_days") or 42,
        "weeks": weeks_out,
    }


def service_build_recent_load_block_for_analysis(
    user_id: int,
    window_days: int = 42,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    High-level blok pre AI (coach_athlete_state):
      - natiahne summary z DB (RLS alebo service),
      - spočíta weekly recent_load,
      - oseká nulové polia.
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    raw = service_build_recent_load_raw(
        user_id=user_id,
        window_days=window_days,
        user_jwt=jwt,
        service=service,
    )
    return _prune_recent_load_for_ai(raw)