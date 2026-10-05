# Services/AI/athlete_state/builders.py
"""
Zostavenie vstupného kontextu pre analýzu stavu športovca.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from DB.activities_enrichment import db_get_enrichment_for_activities
from DB.activities_laps import db_get_activity_laps_batch
from DB.activities_splits import db_get_activity_splits_batch
from DB.activities_summary import db_get_recent_activity_ids, db_get_summary_for_activities
from DB.profile_static import db_fetch_static_basic
from DB.user_metrics import db_get_latest_metric
from DB.user_pace_history import db_get_latest_paces
from Services.AI.utils.others import round_sets
from Modules.Supabase.auth import AuthCtx
from Services.analytics_RecentLoad import service_build_recent_load_block_for_analysis
from Services.coach_external_events import service_build_external_events_block_for_analysis
from Services.coach_plan_meta import service_build_active_plan_block_for_analysis
from Services.user_bests import service_build_bests_block_for_analysis
from Services.user_prefs import service_load_coach_prefs_for_analysis
from Services.user_recovery import service_build_recovery_block_for_analysis
from Services.user_thresholds import service_build_thresholds_block_for_analysis
from Services.user_zones import service_build_zones_block_for_analysis


# ============================================================
# HELPERS
# ============================================================

def _to_float(x: Any) -> Optional[float]:
    """Bezpečná konverzia na float."""
    try:
        if x is None or x == "":
            return None
        return float(x)
    except Exception:  # noqa: BLE001
        return None


def _to_int(x: Any) -> Optional[int]:
    """Bezpečná konverzia na int cez float (zvláda '165.0')."""
    try:
        if x is None or x == "":
            return None
        return int(x)
    except Exception:  # noqa: BLE001
        return None


def _canonical_sport(s: Any) -> str:
    """Normalizuje sport na run/ride/strength/swim/other."""
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
    """Parsuje YYYY-MM-DD na datetime UTC."""
    try:
        if not s:
            return None
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:  # noqa: BLE001
        return None


def _days_ago(date_str: Any) -> Optional[int]:
    """Počet dní od dátumu do dnes."""
    dt = _parse_yyyy_mm_dd(date_str)
    if not dt:
        return None
    d = (datetime.now(timezone.utc).date() - dt.date()).days
    return int(d) if d >= 0 else 0


def _days_from_today(date_str: Any) -> Optional[int]:
    """Počet dní od dnes do dátumu (záporné = minulosť)."""
    dt = _parse_yyyy_mm_dd(date_str)
    if not dt:
        return None
    return int((dt.date() - datetime.now(timezone.utc).date()).days)


def _rel_day_label(date_str: Optional[str]) -> Optional[str]:
    """Dátum ako relatívny label: 'today', 'today-1', 'today-3'."""
    dt = _parse_yyyy_mm_dd(date_str or "")
    if not dt:
        return date_str
    d = (datetime.now(timezone.utc).date() - dt.date()).days
    if d <= 0:
        return "today"
    return f"today-{int(d)}"


def _bests_dates_to_days_ago(bests: Dict[str, Any]) -> Dict[str, Any]:
    """Prevedie absolútne dátumy v bests na days_ago — menej tokenov."""
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


def _pick_smart_indices(total_len: int, max_items: int) -> List[int]:
    """Rovnomerne rozmiestnené indexy — prvý, posledný, medzibody."""
    if total_len <= max_items:
        return list(range(total_len))
    indices = {0, total_len - 1}
    step = (total_len - 1) / (max_items - 1)
    for i in range(1, max_items - 1):
        indices.add(int(round(i * step)))
    return sorted(list(indices))


# ============================================================
# PROFILE
# ============================================================

def _load_user_profile_for_analysis(user_id: int, ctx: AuthCtx) -> Dict[str, Any]:
    """Základný profil: vek, pohlavie, výška, váha."""
    stat = db_fetch_static_basic(user_id=user_id, ctx=ctx) or {}
    age = None
    birth_date = stat.get("birth_date")
    if birth_date:
        try:
            d = date.fromisoformat(birth_date[:10])
            t = date.today()
            age = t.year - d.year - ((t.month, t.day) < (d.month, d.day))
        except Exception:  # noqa: BLE001
            pass
    w_row = db_get_latest_metric(user_id, "weight_kg", ctx=ctx)
    weight_kg = (
        float(w_row["value_num"]) if w_row and w_row.get("value_num") else None
    )
    return {
        "id": user_id,
        "sex": stat.get("sex"),
        "age": age,
        "height_cm": stat.get("height_cm"),
        "weight_kg": weight_kg,
    }


# ============================================================
# SILOVÉ LOGY (strength_sessions)
# ============================================================
# Analýza athléta stála pôvodne výhradne na Strava aktivitách, takže o
# posilňovni nevedela nič - capabilities.strength AI odhadovala naslepo.
# Sem ide zhustený prehľad z reálne zapísaných tréningov: koľko sa cvičí,
# ako rastie objem, čo sa deje s hlavnými cvikmi a ako je rozložený objem
# na svalové partie. Celé logy neposielame (stovky sérií = tisíce tokenov).

STRENGTH_LOOKBACK_WEEKS = 8
STRENGTH_MAX_KEY_LIFTS = 5
STRENGTH_MIN_SESSIONS_FOR_TREND = 2


def _strength_work_sets(ex: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Pracovné série (bez rozcvičovacích) so zapísanými opakovaniami."""
    return [
        s
        for s in (ex.get("sets") or [])
        if isinstance(s, dict) and not s.get("is_warmup") and s.get("reps")
    ]


