# Services/AI/activity_review_builders.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, List, Iterable, Tuple

from Services.analytics_RecentLoad import service_build_recent_load_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis

from Routes_DB.activities_summary import db_get_summary_for_activities
from Routes_DB.activities_enrichment import db_get_enrichment_for_activities

# ✅ stub (DB logika mimo buildera) – dorobíme neskôr
# očakávané: vráti list activity_id za posledných `window_days` dní (vrátane dneška)
try:
    from Routes_DB.activities_summary import db_fetch_window_activity_ids  # type: ignore
except Exception:  # pragma: no cover
    db_fetch_window_activity_ids = None  # type: ignore

from Modules.Supabase.auth import AuthCtx


# =========================
# small helpers
# =========================

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
    return int(d) if d >= 0 else 0


def _to_int_safe(v: Any) -> Optional[int]:
    if v is None:
        return None
    try:
        return int(str(v))
    except Exception:
        return None


def _dedupe_keep_order(xs: Iterable[int]) -> List[int]:
    out: List[int] = []
    seen = set()
    for x in xs:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


# =========================
# zones boundaries (bpm) – best effort
# =========================

def _extract_hr_zones_bpm_from_ctx(ctx: AuthCtx, sport: str) -> Optional[Dict[str, Any]]:
    """
    Cieľ: AI nemá vracať len 'Z2', ale vedieť aj BPM hranice.
    Builder to skúsi vytiahnuť z ctx (ak existuje). Keď nie → None.

    Odporúčaný tvar:
      {
        "scheme": "lthr",
        "sport": "run",
        "z1": {"low": 150, "high": 164},
        "z2": {"low": 165, "high": 172},
        "z3": {"low": 173, "high": 183},
        "z4": {"low": 184, "high": 196},
        "z5": {"low": 197, "high": 201}
      }
    """
    try:
        # rôzne možné miesta – nech je to robustné
        zones = getattr(ctx, "zones", None) or getattr(ctx, "user_zones", None)

        # ak už je to dict pre viac športov
        if isinstance(zones, dict):
            # napr: zones["run"] = {...}
            z_sport = zones.get(sport) if sport in zones else None
            if isinstance(z_sport, dict) and any(k in z_sport for k in ("z1", "z2", "z3", "z4", "z5")):
                return {"scheme": z_sport.get("scheme") or zones.get("scheme"), "sport": sport, **z_sport}

            # alebo: zones je už priamo "current sport"
            if any(k in zones for k in ("z1", "z2", "z3", "z4", "z5")):
                return {"scheme": zones.get("scheme"), "sport": sport, **zones}

        return None
    except Exception:
        return None


# =========================
# recent load minify (keep only 2 weeks)
# =========================

def _minify_recent_load_to_week_horizon(recent_load: Any) -> Any:
    if not isinstance(recent_load, dict):
        return recent_load

    weeks = recent_load.get("weeks")
    if not isinstance(weeks, list):
        return {
            "schema_version": recent_load.get("schema_version"),
            "window_days": recent_load.get("window_days"),
            "weeks": [],
        }

    keep_idx = {-1, 0}
    out_weeks: List[Dict[str, Any]] = []

    for w in weeks:
        if not isinstance(w, dict):
            continue
        idx = _to_int_safe(w.get("week_index_from_now"))
        if idx is None or idx not in keep_idx:
            continue
        out_weeks.append(
            {
                "week_index_from_now": idx,
                "week_start_iso": w.get("week_start_iso"),
                "week_end_iso": w.get("week_end_iso"),
                "run_minutes": w.get("run_minutes"),
                "total_minutes": w.get("total_minutes"),
                "hard_sessions": w.get("hard_sessions"),
                "strength_sessions": w.get("strength_sessions"),
            }
        )

    out_weeks.sort(key=lambda x: int(x.get("week_index_from_now", 0)))
    return {
        "schema_version": recent_load.get("schema_version"),
        "window_days": recent_load.get("window_days"),
        "weeks": out_weeks,
    }


# =========================
# activity block builders
# =========================

