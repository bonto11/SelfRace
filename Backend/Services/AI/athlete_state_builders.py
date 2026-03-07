# Services/AI/athlete_state_builders.py
from __future__ import annotations


from datetime import datetime, timezone, timedelta, date
from typing import Any, Dict, Optional, List

from Services.user_thresholds import service_build_thresholds_block_for_analysis
from Services.user_zones import service_build_zones_block_for_analysis
from Services.user_bests import service_build_bests_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis
from Services.user_prefs import service_load_coach_prefs_for_analysis
from Services.analytics_RecentLoad import service_build_recent_load_block_for_analysis
from Services.coach_external_events import service_build_external_events_block_for_analysis
from Services.coach_plan_meta import service_build_active_plan_block_for_analysis

from Routes_DB.activities_summary import db_get_recent_activity_ids, db_get_summary_for_activities
from Routes_DB.activities_enrichment import db_get_enrichment_for_activities
from Routes_DB.users_pace_history import db_get_latest_paces
from Routes_DB.activities_laps import db_get_activity_laps
from Routes_DB.activities_splits import db_get_activity_splits
from Routes_DB.profile_static import db_fetch_static_basic
from Routes_DB.user_metrics import db_get_latest_metric

from Modules.Supabase.auth import AuthCtx

def _to_float(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except Exception:
        return None


def _to_int(x: Any) -> Optional[int]:
    try:
        if x is None or x == "":
            return None
        return int(x)
    except Exception:
        return None


def _canonical_sport(s: Any) -> str:
    if not s:
        return "other"
    v = str(s).lower()
    if v.startswith("run") or "run" in v or v in ("trail", "trail_run"):
        return "run"
    if v.startswith("ride") or v.startswith("cycle") or v.startswith("bike"):
        return "ride"
    if v.startswith("str") or "strength" in v or "gym" in v or "weights" in v:
        return "strength"
    if "swim" in v:
        return "swim"
    return "other"


def _parse_yyyy_mm_dd(s: Any) -> Optional[datetime]:
    try:
        if not s:
            return None
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _days_ago(date_str: Any) -> Optional[int]:
    dt = _parse_yyyy_mm_dd(date_str)
    if not dt:
        return None
    today = datetime.now(timezone.utc).date()
    d = (today - dt.date()).days
    return int(d) if d >= 0 else 0  # budúcnosť clamp na 0


def _days_from_today(date_str: Any) -> Optional[int]:
    """
    + => event je v budúcnosti (za X dní)
    0 => dnes
    - => v minulosti
    """
    dt = _parse_yyyy_mm_dd(date_str)
    if not dt:
        return None
    today = datetime.now(timezone.utc).date()
    return int((dt.date() - today).days)


def _bests_dates_to_days_ago(bests: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pre každý PB zamení 'date'/'start_date'/'performed_at' za 'days_ago' (int).
    Absolútne dátumy vyhodí.
    """
    if not isinstance(bests, dict):
        return bests

    out = dict(bests)
    for sport_key in ("run", "ride"):
        items = out.get(sport_key)
        if not isinstance(items, list):
            continue

        new_items: List[Dict[str, Any]] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            it2 = dict(it)
            d = _days_ago(
                it2.get("date") or it2.get("start_date") or it2.get("performed_at")
            )
            if d is not None:
                it2["days_ago"] = d

            it2.pop("date", None)
            it2.pop("start_date", None)
            it2.pop("performed_at", None)

            new_items.append(it2)

        out[sport_key] = new_items

    return out

def _load_user_profile_for_analysis(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Kombinuje static profile (vek, pohlavie, výška) a najnovšiu váhu z user_metrics.
    """
    stat = db_fetch_static_basic(user_id=user_id, ctx=ctx) or {}
    
    # Vek z birth_date
    age = None
    birth_date = stat.get("birth_date")
    if birth_date:
        try:
            d = date.fromisoformat(birth_date[:10])
            t = date.today()
            age = t.year - d.year - ((t.month, t.day) < (d.month, d.day))
        except Exception:
            pass

    # Váha z novej tabuľky
    w_row = db_get_latest_metric(user_id, "weight_kg", ctx=ctx)
    weight_kg = float(w_row["value_num"]) if w_row and w_row.get("value_num") else None

    return {
        "id": user_id,
        "sex": stat.get("sex"),
        "age": age,
        "height_cm": stat.get("height_cm"),
        "weight_kg": weight_kg,
    }

def _minify_external_events_for_ai(ext: Any) -> Any:
    """
    External events: odstráni absolútne dátumy, nahradí ich days_from_today.
    Zachová weekday/priority/sport/title/duration_min.
    """
    if not isinstance(ext, dict):
        return ext

    out: Dict[str, Any] = {"schema_version": int(ext.get("schema_version") or 1)}

    events: List[Dict[str, Any]] = []
    if isinstance(ext.get("events"), list):
        events = [e for e in ext["events"] if isinstance(e, dict)]
    elif isinstance(ext.get("window"), dict) and isinstance(
        ext["window"].get("events"), list
    ):
        events = [e for e in ext["window"]["events"] if isinstance(e, dict)]

    cleaned_events: List[Dict[str, Any]] = []
    for e in events:
        dt = (
            e.get("occurrence_date")
            or e.get("date")
            or e.get("start_date_local")
            or e.get("start_date")
            or e.get("start_date_iso")
        )
        cleaned_events.append(
            {
                "days_from_today": _days_from_today(dt),
                "weekday": e.get("weekday"),
                "sport": e.get("sport"),
                "duration_min": e.get("duration_min"),
                "priority": e.get("priority"),
                "title": e.get("title"),
            }
        )

    win = ext.get("window")
    if isinstance(win, dict):
        out["window"] = {
            "from_days_from_today": _days_from_today(win.get("from")),
            "to_days_from_today": _days_from_today(win.get("to")),
            "events": cleaned_events,
        }
    else:
        out["events"] = cleaned_events

    return out


def _get_minified_segments(user_id: int, activity_id: int, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """
    Vyberie laps (alebo splits), a minifikuje ich pre AI.
    d = distance_m, p = pace_s_per_km, hr = avg_hr_bpm
    """
    segments = []
    # 1. Skús Laps
    laps = db_get_activity_laps(user_id, activity_id, ctx=ctx)
    if laps and len(laps) > 1: # Ignorujeme ak má aktivita len 1 lap (to je v podstate celá aktivita)
        for lap in laps:
            dist = _to_float(lap.get("distance_m"))
            time_s = _to_float(lap.get("moving_time_s")) or _to_float(lap.get("elapsed_time_s"))
            hr = _to_int(lap.get("average_heartrate_bpm"))
            
            if dist and time_s and dist > 0:
                pace = int((time_s / dist) * 1000)
                segments.append({"d": round(dist), "p": pace, "hr": hr})
        return segments

    # 2. Skús Splits (ak nie sú laps)
    splits = db_get_activity_splits(user_id, activity_id, ctx=ctx)
    if splits and len(splits) > 1:
        for sp in splits:
            dist = _to_float(sp.get("distance_m"))
            time_s = _to_float(sp.get("moving_time_s")) or _to_float(sp.get("elapsed_time_s"))
            hr = _to_int(sp.get("average_heartrate_bpm"))
            
            if dist and time_s and dist > 0:
                pace = int((time_s / dist) * 1000)
                segments.append({"d": round(dist), "p": pace, "hr": hr})
    
    return segments


def build_last_activities_block_for_analysis(
    user_id: int,
    *,
    ctx: AuthCtx,
    limit: int = 6,
) -> List[Dict[str, Any]]:
    """
    Posledných N aktivít (summary + zóny z enrichment + segments) pre AI.
    """

    if limit <= 0:
        limit = 4

    since_iso = (datetime.now(timezone.utc) - timedelta(days=60)).date().isoformat()

    ids = db_get_recent_activity_ids(
        user_id=user_id,
        since_iso_date=since_iso,
        limit=limit,
        ctx=ctx,
    )
    if not ids:
        return []

    summary_rows = (
        db_get_summary_for_activities(
            user_id=user_id,
            activity_ids=ids,
            ctx=ctx,
        )
        or []
    )
    if not summary_rows:
        return []

    enr_rows = (
        db_get_enrichment_for_activities(
            user_id=user_id,
            activity_ids=ids,
            ctx=ctx,
        )
        or []
    )
    enr_by_id: Dict[int, Dict[str, Any]] = {}
    for r in enr_rows:
        aid = _to_int(r.get("activity_id"))
        if aid is not None:
            enr_by_id[aid] = r

    def _date_key(row: Dict[str, Any]) -> str:
        return str(row.get("date") or "")[:19]

    def _rel_day_label(date_str: Optional[str]) -> Optional[str]:
        dt = _parse_yyyy_mm_dd(date_str or "")
        if not dt:
            return None
        today = datetime.now(timezone.utc).date()
        d = (today - dt.date()).days
        if d <= 0:
            return "today"
        return f"today-{int(d)}"

    out: List[Dict[str, Any]] = []
    for r in sorted(summary_rows, key=_date_key, reverse=True):
        aid = _to_int(r.get("activity_id"))
        if aid is None:
            continue

        dt_raw = str(r.get("date") or "")
        date_str = dt_raw[:10] if dt_raw else None

        moving_s = _to_float(r.get("moving_time_s"))
        dist_m = _to_float(r.get("distance_m"))
        avg_hr = _to_int(r.get("average_heartrate_bpm"))

        dur_min = (moving_s / 60.0) if (moving_s and moving_s > 0) else None
        dist_km = (dist_m / 1000.0) if (dist_m and dist_m > 0) else None

        avg_pace_s = None
        if dist_km and dist_km > 0 and moving_s and moving_s > 0:
            avg_pace_s = int(moving_s / dist_km)

        sport_src = r.get("sport_type_fe") or r.get("sport_type")
        sport = _canonical_sport(sport_src)

        enr = enr_by_id.get(aid, {})

        z45 = (_to_float(enr.get("z4_min")) or 0.0) + (_to_float(enr.get("z5_min")) or 0.0)
        z12 = (_to_float(enr.get("z1_min")) or 0.0) + (_to_float(enr.get("z2_min")) or 0.0)
        
        intensity = "easy"
        if z45 > 5:
            intensity = "hard"
        elif z45 > 0 or (dur_min and z12 < (dur_min * 0.8)):
            intensity = "moderate"

        act_obj = {
            "date": _rel_day_label(date_str),
            "sport": sport,
            "duration_min": round(dur_min) if dur_min else None,
            "distance_km": round(dist_km, 2) if dist_km else None,
            "avg_pace_s": avg_pace_s,
            "avg_hr": avg_hr,
            "intensity": intensity,
        }

        # ✅ Pridáme empirické segmenty (laps/splits) len pre beh a bike
        if sport in ["run", "ride"]:
            segments = _get_minified_segments(user_id, aid, ctx)
            if segments:
                act_obj["segments"] = segments
            else:
                # PRIDANÝ LOG PRE DEBUG:
                print(f"DEBUG: Ziadne splits a laps pre aktivitu {aid} ({sport}) z datumu {date_str}")

        out.append(act_obj)

    return out

def build_base_input(user_id: int) -> Dict[str, Any]:
    return {
        "schema_version": 1,
        "user": {
            "id": user_id,
            "sex": None,
            "age": None,
            "height_cm": None,
            "weight_kg": None,
            "training_age_years": None,
        },
        "prefs": {
            "goal_kind": None,
            "weeks": None,
            "plan_start_date": None,
            "main_sport": None,
            "secondary_mix": [],
            "strength_settings": None,
            "weekly_time_budget_min": None,
            "hard_days_per_week_max": None,
            "notes_for_coach": None,
        },
        "zones": {"run": {"hr_max": None, "lthr_bpm": None, "zones": []}},
        "thresholds": {
            "run": {
                "lthr_bpm": None,
                "pace_lthr_s_per_km": None,
                "ftp_power_w": None,
                "vo2max_estimate": None,
            }
        },
        "bests": {"run": [], "ride": []},
        "recent_load": {"schema_version": 1, "window_days": 42, "weeks": []},
        "recovery": {
            "rhr_bpm": None,
            "hrv_avg": None,
            "hrv_trend": None,
            "sleep_ok": None,
            "last_illness_days_ago": None,
        },
        "active_plan": {
            "has_active_plan": False,
            "current_week_index": None,
            "total_weeks": None,
            "horizon_days": None,
        },
        "external_events": None,
        "last_activities": [],
        "latest_paces": None, # ✅ Nové pole pre zachovanie histórie
        "is_returning_beginner": False,
    }


# --- UPRAVENÁ HLAVNÁ FUNKCIA ---

def build_input_from_db(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    input_data = build_base_input(user_id)
    input_data["user"] = _load_user_profile_for_analysis(
        user_id=user_id,
        ctx=ctx,
    )

    input_data["zones"] = service_build_zones_block_for_analysis(user_id, ctx=ctx)
    input_data["thresholds"] = service_build_thresholds_block_for_analysis(user_id, ctx=ctx)
    input_data["prefs"] = service_load_coach_prefs_for_analysis(user_id, ctx=ctx)
    
    input_data["bests"] = service_build_bests_block_for_analysis(user_id, ctx=ctx)
    input_data["bests"] = _bests_dates_to_days_ago(input_data.get("bests") or {})

    input_data["recent_load"] = service_build_recent_load_block_for_analysis(
        user_id=user_id, window_days=42, ctx=ctx
    )

    input_data["recovery"] = service_build_recovery_block_for_analysis(user_id, ctx=ctx)
    input_data["active_plan"] = service_build_active_plan_block_for_analysis(user_id=user_id, ctx=ctx)

    ext = service_build_external_events_block_for_analysis(user_id=user_id, ctx=ctx)
    input_data["external_events"] = _minify_external_events_for_ai(ext)

    input_data["latest_paces"] = db_get_latest_paces(user_id=user_id, ctx=ctx)

    acts = build_last_activities_block_for_analysis(user_id=user_id, ctx=ctx, limit=6)
    input_data["last_activities"] = acts
    
    input_data["is_returning_beginner"] = (len(acts) == 0)

    return input_data