def _build_strength_block(
    rows: List[Dict[str, Any]], catalog_by_id: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Zhustí odcvičené silové tréningy do bloku pre AI.

    Objem sa ráta len z cvikov meraných na opakovania - pri planku je
    "reps" počet sekúnd a to by objem skreslilo. Pri cvikoch s vlastnou
    váhou bez prídavného závažia (zhyby, kliky) sa progres sleduje
    opakovaniami, nie kilami.
    """
    sessions: List[Dict[str, Any]] = []
    per_ex: Dict[str, List[Dict[str, Any]]] = {}

    for row in rows or []:
        log = row.get("log")
        if not isinstance(log, dict):
            continue
        d = _days_ago(row.get("session_date"))
        if d is None:
            continue

        volume = 0.0
        had_work = False
        for ex in log.get("exercises") or []:
            if not isinstance(ex, dict):
                continue
            ex_id = ex.get("exercise_id")
            ws = _strength_work_sets(ex)
            if not ex_id or not ws:
                continue
            had_work = True

            meta = catalog_by_id.get(ex_id) or {}
            if (meta.get("measure") or "reps") == "reps":
                for s in ws:
                    if s.get("weight_kg") and s.get("reps"):
                        volume += float(s["weight_kg"]) * int(s["reps"])

            top = max(ws, key=lambda s: (s.get("weight_kg") or 0, s.get("reps") or 0))
            per_ex.setdefault(str(ex_id), []).append(
                {
                    "days_ago": d,
                    "top_weight_kg": top.get("weight_kg"),
                    "top_reps": top.get("reps"),
                    "load_mode": meta.get("load_mode") or "external",
                    "measure": meta.get("measure") or "reps",
                }
            )

        if had_work:
            sessions.append({"days_ago": d, "volume_kg": round(volume)})

    if not sessions:
        return None

    sessions.sort(key=lambda s: s["days_ago"])
    last_28 = [s for s in sessions if s["days_ago"] <= 28]
    prev_28 = [s for s in sessions if 28 < s["days_ago"] <= 56]

    vol_last = sum(s["volume_kg"] for s in last_28)
    vol_prev = sum(s["volume_kg"] for s in prev_28)
    change_pct = round((vol_last - vol_prev) / vol_prev * 100) if vol_prev > 0 else None

    key_lifts: List[Dict[str, Any]] = []
    for ex_id, entries in per_ex.items():
        if len(entries) < STRENGTH_MIN_SESSIONS_FOR_TREND:
            continue
        entries.sort(key=lambda e: e["days_ago"])
        newest, oldest = entries[0], entries[-1]
        bodyweight_only = (
            newest["load_mode"] == "bodyweight_plus" and not newest.get("top_weight_kg")
        )

        item: Dict[str, Any] = {
            "exercise_id": ex_id,
            "sessions": len(entries),
            "days_since_last": newest["days_ago"],
        }
        if bodyweight_only:
            item["last_top_reps"] = newest.get("top_reps")
            if oldest.get("top_reps") and newest.get("top_reps"):
                item["change_reps"] = int(newest["top_reps"]) - int(oldest["top_reps"])
        else:
            item["last_top_kg"] = newest.get("top_weight_kg")
            item["last_top_reps"] = newest.get("top_reps")
            if oldest.get("top_weight_kg") and newest.get("top_weight_kg"):
                item["change_kg"] = round(
                    float(newest["top_weight_kg"]) - float(oldest["top_weight_kg"]), 1
                )
        key_lifts.append(item)

    # najprv čo sa cvičí najčastejšie, potom najväčší posun
    key_lifts.sort(
        key=lambda k: (k["sessions"], abs(k.get("change_kg") or k.get("change_reps") or 0)),
        reverse=True,
    )

    weeks_span = max(1, round((sessions[-1]["days_ago"] + 1) / 7))
    return {
        "weeks_covered": min(STRENGTH_LOOKBACK_WEEKS, weeks_span),
        "sessions_last_28d": len(last_28),
        # PREČO /4 a nie /weeks_span: model písal "3 tréningy za 28 dní
        # (priemer 1,5 týždenne)" - priemer a počet musia byť z toho istého okna
        "sessions_per_week_avg": round(len(last_28) / 4, 2),
        "days_since_last_session": sessions[0]["days_ago"],
        "volume_last_28d_kg": vol_last or None,
        "volume_change_pct_vs_prev_28d": change_pct,
        "key_lifts": key_lifts[:STRENGTH_MAX_KEY_LIFTS],
    }


def build_strength_log_block_for_analysis(
    user_id: int, *, ctx: AuthCtx, weeks_back: int = STRENGTH_LOOKBACK_WEEKS
) -> Optional[Dict[str, Any]]:
    """
    Blok o reálne odcvičenej sile + týždenný objem na svalové partie.

    'muscle_volume' je to isté, čo vidí athlete v karte "Objem na partie" -
    koľko sérií na partiu má tento týždeň odcvičených, koľko má ešte
    naplánovaných a aký je cieľ. AI tak hovorí rovnakou rečou ako UI.

    Zlyhanie je non-fatal - analýza musí prejsť aj bez tohto bloku.
    """
    try:
        from Configs.strength_catalog import CATALOG_BY_ID
        from Services.strength_sessions import (
            service_get_muscle_volume_overview,
            service_list_strength_sessions,
        )

        rows = service_list_strength_sessions(
            user_id=user_id, weeks_back=weeks_back, limit=200, ctx=ctx
        )
        block = _build_strength_block(rows, CATALOG_BY_ID) if rows else None
    except Exception as e:  # noqa: BLE001
        print(f"[AS][builder] strength log block failed: {repr(e)}")
        return None

    # Objem na partie má zmysel aj bez histórie zdvihov (napr. prvý týždeň),
    # preto sa ráta samostatne a blok vznikne aj keď _build_strength_block
    # vráti None.
    try:
        vol = service_get_muscle_volume_overview(user_id=user_id, weeks_back=4, ctx=ctx)
        muscles = [
            {
                "muscle": m["muscle"],
                "sets_done": round_sets(m["sets_this_week"]),
                "sets_planned": round_sets(m["sets_planned"]),
                "target": round_sets(m["target"]),
                "status": m["status"],
            }
            for m in (vol.get("muscles") or [])
            if m["sets_this_week"] > 0 or m["sets_planned"] > 0 or m["target"] > 0
        ]
        if muscles:
            block = block or {}
            block["muscle_volume"] = {
                "goal": vol.get("goal"),
                "run_volume_tier": vol.get("run_volume_tier"),
                "muscles": muscles,
            }
    except Exception as e:  # noqa: BLE001
        print(f"[AS][builder] muscle volume block failed: {repr(e)}")

    return block or None


# ============================================================
# EXTERNAL EVENTS
# ============================================================

def _minify_external_events_for_ai(ext: Any) -> Any:
    """Osekáva external events na kľúčové polia s relatívnymi dátumami."""
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


# ============================================================
# SEGMENTS
# ============================================================

def _build_segments_from_rows(
    rows: List[Dict[str, Any]], max_items: int = 8
) -> List[Dict[str, Any]]:
    """
    Minifikované segmenty z laps alebo splits riadkov.
    Vyberie max_items rovnomerne rozmiestnených bodov.
    """
    if len(rows) < 2:
        return []
    idxs = _pick_smart_indices(len(rows), max_items)
    segments: List[Dict[str, Any]] = []
    for i in idxs:
        lap = rows[i]
        dist = _to_float(lap.get("distance_m"))
        time_s = _to_float(lap.get("moving_time_s")) or _to_float(
            lap.get("elapsed_time_s")
        )
        hr = _to_int(lap.get("average_heartrate_bpm"))
        if dist and time_s and dist > 0:
            pace = int((time_s / dist) * 1000)
            segments.append({"d": round(dist), "p": pace, "hr": hr})
    return segments


# ============================================================
# LAST ACTIVITIES — BATCH (jeden DB call pre laps/splits)
# ============================================================

def build_last_activities_block_for_analysis(
    user_id: int, *, ctx: AuthCtx, limit: int = 6
) -> List[Dict[str, Any]]:
    """
    Blok posledných aktivít pre AI analýzu.
    BATCH načítanie laps/splits — jeden DB call pre všetky aktivity naraz.
    """
    if limit <= 0:
        limit = 4

    since_iso = (datetime.now(timezone.utc) - timedelta(days=60)).date().isoformat()

    ids = db_get_recent_activity_ids(
        user_id=user_id, since_iso_date=since_iso, limit=limit, ctx=ctx
    )
    if not ids:
        return []

    summary_rows = (
        db_get_summary_for_activities(user_id=user_id, activity_ids=ids, ctx=ctx) or []
    )
    if not summary_rows:
        return []

    enr_rows = (
        db_get_enrichment_for_activities(user_id=user_id, activity_ids=ids, ctx=ctx) or []
    )
    enr_by_id: Dict[int, Dict[str, Any]] = {
        aid: r for r in enr_rows if (aid := _to_int(r.get("activity_id"))) is not None
    }

    run_ride_ids: List[int] = [
        aid
        for r in summary_rows
        if _canonical_sport(r.get("sport_type_fe") or r.get("sport_type"))
        in ("run", "ride")
        and (aid := _to_int(r.get("activity_id"))) is not None
    ]

    laps_by_id: Dict[int, List[Dict[str, Any]]] = {}
    splits_by_id: Dict[int, List[Dict[str, Any]]] = {}

    if run_ride_ids:
        try:
            laps_by_id = (
                db_get_activity_laps_batch(
                    user_id=user_id, activity_ids=run_ride_ids, ctx=ctx
                )
                or {}
            )
        except Exception as e:  # noqa: BLE001
            print(f"[AS][builder] laps batch fetch failed: {repr(e)}")

        try:
            splits_by_id = (
                db_get_activity_splits_batch(
                    user_id=user_id, activity_ids=run_ride_ids, ctx=ctx
                )
                or {}
            )
        except Exception as e:  # noqa: BLE001
            print(f"[AS][builder] splits batch fetch failed: {repr(e)}")

    def _date_key(row: Dict[str, Any]) -> str:
        return str(row.get("date") or "")[:19]

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
        avg_pace_s = (
            int(moving_s / dist_km)
            if (dist_km and dist_km > 0 and moving_s and moving_s > 0)
            else None
        )
        sport = _canonical_sport(r.get("sport_type_fe") or r.get("sport_type"))

        enr = enr_by_id.get(aid, {})
        z45 = (_to_float(enr.get("z4_min")) or 0.0) + (_to_float(enr.get("z5_min")) or 0.0)
        z12 = (_to_float(enr.get("z1_min")) or 0.0) + (_to_float(enr.get("z2_min")) or 0.0)
        intensity = "easy"
        if z45 > 5:
            intensity = "hard"
        elif z45 > 0 or (dur_min and z12 < (dur_min * 0.8)):
            intensity = "moderate"

        act_obj: Dict[str, Any] = {
            "date": _rel_day_label(date_str),
            "sport": sport,
            "duration_min": round(dur_min) if dur_min else None,
            "distance_km": round(dist_km, 2) if dist_km else None,
            "avg_pace_s": avg_pace_s,
            "avg_hr": avg_hr,
            "intensity": intensity,
        }

        if sport in ("run", "ride"):
            laps = laps_by_id.get(aid) or []
            rows_for_seg = laps if len(laps) >= 2 else (splits_by_id.get(aid) or [])
            segments = _build_segments_from_rows(rows_for_seg, max_items=8)
            if segments:
                act_obj["segments"] = segments

        out.append(act_obj)

    return out


# ============================================================
# MAIN BUILDER
# ============================================================

def build_base_input(user_id: int) -> Dict[str, Any]:
    """Prázdna kostra input payloadu pre analýzu stavu športovca."""
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
        # Súhrn odcvičenej sily + objem na partie (None = žiadne logy)
        "strength_log": None,
        "latest_paces": None,
        "is_returning_beginner": False,
    }


def _fmt_minutes(m: float) -> str:
    m = int(round(m))
    h, mm = divmod(m, 60)
    if not h:
        return f"{mm} min"
    return f"{h} h" if not mm else f"{h} h {mm} min"


def build_volume_facts(recent_load: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Objem posledných 4 UZAVRETÝCH týždňov, spočítaný v kóde.

    PREČO: model v texte napísal "178 až 348 min, nad túto hranicu nejdi"
    a do weekly_minutes_max dal 330. Rozsah sa teraz počíta tu, AI ho
    v texte len cituje a main.py jej limity strhne do tohto rozsahu.
    """
    today_iso = date.today().isoformat()
    weeks = [
        w for w in (recent_load or {}).get("weeks") or []
        if isinstance(w, dict) and str(w.get("week_end_iso") or "") < today_iso
    ]
    weeks.sort(key=lambda w: str(w.get("week_start_iso") or ""))
    mins = [int(w.get("total_minutes") or 0) for w in weeks[-4:]]
    mins = [m for m in mins if m > 0]
    if not mins:
        return None
    lo, hi = min(mins), max(mins)
    return {
        "complete_weeks_minutes": mins,
        "observed_min": lo,
        "observed_max": hi,
        "observed_range_text": f"{_fmt_minutes(lo)} – {_fmt_minutes(hi)}",
    }


def _build_active_health(user_id: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """
    Zdravotné záznamy (choroba, zranenie, únava, menštruácia): aktívne +
    vyriešené za 14 dní, aby AI vedela aj o návrate po chorobe.
    """
    from Services.user_health_log import service_health_context_for_ai

    return service_health_context_for_ai(user_id, ctx=ctx)


def build_input_from_db(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Kompletný input payload pre analýzu stavu športovca z DB.
    Laps/splits sa načítavajú batch, bez N+1.
    """
    input_data = build_base_input(user_id)
    input_data["user"] = _load_user_profile_for_analysis(user_id=user_id, ctx=ctx)
    input_data["zones"] = service_build_zones_block_for_analysis(user_id, ctx=ctx)
    input_data["thresholds"] = service_build_thresholds_block_for_analysis(user_id, ctx=ctx)
    input_data["prefs"] = service_load_coach_prefs_for_analysis(user_id, ctx=ctx)
    input_data["bests"] = _bests_dates_to_days_ago(
        service_build_bests_block_for_analysis(user_id, ctx=ctx) or {}
    )
    input_data["recent_load"] = service_build_recent_load_block_for_analysis(
        user_id=user_id, window_days=42, ctx=ctx
    )
    input_data["volume_facts"] = build_volume_facts(input_data["recent_load"])
    input_data["recovery"] = service_build_recovery_block_for_analysis(user_id, ctx=ctx)
    input_data["active_health_issues"] = _build_active_health(user_id, ctx=ctx)
    input_data["active_plan"] = service_build_active_plan_block_for_analysis(
        user_id=user_id, ctx=ctx
    )
    input_data["external_events"] = _minify_external_events_for_ai(
        service_build_external_events_block_for_analysis(user_id=user_id, ctx=ctx)
    )
    input_data["latest_paces"] = db_get_latest_paces(user_id=user_id, ctx=ctx)

    # Silové tréningy z reálnych logov + objem na partie. Kľúč MUSÍ byť
    # "strength_log" - presne to hľadá _strength_log_rule v prompts.py.
    try:
        input_data["strength_log"] = build_strength_log_block_for_analysis(
            user_id, ctx=ctx
        )
    except Exception as e:  # noqa: BLE001
        print(f"[AS][builder] strength block failed: {repr(e)}")
        input_data["strength_log"] = None

    acts = build_last_activities_block_for_analysis(user_id=user_id, ctx=ctx, limit=6)
    input_data["last_activities"] = acts
    input_data["is_returning_beginner"] = len(acts) == 0

    return input_data