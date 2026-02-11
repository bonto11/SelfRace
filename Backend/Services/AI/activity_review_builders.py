from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, List, Iterable, Tuple
import json

from Services.analytics_RecentLoad import service_build_recent_load_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis

from Routes_DB.activities_summary import db_get_summary_for_activities

try:
    from Routes_DB.activities_summary import db_fetch_window_activity_ids  # type: ignore
except Exception:  # pragma: no cover
    db_fetch_window_activity_ids = None  # type: ignore

from Routes_DB.activities_enrichment import db_get_enrichment_for_activities
from Routes_DB.activities_splits import db_get_activity_splits
from Routes_DB.activities_laps import db_get_activity_laps
from Routes_DB.activities_streams import db_get_streams_one

from Modules.Supabase.auth import AuthCtx


# ============================================================
# CONFIG (token control knobs)
# ============================================================

# Streams sú najväčší žrút tokenov -> default OFF
ENABLE_STREAMS_FOR_FOCUS = False

# Ak chceš niekedy zapnúť: len focus a len run/ride a ešte tvrdo zriediť
STREAMS_MAX_POINTS_RUN = 120
STREAMS_MAX_POINTS_RIDE = 90

SPLITS_MAX_ITEMS_RUN = 20
SPLITS_MAX_ITEMS_RIDE = 16

LAPS_MAX_ITEMS_RUN = 20
LAPS_MAX_ITEMS_RIDE = 16


# =========================
# small helpers
# =========================

def _dbg(tag: str, obj: Dict[str, Any]) -> None:
    print(tag, obj)