def _build_activity_block_from_rows(
    *,
    activity_id: int,
    summary_row: Dict[str, Any],
    enr_row: Dict[str, Any],
    include_zones: bool = True,
    include_splits_laps: bool = False,  # 0–7 dní môžeme neskôr doplniť pass-through
) -> Dict[str, Any]:
    dt_raw = str(summary_row.get("date") or "")
    date_str = dt_raw[:10] if dt_raw else None

    sport_src = summary_row.get("sport_type_fe") or summary_row.get("sport_type")
    sport = _canonical_sport(sport_src)

    dist_m = _to_float(summary_row.get("distance_m"))
    moving_s = _to_float(summary_row.get("moving_time_s"))
    elev_gain_m = _to_float(summary_row.get("elevation_gain_m"))
    avg_hr = _to_int(summary_row.get("average_heartrate_bpm"))
    max_hr = _to_int(summary_row.get("max_heartrate_bpm"))
    cadence_avg = _to_int(summary_row.get("average_cadence")) or _to_int(summary_row.get("cadence_avg"))

    dur_min = (moving_s / 60.0) if (moving_s and moving_s > 0) else None
    dist_km = (dist_m / 1000.0) if (dist_m and dist_m > 0) else None
    pace_s_per_km = _to_int(summary_row.get("pace_seconds_per_km"))

    out: Dict[str, Any] = {
        "activity_id": activity_id,
        "days_ago": _days_ago(date_str),
        "sport": sport,
        "metrics": {
            "date": date_str,
            "distance_km": dist_km,
            "duration_min": dur_min,
            "pace_s_per_km": pace_s_per_km,
            "avg_hr_bpm": avg_hr,
            "max_hr_bpm": max_hr,
            "elevation_gain_m": elev_gain_m,
            "cadence_avg": cadence_avg,
        },
    }

    if include_zones:
        z1 = _to_float(enr_row.get("z1_min"))
        z2 = _to_float(enr_row.get("z2_min"))
        z3 = _to_float(enr_row.get("z3_min"))
        z4 = _to_float(enr_row.get("z4_min"))
        z5 = _to_float(enr_row.get("z5_min"))
        out["zones_min"] = {"z1": z1, "z2": z2, "z3": z3, "z4": z4, "z5": z5}

    # nič nehodnotíme – len pass-through (ak neskôr chceš)
    if include_splits_laps:
        for k in ("splits", "laps", "splits_json", "laps_json", "splits_minified", "laps_minified"):
            if k in enr_row and enr_row.get(k) is not None:
                out["splits_or_laps"] = enr_row.get(k)
                break

    return out


