from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, List, Iterable, Tuple
import json

from Services.analytics_RecentLoad import service_build_recent_load_block_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis

from DB.activities_summary import db_get_summary_for_activities, db_fetch_window_activity_ids
from DB.activities_enrichment import db_get_enrichment_for_activities, db_get_review_thread
from DB.activities_splits import db_get_activity_splits
from DB.activities_laps import db_get_activity_laps
from DB.activities_streams import db_get_streams_one
from DB.user_zones import db_user_zones_fetch_latest
from DB.users import db_get_user_display_name

from DB.coach_plan_meta import db_get_active_plan_meta_for_user, db_get_latest_plan_meta_for_user
from DB.coach_plan_daily import db_list_daily_for_user_horizon, db_get_daily_session_by_activity_id
from DB.user_prefs import db_get_pref_single

from Modules.Supabase.auth import AuthCtx

# ============================================================
# CONFIG — token control knobs
# Streams sú vypnuté, splits/laps sa načítavajú len pre focus run/ride
# ============================================================
ENABLE_STREAMS_FOR_FOCUS = False
STREAMS_MAX_POINTS_RUN  = 100
STREAMS_MAX_POINTS_RIDE = 80
SPLITS_MAX_ITEMS_RUN    = 12
SPLITS_MAX_ITEMS_RIDE   = 10
LAPS_MAX_ITEMS_RUN      = 12
LAPS_MAX_ITEMS_RIDE     = 10
THREAD_MAX_ENTRIES_FOR_AI = 6


# ============================================================
# SMALL HELPERS
# ============================================================

def _dbg(tag: str, obj: Dict[str, Any]) -> None:
    """Rýchly debug print — nahradiť loggingom ak treba."""
    print(tag, obj)