def _json_bytes(v: Any) -> int:
    try:
        return len(json.dumps(v, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    except Exception:
        try:
            return len(str(v).encode("utf-8"))
        except Exception:
            return -1


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


def _get_activity_id(row: Dict[str, Any]) -> Optional[int]:
    try:
        v = row.get("activity_id")
        if v is None:
            return None
        return int(v)
    except Exception:
        return None


def _canonical_sport(s: Any) -> str:
    if not s:
        return "other"
    v = str(s).lower().strip()
    if v in ("run", "trail", "trail_run") or v.startswith("run"):
        return "run"
    if v in ("ride", "bike", "cycle") or v.startswith(("ride", "bike", "cycle")):
        return "ride"
    if v in ("strength", "gym", "weights") or v.startswith("str") or "strength" in v or "gym" in v:
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


def _sanitize_user_comment(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    try:
        s = str(raw)
    except Exception:
        return None

    s = s.strip()
    if not s:
        return None

    MAX_CHARS = 900
    if len(s) > MAX_CHARS:
        s = s[:MAX_CHARS].rstrip() + "…"

    return s


def _sanitize_source(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    try:
        s = str(raw).strip().lower()
    except Exception:
        return None
    if not s:
        return None
    if s in ("auto", "user", "service"):
        return s
    return s


# =========================
# zones boundaries (bpm) – best effort
# =========================

def _normalize_zone_bounds(z: Any) -> Optional[Dict[str, Optional[int]]]:
    if z is None:
        return None
    if isinstance(z, dict):
        low = _to_int(z.get("low") if "low" in z else z.get("min"))
        high = _to_int(z.get("high") if "high" in z else z.get("max"))
        return {"low": low, "high": high}
    if isinstance(z, (list, tuple)) and len(z) >= 2:
        return {"low": _to_int(z[0]), "high": _to_int(z[1])}
    if isinstance(z, str) and "-" in z:
        a, b = z.split("-", 1)
        return {"low": _to_int(a.strip()), "high": _to_int(b.strip())}
    return None


def _extract_hr_zones_bpm_from_ctx(ctx: AuthCtx, sport: str) -> Optional[Dict[str, Any]]:
    try:
        zones_any = getattr(ctx, "zones", None) or getattr(ctx, "user_zones", None)
        if not zones_any:
            return None

        scheme = None
        z_src: Optional[Dict[str, Any]] = None

        if isinstance(zones_any, dict):
            scheme = zones_any.get("scheme")
            if sport in zones_any and isinstance(zones_any.get(sport), dict):
                z_src = zones_any.get(sport)
            elif any(k in zones_any for k in ("z1", "z2", "z3", "z4", "z5")):
                z_src = zones_any

        if not isinstance(z_src, dict):
            return None

        out: Dict[str, Any] = {"scheme": z_src.get("scheme") or scheme, "sport": sport}
        ok = False
        for zk in ("z1", "z2", "z3", "z4", "z5"):
            bounds = _normalize_zone_bounds(z_src.get(zk))
            if bounds:
                out[zk] = bounds
                ok = True

        return out if ok else None
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
# minify splits / laps / streams (focus only)
# =========================

def _splits_max_items(sport: str) -> int:
    return SPLITS_MAX_ITEMS_RUN if sport == "run" else SPLITS_MAX_ITEMS_RIDE


def _laps_max_items(sport: str) -> int:
    return LAPS_MAX_ITEMS_RUN if sport == "run" else LAPS_MAX_ITEMS_RIDE


def _streams_max_points(sport: str) -> int:
    return STREAMS_MAX_POINTS_RUN if sport == "run" else STREAMS_MAX_POINTS_RIDE


def _minify_splits(rows: List[Dict[str, Any]], *, sport: str, max_items: int) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in (rows or [])[:max_items]:
        if not isinstance(r, dict):
            continue

        item: Dict[str, Any] = {
            "i": r.get("split_index"),
            "dist_m": r.get("distance_m"),
            "moving_s": r.get("moving_time_s"),
            "avg_hr": r.get("average_heartrate_bpm") or r.get("avg_hr_bpm"),
        }

        if sport == "run":
            item["pace_s_km"] = r.get("pace_seconds_per_km")
            item["avg_cad"] = r.get("average_cadence_rpm") or r.get("cadence_avg")
        elif sport == "ride":
            item["avg_pwr"] = r.get("average_power_w") or r.get("avg_power_w")

        out.append(item)

    return out


def _minify_laps(rows: List[Dict[str, Any]], *, sport: str, max_items: int) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in (rows or [])[:max_items]:
        if not isinstance(r, dict):
            continue

        item: Dict[str, Any] = {
            "i": r.get("lap_index"),
            "dist_m": r.get("distance_m"),
            "moving_s": r.get("moving_time_s"),
            "avg_hr": r.get("average_heartrate_bpm") or r.get("avg_hr_bpm"),
        }

        if sport == "run":
            item["pace_s_km"] = r.get("pace_seconds_per_km")
        elif sport == "ride":
            item["avg_pwr"] = r.get("average_power_w") or r.get("avg_power_w")

        out.append(item)

    return out


def _minify_streams_for_ai(row: Optional[Dict[str, Any]], *, sport: str) -> Optional[Dict[str, Any]]:
    """
    Extrémne zoštíhlené streams:
      - len time + hr (+ power pre ride)
      - tvrdo downsample
    """
    if not isinstance(row, dict):
        return None

    time_s = row.get("time_s") or []
    if not isinstance(time_s, list) or not time_s:
        return None

    hr = row.get("heartrate_bpm") or []
    pwr = row.get("power_w") or []

    n = len(time_s)
    max_points = _streams_max_points(sport)

    if n <= max_points:
        idxs = list(range(n))
    else:
        step = max(1, int(n / max_points))
        idxs = list(range(0, n, step))[:max_points]

    def pick(arr: Any) -> List[Any]:
        if not isinstance(arr, list) or not arr:
            return []
        out = []
        for i in idxs:
            if 0 <= i < len(arr):
                out.append(arr[i])
        return out

    out: Dict[str, Any] = {
        "points": len(idxs),
        "time_s": pick(time_s),
        "heartrate_bpm": pick(hr),
    }
    if sport == "ride":
        out["power_w"] = pick(pwr)

    return out


def _should_include_streams(*, sport: str, is_focus: bool) -> bool:
    if not is_focus:
        return False
    if not ENABLE_STREAMS_FOR_FOCUS:
        return False
    return sport in ("run", "ride")


def _should_include_splits_laps(*, sport: str, is_focus: bool) -> bool:
    if not is_focus:
        return False
    return sport in ("run", "ride")


# =========================
# activity block builders
# =========================

def _build_activity_block_from_rows(
    *,
    activity_id: int,
    summary_row: Dict[str, Any],
    enr_row: Dict[str, Any],
    include_zones: bool = True,
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
    cadence_avg = (
        _to_int(summary_row.get("average_cadence_rpm"))
        or _to_int(summary_row.get("average_cadence"))
        or _to_int(summary_row.get("cadence_avg"))
    )

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

    return out


def _coarsen_activity(item: Dict[str, Any]) -> Dict[str, Any]:
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
        "zones_min": item.get("zones_min"),
    }


def _split_history_0_7_and_8_14(items: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    d0_7: List[Dict[str, Any]] = []
    d8_14_raw: List[Dict[str, Any]] = []

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
            d8_14_raw.append(it)

    d0_7.sort(key=lambda x: int(x.get("days_ago") or 0), reverse=True)
    d8_14_raw.sort(key=lambda x: int(x.get("days_ago") or 0), reverse=True)

    d8_14 = [_coarsen_activity(x) for x in d8_14_raw]
    return d0_7, d8_14


# =========================
# main input builder
# =========================

def build_base_input(user_id: int, activity_id: int) -> Dict[str, Any]:
    return {
        "schema_version": 3,
        "user": {"id": user_id},
        "sport": None,
        "user_input": {
            "source": None,   # "auto" | "user" | "service"
            "comment": None,
        },
        "activity": {
            "activity_id": activity_id,
            "days_ago": None,
            "sport": "other",
            "metrics": {},
            "zones_min": {"z1": None, "z2": None, "z3": None, "z4": None, "z5": None},
            "splits_minified": None,
            "laps_minified": None,
            "streams_minified": None,
        },
        "history": {"days_0_7": [], "days_8_14": []},
        "context": {"recovery": None, "recent_load": None, "hr_zones_bpm": None},
    }


def build_input_from_db(
    user_id: int,
    *,
    activity_id: int,
    ctx: AuthCtx,
    source: Optional[str] = None,
    user_comment: Optional[str] = None,
) -> Dict[str, Any]:
    input_data = build_base_input(user_id, activity_id)

    # attach source + comment early
    src = _sanitize_source(source)
    if src:
        input_data["user_input"]["source"] = src

    safe_comment = _sanitize_user_comment(user_comment)
    if safe_comment:
        input_data["user_input"]["comment"] = safe_comment

    recovery = service_build_recovery_block_for_analysis(user_id, ctx=ctx)
    recent_load_raw = service_build_recent_load_block_for_analysis(user_id=user_id, window_days=14, ctx=ctx)
    recent_load = _minify_recent_load_to_week_horizon(recent_load_raw)

    input_data["context"]["recovery"] = recovery
    input_data["context"]["recent_load"] = recent_load

    window_ids: List[int] = []
    if db_fetch_window_activity_ids is not None:
        try:
            window_ids = db_fetch_window_activity_ids(user_id=user_id, window_days=14, ctx=ctx) or []
        except Exception:
            window_ids = []

    all_ids = _dedupe_keep_order([int(activity_id), *window_ids])

    sum_rows = db_get_summary_for_activities(ctx=ctx, user_id=user_id, activity_ids=all_ids) or []
    sum_by_id: Dict[int, Dict[str, Any]] = {}
    for r in sum_rows:
        if not isinstance(r, dict):
            continue
        aid = _get_activity_id(r)
        if aid is None:
            continue
        sum_by_id[aid] = r

    focus_summary = sum_by_id.get(int(activity_id))
    if not isinstance(focus_summary, dict):
        _dbg("[AI][input] missing focus_summary", {"user_id": int(user_id), "activity_id": int(activity_id)})
        return input_data

    focus_sport = _canonical_sport(focus_summary.get("sport_type_fe") or focus_summary.get("sport_type"))
    input_data["sport"] = focus_sport
    input_data["context"]["hr_zones_bpm"] = _extract_hr_zones_bpm_from_ctx(ctx, sport=str(focus_sport or "other"))

    # classify ids by days
    ids_0_7: List[int] = []
    ids_8_14: List[int] = []

    for aid, sr in sum_by_id.items():
        dt_raw = str(sr.get("date") or "")
        date_str = dt_raw[:10] if dt_raw else None
        da = _days_ago(date_str)
        if da is None:
            continue
        try:
            di = int(da)
        except Exception:
            continue
        if 0 <= di <= 7:
            ids_0_7.append(aid)
        elif 8 <= di <= 14:
            ids_8_14.append(aid)

    ids_0_7 = _dedupe_keep_order(ids_0_7)
    ids_8_14 = _dedupe_keep_order(ids_8_14)

    # enrichment only for 0-7 (zones)
    enr_by_id: Dict[int, Dict[str, Any]] = {}
    if ids_0_7:
        enr_rows = db_get_enrichment_for_activities(user_id=user_id, activity_ids=ids_0_7, ctx=ctx) or []
        for r in enr_rows:
            if not isinstance(r, dict):
                continue
            aid = _get_activity_id(r)
            if aid is None:
                continue
            enr_by_id[aid] = r

    # build focus activity block
    focus = _build_activity_block_from_rows(
        activity_id=int(activity_id),
        summary_row=focus_summary,
        enr_row=enr_by_id.get(int(activity_id), {}),
        include_zones=True,
    )

    # focus details policy
    is_focus = True
    sport = str(focus.get("sport") or "other")

    include_streams = _should_include_streams(sport=sport, is_focus=is_focus)
    include_sl = _should_include_splits_laps(sport=sport, is_focus=is_focus)

    _dbg("[AI][focus][policy]", {
        "activity_id": int(activity_id),
        "sport": sport,
        "include_streams": include_streams,
        "include_splits_laps": include_sl,
        "enable_streams_for_focus": ENABLE_STREAMS_FOR_FOCUS,
    })

    # Only if focus is within 0-7 (fresh), add optional details
    if int(activity_id) in ids_0_7:
        if include_streams:
            try:
                streams = db_get_streams_one(user_id=user_id, activity_id=int(activity_id), ctx=ctx)
            except Exception:
                streams = None
            focus["streams_minified"] = _minify_streams_for_ai(streams, sport=sport)
        else:
            focus["streams_minified"] = None

        if include_sl:
            try:
                splits = db_get_activity_splits(user_id=user_id, activity_id=int(activity_id), ctx=ctx)
            except Exception:
                splits = []
            try:
                laps = db_get_activity_laps(user_id=user_id, activity_id=int(activity_id), ctx=ctx)
            except Exception:
                laps = []

            focus["splits_minified"] = _minify_splits(splits, sport=sport, max_items=_splits_max_items(sport))
            focus["laps_minified"] = _minify_laps(laps, sport=sport, max_items=_laps_max_items(sport))
        else:
            focus["splits_minified"] = None
            focus["laps_minified"] = None

    input_data["activity"] = focus

    # build history:
    #  - days_0_7: ONLY summary+zones (NO streams/laps/splits)
    #  - days_8_14: coarsened summary (no zones if not available)
    hist_items: List[Dict[str, Any]] = []

    for aid in ids_0_7:
        if aid == int(activity_id):
            continue
        sr = sum_by_id.get(aid)
        if not isinstance(sr, dict):
            continue

        item = _build_activity_block_from_rows(
            activity_id=aid,
            summary_row=sr,
            enr_row=enr_by_id.get(aid, {}),
            include_zones=True,
        )

        # IMPORTANT: never add streams/splits/laps into history
        item["streams_minified"] = None
        item["splits_minified"] = None
        item["laps_minified"] = None

        hist_items.append(item)

    for aid in ids_8_14:
        if aid == int(activity_id):
            continue
        sr = sum_by_id.get(aid)
        if not isinstance(sr, dict):
            continue

        item = _build_activity_block_from_rows(
            activity_id=aid,
            summary_row=sr,
            enr_row={},            # no enrichment expected here
            include_zones=False,   # keep lighter
        )

        item["streams_minified"] = None
        item["splits_minified"] = None
        item["laps_minified"] = None

        hist_items.append(item)

    d0_7, d8_14 = _split_history_0_7_and_8_14(hist_items)
    input_data["history"]["days_0_7"] = d0_7
    input_data["history"]["days_8_14"] = d8_14

    # ---------- DEBUG payload stats ----------
    try:
        focus_act = input_data.get("activity") or {}
        hist0 = (input_data.get("history") or {}).get("days_0_7") or []
        hist1 = (input_data.get("history") or {}).get("days_8_14") or []

        _dbg("[AI][input][stats]", {
            "user_id": int(user_id),
            "activity_id": int(activity_id),
            "sport": input_data.get("sport"),
            "history_0_7_count": len(hist0),
            "history_8_14_count": len(hist1),
            "focus_has_streams": bool(focus_act.get("streams_minified")),
            "focus_stream_points": (focus_act.get("streams_minified") or {}).get("points")
            if isinstance(focus_act.get("streams_minified"), dict)
            else None,
            "focus_splits_count": len(focus_act.get("splits_minified") or [])
            if isinstance(focus_act.get("splits_minified"), list)
            else 0,
            "focus_laps_count": len(focus_act.get("laps_minified") or [])
            if isinstance(focus_act.get("laps_minified"), list)
            else 0,
            "payload_bytes": _json_bytes(input_data),
            "user_comment_len": len((input_data.get("user_input") or {}).get("comment") or ""),
            "user_source": (input_data.get("user_input") or {}).get("source"),
        })
    except Exception as e:
        print("[AI][input][stats] error", repr(e))

    return input_data