def _coarsen_activity(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    7–14 dní: len hrubé údaje (bez zón, bez splits/laps):
    - date, sport, distance, duration, avg/max HR, elevation, pace (ak existuje)
    """
    m = item.get("metrics") or {}
    return {
        "activity_id": item.get("activity_id"),
        "days_ago": item.get("days_ago"),
        "sport": item.get("sport"),
        "metrics": {
            "date": m.get("date"),
            "distance_km": m.get("distance_km"),
            "duration_min": m.get("duration_min"),
            "pace_s_per_km": m.get("pace_s_per_km"),
            "avg_hr_bpm": m.get("avg_hr_bpm"),
            "max_hr_bpm": m.get("max_hr_bpm"),
            "elevation_gain_m": m.get("elevation_gain_m"),
        },
    }


def _split_history_0_7_and_7_14(items: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Rozdelenie podľa days_ago:
      - 0..7 -> detail (ponecháme zones_min)
      - 8..14 -> coarse (orežeme)
    """
    d0_7: List[Dict[str, Any]] = []
    d7_14_raw: List[Dict[str, Any]] = []

    for it in items:
        da = it.get("days_ago")
        if da is None:
            continue
        try:
            di = int(da)
        except Exception:
            continue

        if 0 <= di <= 7:
            d0_7.append(it)
        elif 8 <= di <= 14:
            d7_14_raw.append(it)

    # pre AI je fajn mať chronológiu (staršie -> novšie), ale days_ago je opačne
    # takže zoradíme od 14 -> 0 (descending days_ago) = staršie prvé
    d0_7.sort(key=lambda x: int(x.get("days_ago") or 0), reverse=True)
    d7_14_raw.sort(key=lambda x: int(x.get("days_ago") or 0), reverse=True)

    d7_14 = [_coarsen_activity(x) for x in d7_14_raw]
    return d0_7, d7_14


# =========================
# main input builder
# =========================

def build_base_input(user_id: int, activity_id: int) -> Dict[str, Any]:
    return {
        "schema_version": 2,
        "user": {"id": user_id},
        # ✅ root sport pre výber promptu (naplní sa po načítaní activity)
        "sport": None,
        "activity": {
            "activity_id": activity_id,
            "days_ago": None,
            "sport": "other",
            "metrics": {},
            "zones_min": {"z1": None, "z2": None, "z3": None, "z4": None, "z5": None},
        },
        "history": {
            "days_0_7": [],
            "days_7_14": [],
        },
        "context": {
            "recovery": None,
            "recent_load": None,
            # ✅ BPM hranice zón (ak sa podarí vytiahnuť)
            "hr_zones_bpm": None,
        },
    }


def build_input_from_db(
    user_id: int,
    *,
    activity_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Pozn.: DB prácu (window fetch) budeme mať mimo a doladíme import.
    Builder tu len skladá štruktúru a volá existujúce db_get_*.
    """
    input_data = build_base_input(user_id, activity_id)

    # ----- context -----
    recovery = service_build_recovery_block_for_analysis(user_id, ctx=ctx)
    recent_load_raw = service_build_recent_load_block_for_analysis(user_id=user_id, window_days=14, ctx=ctx)
    recent_load = _minify_recent_load_to_week_horizon(recent_load_raw)

    input_data["context"]["recovery"] = recovery
    input_data["context"]["recent_load"] = recent_load

    # ----- focus activity -----
    summary_rows = db_get_summary_for_activities(user_id=user_id, activity_ids=[activity_id], ctx=ctx) or []
    enr_rows = db_get_enrichment_for_activities(user_id=user_id, activity_ids=[activity_id], ctx=ctx) or []

    summary_row = summary_rows[0] if summary_rows else None
    enr_row = enr_rows[0] if enr_rows and isinstance(enr_rows[0], dict) else {}

    if not isinstance(summary_row, dict):
        return input_data

    focus = _build_activity_block_from_rows(
        activity_id=activity_id,
        summary_row=summary_row,
        enr_row=enr_row if isinstance(enr_row, dict) else {},
        include_zones=True,
        include_splits_laps=False,
    )
    input_data["activity"] = focus
    input_data["sport"] = focus.get("sport")  # ✅ root sport

    # BPM hranice zón – skúsiť z ctx podľa športu
    input_data["context"]["hr_zones_bpm"] = _extract_hr_zones_bpm_from_ctx(ctx, sport=str(input_data["sport"] or "other"))

    # ----- history window (0–14 dní) -----
    # DB fetch mimo – ale pripravíme “hook”
    activity_ids_window: List[int] = []
    if db_fetch_window_activity_ids is not None:
        try:
            activity_ids_window = db_fetch_window_activity_ids(user_id=user_id, window_days=14, ctx=ctx) or []
        except Exception:
            activity_ids_window = []

    # aby sme mali aspoň fokus v histórii, keď window nebude hotové
    activity_ids_all = _dedupe_keep_order([*activity_ids_window, activity_id])

    if activity_ids_all:
        sum_rows = db_get_summary_for_activities(user_id=user_id, activity_ids=activity_ids_all, ctx=ctx) or []
        enr_rows2 = db_get_enrichment_for_activities(user_id=user_id, activity_ids=activity_ids_all, ctx=ctx) or []

        enr_by_id: Dict[int, Dict[str, Any]] = {}
        for r in enr_rows2:
            if not isinstance(r, dict):
                continue
            aid = r.get("activity_id")
            try:
                enr_by_id[int(aid)] = r
            except Exception:
                continue

        hist_items: List[Dict[str, Any]] = []
        for sr in sum_rows:
            if not isinstance(sr, dict):
                continue
            aid = sr.get("activity_id")
            try:
                aid_i = int(aid)
            except Exception:
                continue

            # v histórii 0–7 dní necháme zóny; 7–14 sa oseká neskôr
            hist_items.append(
                _build_activity_block_from_rows(
                    activity_id=aid_i,
                    summary_row=sr,
                    enr_row=enr_by_id.get(aid_i, {}),
                    include_zones=True,
                    include_splits_laps=False,
                )
            )

        d0_7, d7_14 = _split_history_0_7_and_7_14(hist_items)
        input_data["history"]["days_0_7"] = d0_7
        input_data["history"]["days_7_14"] = d7_14

    return input_data