def _json_bytes(v: Any) -> int:
    """Vráti veľkosť JSON reprezentácie v bajtoch — na ladenie tokenov."""
    try:
        return len(json.dumps(v, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    except Exception:
        try:
            return len(str(v).encode("utf-8"))
        except Exception:
            return -1


def _round_float(val: Any, decimals: int = 2) -> Optional[float]:
    """Bezpečné zaokrúhlenie na float, None ak vstup chýba."""
    try:
        if val is None or val == "":
            return None
        return round(float(val), decimals)
    except Exception:
        return None


def _to_int(x: Any) -> Optional[int]:
    """Bezpečná konverzia na int cez float (zvláda '165.0')."""
    try:
        if x is None or x == "":
            return None
        return int(float(x))
    except Exception:
        return None


def _get_activity_id(row: Dict[str, Any]) -> Optional[int]:
    """Vytiahne activity_id z DB riadku ako int."""
    try:
        v = row.get("activity_id")
        return int(v) if v is not None else None
    except Exception:
        return None


def _canonical_sport(s: Any) -> str:
    """Normalizuje rôzne názvy sportov na kanonický reťazec (run/ride/strength/swim/other)."""
    if not s:
        return "other"
    v = str(s).lower().strip()
    if v in ("run", "trail", "trail_run") or v.startswith("run"):
        return "run"
    if v in ("ride", "bike", "cycle") or v.startswith(("ride", "bike", "cycle")):
        return "ride"
    if v in ("strength", "gym", "weights") or "strength" in v or "gym" in v:
        return "strength"
    if "swim" in v:
        return "swim"
    return "other"


def _parse_yyyy_mm_dd(s: Any) -> Optional[datetime]:
    """Parsuje dátum vo formáte YYYY-MM-DD na datetime s UTC."""
    try:
        if not s:
            return None
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _days_ago(date_str: Any) -> Optional[int]:
    """Vráti počet dní od dátumu aktivity do dnes."""
    dt = _parse_yyyy_mm_dd(date_str)
    if not dt:
        return None
    d = (datetime.now(timezone.utc).date() - dt.date()).days
    return int(d) if d >= 0 else 0


def _dedupe_keep_order(xs: Iterable[int]) -> List[int]:
    """Odstráni duplikáty zo zoznamu ID, zachová poradie."""
    out: List[int] = []
    seen = set()
    for x in xs:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def _sanitize_user_comment(raw: Optional[str]) -> Optional[str]:
    """Orezá komentár používateľa na max 900 znakov."""
    if raw is None:
        return None
    try:
        s = str(raw).strip()
    except Exception:
        return None
    if not s:
        return None
    if len(s) > 900:
        s = s[:900].rstrip() + "…"
    return s


def _sanitize_source(raw: Optional[str]) -> Optional[str]:
    """Normalizuje source na auto/user/service, inak None."""
    if raw is None:
        return None
    try:
        s = str(raw).strip().lower()
    except Exception:
        return None
    if s in ("auto", "user", "service"):
        return s
    return "auto"


def _pick_smart_indices(total_len: int, max_items: int) -> List[int]:
    """Vyberie rovnomerne rozmiestnené indexy — zachová prvý, posledný a medzibody."""
    if total_len <= max_items:
        return list(range(total_len))
    indices = {0, total_len - 1}
    if max_items > 2:
        step = (total_len - 1) / (max_items - 1)
        for i in range(1, max_items - 1):
            idx = int(round(i * step))
            if 0 <= idx < total_len:
                indices.add(idx)
    return sorted(list(indices))


def _normalize_zone_bounds(z: Any) -> Optional[Dict[str, Optional[int]]]:
    """Normalizuje rôzne formáty zónových hraníc na {low, high}."""
    if z is None:
        return None
    if isinstance(z, dict):
        return {
            "low": _to_int(z.get("low") or z.get("min")),
            "high": _to_int(z.get("high") or z.get("max")),
        }
    if isinstance(z, (list, tuple)) and len(z) >= 2:
        return {"low": _to_int(z[0]), "high": _to_int(z[1])}
    if isinstance(z, str) and "-" in z:
        try:
            a, b = z.split("-", 1)
            return {"low": _to_int(a.strip()), "high": _to_int(b.strip())}
        except Exception:
            pass
    return None


def _extract_hr_zones_bpm_from_ctx(ctx: AuthCtx, sport: str) -> Optional[Dict[str, Any]]:
    """Vytiahne HR zóny z AuthCtx objektu pre daný sport."""
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


def _minify_recent_load_to_week_horizon(recent_load: Any) -> Any:
    """Osekáva recent_load na 2 týždne (aktuálny + predchádzajúci) pre úsporu tokenov."""
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
        idx = _to_int(w.get("week_index_from_now"))
        if idx is None or idx not in keep_idx:
            continue
        out_weeks.append({
            "week_index_from_now": idx,
            "week_start_iso": w.get("week_start_iso"),
            "week_end_iso": w.get("week_end_iso"),
            "run_minutes": _to_int(w.get("run_minutes")),
            "total_minutes": _to_int(w.get("total_minutes")),
            "hard_sessions": _to_int(w.get("hard_sessions")),
            "strength_sessions": _to_int(w.get("strength_sessions")),
        })
    out_weeks.sort(key=lambda x: int(x.get("week_index_from_now", 0)))
    return {
        "schema_version": recent_load.get("schema_version"),
        "window_days": recent_load.get("window_days"),
        "weeks": out_weeks,
    }


def _minify_thread_for_ai(
    thread: List[Dict[str, Any]], *, max_entries: int = THREAD_MAX_ENTRIES_FOR_AI
) -> List[Dict[str, Any]]:
    """
    Osekáva predchádzajúci review thread pre AI — necháva len posledných N entries.
    Z assistant review necháva len review_text + next_day_plan (zvyšok je
    odvoditeľný z aktuálnych dát aktivity a netreba ho duplikovať).
    """
    if not thread:
        return []
    recent = thread[-max_entries:]
    out: List[Dict[str, Any]] = []
    for entry in recent:
        if not isinstance(entry, dict):
            continue
        role = entry.get("role")
        if role == "user":
            out.append({
                "role": "user",
                "comment": entry.get("comment"),
                "is_race_effort": bool(entry.get("is_race_effort")),
            })
        elif role == "assistant":
            rev = entry.get("review") or {}
            out.append({
                "role": "assistant",
                "review_text": rev.get("review_text"),
                "next_day_plan": rev.get("next_day_plan"),
            })
    return out


def _minify_preview_thread_for_ai(
    thread: List[Dict[str, Any]], *, max_entries: int = THREAD_MAX_ENTRIES_FOR_AI
) -> List[Dict[str, Any]]:
    """
    Osekáva pred-tréningový preview thread (konverzácia PRED vykonaním session,
    napr. "som unavený, zľahči mi to") pre AI review. Tvar sa líši od review_thread
    — reply_text/changed sú priamo na entry, nie vnorené v 'review' — preto
    samostatná funkcia namiesto zdieľania s _minify_thread_for_ai.
    """
    if not thread:
        return []
    recent = thread[-max_entries:]
    out: List[Dict[str, Any]] = []
    for entry in recent:
        if not isinstance(entry, dict):
            continue
        role = entry.get("role")
        if role == "user":
            out.append({
                "role": "user",
                "comment": entry.get("comment"),
                "requested_change": bool(entry.get("request_change")),
            })
        elif role == "assistant":
            out.append({
                "role": "assistant",
                "reply_text": entry.get("reply_text"),
                "session_was_changed": bool(entry.get("changed")),
            })
    return out


def _splits_max_items(sport: str) -> int:
    return SPLITS_MAX_ITEMS_RUN if sport == "run" else SPLITS_MAX_ITEMS_RIDE


def _laps_max_items(sport: str) -> int:
    return LAPS_MAX_ITEMS_RUN if sport == "run" else LAPS_MAX_ITEMS_RIDE


def _streams_max_points(sport: str) -> int:
    return STREAMS_MAX_POINTS_RUN if sport == "run" else STREAMS_MAX_POINTS_RIDE


def _minify_splits(rows: List[Dict[str, Any]], *, sport: str, max_items: int) -> List[Dict[str, Any]]:
    """Vyberá reprezentatívne splits (prvý, posledný, medzibody) a ponecháva len kľúčové metriky."""
    if not rows:
        return []
    indices = _pick_smart_indices(len(rows), max_items)
    out: List[Dict[str, Any]] = []
    for i in indices:
        r = rows[i]
        if not isinstance(r, dict):
            continue
        item: Dict[str, Any] = {
            "i": r.get("split_index"),
            "dist_m": _to_int(r.get("distance_m")),
            "moving_s": _to_int(r.get("moving_time_s")),
            "elevation_diff_m": _to_int(r.get("elevation_diff_m")),
            "avg_hr": _to_int(r.get("avg_hr_bpm")),
        }
        if sport == "run":
            item["pace_s_km"] = _to_int(r.get("pace_seconds_per_km"))
            item["avg_cad"] = _to_int(r.get("average_cadence_rpm") or r.get("cadence_avg"))
        elif sport == "ride":
            item["avg_pwr"] = _to_int(r.get("average_power_w") or r.get("avg_power_w"))
        out.append(item)
    return out


def _minify_laps(rows: List[Dict[str, Any]], *, sport: str, max_items: int) -> List[Dict[str, Any]]:
    """Vyberá reprezentatívne laps a ponecháva len kľúčové metriky."""
    if not rows:
        return []
    indices = _pick_smart_indices(len(rows), max_items)
    out: List[Dict[str, Any]] = []
    for i in indices:
        r = rows[i]
        if not isinstance(r, dict):
            continue
        item: Dict[str, Any] = {
            "i": r.get("lap_index"),
            "dist_m": _to_int(r.get("distance_m")),
            "moving_s": _to_int(r.get("moving_time_s")),
            "elevation_diff_m": _to_int(r.get("elevation_diff_m")),
            "avg_hr": _to_int(r.get("avg_hr_bpm")),
        }
        if sport == "run":
            item["pace_s_km"] = _to_int(r.get("pace_seconds_per_km"))
        elif sport == "ride":
            item["avg_pwr"] = _to_int(r.get("average_power_w") or r.get("avg_power_w"))
        out.append(item)
    return out


def _minify_streams_for_ai(
    row: Optional[Dict[str, Any]], *, sport: str
) -> Optional[Dict[str, Any]]:
    """Osekáva stream dáta na max body rovnomerne rozložené po čase."""
    if not isinstance(row, dict):
        return None
    time_s = row.get("time_s") or []
    if not isinstance(time_s, list) or not time_s:
        return None
    hr = row.get("heartrate_bpm") or []
    pwr = row.get("power_w") or []
    idxs = _pick_smart_indices(len(time_s), _streams_max_points(sport))

    def pick(arr: Any) -> List[Any]:
        if not isinstance(arr, list) or not arr:
            return []
        return [arr[i] for i in idxs if i < len(arr)]

    out: Dict[str, Any] = {
        "points": len(idxs),
        "time_s": pick(time_s),
        "heartrate_bpm": pick(hr),
    }
    if sport == "ride":
        out["power_w"] = pick(pwr)
    return out


def _should_include_streams(*, sport: str, is_focus: bool) -> bool:
    """Streams sa posielajú len ak sú globálne zapnuté a je to focus aktivita."""
    if not is_focus or not ENABLE_STREAMS_FOR_FOCUS:
        return False
    return sport in ("run", "ride")


def _should_include_splits_laps(*, sport: str, is_focus: bool) -> bool:
    """Splits a laps sa načítavajú len pre focus run/ride aktivitu."""
    return is_focus and sport in ("run", "ride")


def _build_activity_block_from_rows(
    *,
    activity_id: int,
    summary_row: Dict[str, Any],
    enr_row: Dict[str, Any],
    include_intensity: bool = True,
) -> Dict[str, Any]:
    """
    Zostaví štandardný activity blok z DB riadkov.
    include_intensity=True pridá intensity label (easy/moderate/hard) z zónových minút.
    """
    dt_raw = str(summary_row.get("date") or "")
    date_str = dt_raw[:10] if dt_raw else None
    sport = _canonical_sport(
        summary_row.get("sport_type_fe") or summary_row.get("sport_type")
    )
    dist_m = _round_float(summary_row.get("distance_m"))
    moving_s = _round_float(summary_row.get("moving_time_s"))
    elev_gain_m = _round_float(summary_row.get("elevation_gain_m"))
    avg_hr = _to_int(summary_row.get("average_heartrate_bpm"))
    max_hr = _to_int(summary_row.get("max_heartrate_bpm"))
    cadence_avg = _to_int(
        summary_row.get("average_cadence_rpm")
    ) or _to_int(summary_row.get("cadence_avg"))
    dur_min = (moving_s / 60.0) if (moving_s and moving_s > 0) else None
    dist_km = (dist_m / 1000.0) if (dist_m and dist_m > 0) else None
    pace_s_per_km = _to_int(summary_row.get("pace_seconds_per_km"))

    out: Dict[str, Any] = {
        "activity_id": activity_id,
        "days_ago": _days_ago(date_str),
        "sport": sport,
        "metrics": {
            "date": date_str,
            "distance_km": _round_float(dist_km, 2),
            "duration_min": _round_float(dur_min, 1),
            "pace_s_per_km": pace_s_per_km,
            "avg_hr_bpm": avg_hr,
            "max_hr_bpm": max_hr,
            "elevation_gain_m": _to_int(elev_gain_m),
            "cadence_avg": cadence_avg,
        },
    }

    if include_intensity:
        z45 = (_round_float(enr_row.get("z4_min")) or 0) + (
            _round_float(enr_row.get("z5_min")) or 0
        )
        z12 = (_round_float(enr_row.get("z1_min")) or 0) + (
            _round_float(enr_row.get("z2_min")) or 0
        )
        intensity = "easy"
        if z45 > 5:
            intensity = "hard"
        elif z45 > 0 or (dur_min and z12 < (dur_min * 0.8)):
            intensity = "moderate"
        out["intensity"] = intensity

    return out


def _coarsen_activity(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Zredukuje aktivitu z 8-14 dňového okna na minimum —
    AI potrebuje len hrubý obraz záťaže, nie detaily.
    """
    m = item.get("metrics") or {}
    return {
        "activity_id": item.get("activity_id"),
        "days_ago": item.get("days_ago"),
        "sport": item.get("sport"),
        "intensity": item.get("intensity"),
        "metrics": {
            "date": m.get("date"),
            "distance_km": m.get("distance_km"),
            "duration_min": m.get("duration_min"),
            "avg_hr_bpm": m.get("avg_hr_bpm"),
        },
    }


def _split_history_0_7_and_8_14(
    items: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Rozdelí históriu aktivít na 0-7 dní (detailné) a 8-14 dní (hrubé)."""
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
    return d0_7, [_coarsen_activity(x) for x in d8_14_raw]


# ============================================================
# DB HELPERS
# ============================================================

def _real_db_get_plans_for_today_tomorrow(
    user_id: int, date_str_today: str, ctx: AuthCtx
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Načíta denný plán na dnes a zajtra z DB — pre kontext AI."""
    try:
        daily_rows = db_list_daily_for_user_horizon(user_id=user_id, horizon_days=2, ctx=ctx) or []
        dt_today = datetime.strptime(date_str_today, "%Y-%m-%d")
        date_str_tomorrow = (dt_today + timedelta(days=1)).strftime("%Y-%m-%d")
        plan_today = next(
            (r for r in daily_rows if str(r.get("plan_date"))[:10] == date_str_today), None
        )
        plan_tomorrow = next(
            (r for r in daily_rows if str(r.get("plan_date"))[:10] == date_str_tomorrow), None
        )
        return plan_today, plan_tomorrow
    except Exception as e:
        print(f"❌ [AI][builder] Failed to fetch plans for today/tomorrow: {repr(e)}")
        return None, None

# ============================================================
# MAIN INPUT BUILDER
# ============================================================

def build_base_input(user_id: int, activity_id: int) -> Dict[str, Any]:
    """Vráti prázdnu kostru context_payload so všetkými kľúčmi."""
    return {
        "schema_version": 4,
        "user": {"id": user_id},
        "sport": None,
        "user_input": {
            "source": None,
            "comment": None,
            "is_race_effort": False,
        },
        "activity": {
            "activity_id": activity_id,
            "days_ago": None,
            "sport": "other",
            "metrics": {},
            "intensity": None,
            "splits_minified": None,
            "laps_minified": None,
            "streams_minified": None,
        },
        "history": {"days_0_7": [], "days_8_14": []},
        "context": {
            "recovery": None,
            "recent_load": None,
            "hr_zones_bpm": None,
            "user_zones": None,
            "injury_state": None,
            "plan_today": None,
            "plan_tomorrow": None,
            "review_thread": [],
            "pre_session_conversation": [],
        },
    }


def build_input_from_db(
    user_id: int,
    *,
    activity_id: int,
    ctx: AuthCtx,
    source: Optional[str] = None,
    user_comment: Optional[str] = None,
    is_race_effort: Optional[bool] = False,
) -> Dict[str, Any]:
    """
    Hlavná funkcia buildera — zostaví kompletný context_payload pre AI
    z DB dát: aktivita, história, recovery, recent_load, zóny, plán, preferencie,
    predchádzajúci review thread (ak ide o reply na predošlé review), a
    pred-tréningovú konverzáciu (session preview) ak bola aktivita namapovaná
    na naplánovanú session, na ktorej prebehla konverzácia PRED tréningom.
    """
    input_data = build_base_input(user_id, activity_id)

    # User input
    src = _sanitize_source(source)
    if src:
        input_data["user_input"]["source"] = src
    safe_comment = _sanitize_user_comment(user_comment)
    if safe_comment:
        input_data["user_input"]["comment"] = safe_comment
    if is_race_effort:
        input_data["user_input"]["is_race_effort"] = True

    # Recovery + recent load
    recovery = service_build_recovery_block_for_analysis(user_id, ctx=ctx)
    recent_load_raw = service_build_recent_load_block_for_analysis(
        user_id=user_id, window_days=14, ctx=ctx
    )
    input_data["context"]["recovery"] = recovery
    input_data["context"]["recent_load"] = _minify_recent_load_to_week_horizon(recent_load_raw)

    # Predchádzajúci review thread — kontext pri reply na predošlé review
    try:
        existing_thread = db_get_review_thread(user_id=user_id, activity_id=activity_id, ctx=ctx)
        input_data["context"]["review_thread"] = _minify_thread_for_ai(existing_thread)
    except Exception as e:
        print(f"❌ [AI][builder] Failed to fetch review thread: {repr(e)}")

    # Pred-tréningová konverzácia (session preview) — ak bola táto aktivita
    # namapovaná na naplánovanú session, na ktorej prebehla konverzácia PRED
    # tréningom (napr. "som unavený, zľahči mi to"), AI o nej musí vedieť,
    # aby nesprávne neinterpretovalo zámerne zľahčený výkon ako zlyhanie.
    try:
        matched_session = db_get_daily_session_by_activity_id(
            user_id=user_id, activity_id=activity_id, ctx=ctx
        )
        if matched_session:
            preview_thread_raw = matched_session.get("preview_thread") or []
            if preview_thread_raw:
                input_data["context"]["pre_session_conversation"] = _minify_preview_thread_for_ai(
                    preview_thread_raw
                )
    except Exception as e:
        print(f"❌ [AI][builder] Failed to fetch matched session preview_thread: {repr(e)}")

    # Personalizácia: meno, pohlavie, zranenia
    try:
        display_name = db_get_user_display_name(user_id, ctx=ctx)
        if display_name:
            input_data["user"]["first_name"] = display_name

        prefs_row = db_get_pref_single(user_id=user_id, key="coach.prefs", ctx=ctx)
        if isinstance(prefs_row, dict):
            val = prefs_row.get("value")
            prefs_data = val if isinstance(val, dict) else prefs_row
            gender = prefs_data.get("gender")
            if gender in ("male", "female"):
                input_data["user"]["gender"] = gender
            injuries = prefs_data.get("injuries")
            if isinstance(injuries, list) and len(injuries) > 0:
                input_data["context"]["injury_state"] = {"active_injuries": injuries}
    except Exception as e:
        print(f"❌ [AI][builder] Failed to fetch user personalization data: {repr(e)}")

    # Načítanie ID aktivít z okna 14 dní
    window_ids: List[int] = []
    try:
        window_ids = db_fetch_window_activity_ids(
            user_id=user_id, window_days=14, ctx=ctx
        ) or []
    except Exception:
        window_ids = []

    all_ids = _dedupe_keep_order([int(activity_id), *window_ids])

    # Summary pre všetky aktivity v okne
    sum_rows = (
        db_get_summary_for_activities(ctx=ctx, user_id=user_id, activity_ids=all_ids) or []
    )
    sum_by_id: Dict[int, Dict[str, Any]] = {
        aid: r
        for r in sum_rows
        if isinstance(r, dict) and (aid := _get_activity_id(r)) is not None
    }

    focus_summary = sum_by_id.get(int(activity_id))
    if not isinstance(focus_summary, dict):
        _dbg(
            "❌ [AI][input] missing focus_summary",
            {"user_id": int(user_id), "activity_id": int(activity_id)},
        )
        return input_data

    focus_sport = _canonical_sport(
        focus_summary.get("sport_type_fe") or focus_summary.get("sport_type")
    )
    input_data["sport"] = focus_sport

    # Plán na dnes a zajtra (dátum z aktivity)
    dt_raw = str(focus_summary.get("date") or "")
    date_str_today = dt_raw[:10] if dt_raw else None
    if date_str_today:
        plan_today, plan_tomorrow = _real_db_get_plans_for_today_tomorrow(
            user_id, date_str_today, ctx
        )
        if plan_today:
            input_data["context"]["plan_today"] = plan_today
        if plan_tomorrow:
            input_data["context"]["plan_tomorrow"] = plan_tomorrow

    # HR zóny — legacy z ctx + nové z DB
    legacy_zones = _extract_hr_zones_bpm_from_ctx(ctx, sport=str(focus_sport or "other"))
    input_data["context"]["hr_zones_bpm"] = legacy_zones

    try:
        user_zones_row = db_user_zones_fetch_latest(
            user_id=user_id, sport_raw=focus_sport, ctx=ctx
        )
        if not user_zones_row:
            user_zones_row = db_user_zones_fetch_latest(
                user_id=user_id, sport_raw=None, ctx=ctx
            )
        if user_zones_row:
            input_data["context"]["user_zones"] = {
                "source": "db_users_zones",
                "sport": user_zones_row.get("sport"),
                "z1": {"min": 0, "max": user_zones_row.get("z1_max_bpm")},
                "z2": {
                    "min": user_zones_row.get("z2_min_bpm"),
                    "max": user_zones_row.get("z2_max_bpm"),
                },
                "z3": {
                    "min": user_zones_row.get("z3_min_bpm"),
                    "max": user_zones_row.get("z3_max_bpm"),
                },
                "z4": {
                    "min": user_zones_row.get("z4_min_bpm"),
                    "max": user_zones_row.get("z4_max_bpm"),
                },
                "z5": {
                    "min": user_zones_row.get("z5_min_bpm"),
                    "max": user_zones_row.get("hr_max_bpm"),
                },
            }
    except Exception as e:
        print(f"❌ [AI][builder] user_zones fetch failed: {repr(e)}")

    # Rozdelenie ID do časových okien
    ids_0_7: List[int] = []
    ids_8_14: List[int] = []
    for aid, sr in sum_by_id.items():
        hist_date_str = str(sr.get("date") or "")[:10]
        da = _days_ago(hist_date_str)
        if da is None:
            continue
        if 0 <= da <= 7:
            ids_0_7.append(aid)
        elif 8 <= da <= 14:
            ids_8_14.append(aid)

    ids_0_7 = _dedupe_keep_order(ids_0_7)
    ids_8_14 = _dedupe_keep_order(ids_8_14)

    # Enrichment len pre posledných 7 dní (zóny, intensita)
    enr_by_id: Dict[int, Dict[str, Any]] = {}
    if ids_0_7:
        enr_rows = (
            db_get_enrichment_for_activities(
                user_id=user_id, activity_ids=ids_0_7, ctx=ctx
            )
            or []
        )
        enr_by_id = {
            aid: r
            for r in enr_rows
            if isinstance(r, dict) and (aid := _get_activity_id(r)) is not None
        }

    # Focus aktivita — plný blok + splits/laps/streams ak povolené
    focus = _build_activity_block_from_rows(
        activity_id=int(activity_id),
        summary_row=focus_summary,
        enr_row=enr_by_id.get(int(activity_id), {}),
        include_intensity=True,
    )

    sport = str(focus.get("sport") or "other")

    if int(activity_id) in ids_0_7:
        focus["streams_minified"] = (
            _minify_streams_for_ai(
                db_get_streams_one(
                    user_id=user_id, activity_id=int(activity_id), ctx=ctx
                ),
                sport=sport,
            )
            if _should_include_streams(sport=sport, is_focus=True)
            else None
        )

        if _should_include_splits_laps(sport=sport, is_focus=True):
            try:
                focus["splits_minified"] = _minify_splits(
                    db_get_activity_splits(
                        user_id=user_id, activity_id=int(activity_id), ctx=ctx
                    )
                    or [],
                    sport=sport,
                    max_items=_splits_max_items(sport),
                )
            except Exception:
                focus["splits_minified"] = []
            try:
                focus["laps_minified"] = _minify_laps(
                    db_get_activity_laps(
                        user_id=user_id, activity_id=int(activity_id), ctx=ctx
                    )
                    or [],
                    sport=sport,
                    max_items=_laps_max_items(sport),
                )
            except Exception:
                focus["laps_minified"] = []
        else:
            focus["splits_minified"] = None
            focus["laps_minified"] = None

    input_data["activity"] = focus

    # História — 0-7 dní detailne, 8-14 hrubšie
    hist_items: List[Dict[str, Any]] = []

    for aid in ids_0_7:
        if aid == int(activity_id):
            continue
        sr = sum_by_id.get(aid)
        if not sr:
            continue
        item = _build_activity_block_from_rows(
            activity_id=aid,
            summary_row=sr,
            enr_row=enr_by_id.get(aid, {}),
            include_intensity=True,
        )
        item.update(
            {"streams_minified": None, "splits_minified": None, "laps_minified": None}
        )
        hist_items.append(item)

    for aid in ids_8_14:
        if aid == int(activity_id):
            continue
        sr = sum_by_id.get(aid)
        if not sr:
            continue
        item = _build_activity_block_from_rows(
            activity_id=aid,
            summary_row=sr,
            enr_row={},
            include_intensity=False,
        )
        item.update(
            {"streams_minified": None, "splits_minified": None, "laps_minified": None}
        )
        hist_items.append(item)

    d0_7, d8_14 = _split_history_0_7_and_8_14(hist_items)
    input_data["history"]["days_0_7"] = d0_7
    input_data["history"]["days_8_14"] = d8_14

    return input_data
