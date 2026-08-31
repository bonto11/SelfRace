# Services/AI/weekly_plan/builders.py
from __future__ import annotations

from typing import Any, Dict, Optional, List
from datetime import date, datetime, timezone, timedelta

from Configs.config import (
    COACH_PLAN_MIN_WEEKS,
    COACH_PLAN_DEFAULT_WEEKS,
    COACH_PLAN_MAX_WEEKS,
)

from Services.AI.athlete_state.builders import build_input_from_db
from Services.AI.prefs_defaults import apply_basic_mode_defaults
from DB.coach_athlete_state import (
    db_get_state_by_id,
    db_get_latest_state_for_user,
)
from DB.coach_plan_weekly import db_get_weekly_for_user_plan
from Services.coach_external_events import (
    service_build_external_events_block_for_analysis,
)
from Services.AI.utils.others import _check_is_returning_beginner
from Services.coach_user_notes import service_get_notes_for_builder
from Modules.Supabase.auth import AuthCtx


# ============================================================
# HELPERS
# ============================================================

def _as_dict(v: Any) -> Dict[str, Any]:
    """Bezpečná konverzia na dict."""
    return v if isinstance(v, dict) else {}


def _as_list(v: Any) -> List[Any]:
    """Bezpečná konverzia na list."""
    return v if isinstance(v, list) else []


def _safe_date(v: Any) -> Optional[str]:
    """Vráti prvých 10 znakov stringu ako YYYY-MM-DD, inak None."""
    if not v:
        return None
    s = str(v).strip()
    return s[:10] if len(s) >= 10 else None


# ============================================================
# WEEK BOUNDARIES (deterministický výpočet, nie AI)
# ============================================================

def compute_week_boundaries(
    start_date_str: Optional[str], horizon_weeks: int
) -> List[Dict[str, Any]]:
    """
    Vypočíta presné (week_index, week_start, week_end) hranice pre každý týždeň
    v pláne, deterministicky v Pythone.
    """
    if start_date_str:
        try:
            start = date.fromisoformat(start_date_str[:10])
        except Exception:
            start = date.today()
    else:
        start = date.today()

    boundaries: List[Dict[str, Any]] = []

    days_until_sunday = (6 - start.weekday()) % 7
    first_week_end = start + timedelta(days=days_until_sunday)

    boundaries.append({
        "week_index": 1,
        "week_start": start.isoformat(),
        "week_end": first_week_end.isoformat(),
    })

    cursor = first_week_end + timedelta(days=1)
    for i in range(2, horizon_weeks + 1):
        week_end = cursor + timedelta(days=6)
        boundaries.append({
            "week_index": i,
            "week_start": cursor.isoformat(),
            "week_end": week_end.isoformat(),
        })
        cursor = week_end + timedelta(days=1)

    return boundaries


# ============================================================
# ATHLETE STATE LOADER
# ============================================================

def load_athlete_state_for_plan(
    user_id: int,
    state_id: Optional[int],
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    row: Optional[Dict[str, Any]] = None
    if state_id is not None:
        row = db_get_state_by_id(state_id, ctx=ctx)
    if not row:
        row = db_get_latest_state_for_user(user_id=user_id, version=1, ctx=ctx)
    if not row:
        raise ValueError(
            "No athlete state found. Run /coach/athlete/analyze first or pass a valid state_id."
        )
    state_json = row.get("state_json")
    if not isinstance(state_json, dict):
        raise ValueError("Stored athlete state has invalid format (state_json).")
    return {
        "state_id": row.get("id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": state_json,
    }


# ============================================================
# PREFS EXTRACTION
# ============================================================

def _extract_prefs(context: Dict[str, Any]) -> Dict[str, Any]:
    for source in (
        _as_dict(context.get("analyze_input_min")),
        _as_dict(context.get("analyze_input")),
        context,
    ):
        prefs_any = source.get("prefs")
        if isinstance(prefs_any, dict):
            val = prefs_any.get("value")
            return _as_dict(val) if isinstance(val, dict) else prefs_any
    return {}


# ============================================================
# MINIFY ANALYZE INPUT
# ============================================================

def _minify_analyze_input_for_weekly(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    ai: Dict[str, Any] = dict(analyze_input) if isinstance(analyze_input, dict) else {}

    u = ai.get("user")
    if isinstance(u, dict):
        u2 = dict(u)
        for k in ("id", "email", "name"):
            u2.pop(k, None)
        ai["user"] = u2

    la = ai.get("last_activities")
    if isinstance(la, list):
        trimmed: List[Dict[str, Any]] = []
        for a in la:
            if not isinstance(a, dict):
                continue
            dur_min = (
                a.get("duration_min")
                or a.get("moving_time_min")
                or a.get("moving_time")
            )
            trimmed.append({
                "sport": a.get("sport") or a.get("type"),
                "distance_km": a.get("distance_km") or a.get("distance"),
                "duration_min": dur_min,
                "avg_hr": a.get("avg_hr"),
                "intensity": a.get("intensity"),
                "date": a.get("date"),
                "z4_min": a.get("z4_min"),
                "z5_min": a.get("z5_min"),
            })
            if len(trimmed) >= 20:
                break
        ai["last_activities"] = trimmed

    for k in ("prefs", "thresholds", "zones", "bests", "streams", "laps", "splits"):
        ai.pop(k, None)

    return ai


# ============================================================
# REPLAN WEEK-INDEX ANCHOR (deterministický, kalendárový)
# ============================================================

def _compute_current_week_index_for_replan(
    existing_rows: List[Dict[str, Any]],
) -> tuple[int, str]:
    """
    Vypočíta (current_week_index_offset, start_date_for_weeks) pre replan
    VÝHRADNE z kalendára, ukotvený na week_index=1 starte TOHTO PLÁNU
    (existing_rows už prichádzajú scoped podľa plan_meta_id z volajúceho -
    pozri build_weekly_context_from_db nižšie - takže tu už nehrozí, že by
    anchor prišiel z iného, nesúvisiaceho plánu).
    """
    today_iso = date.today().isoformat()

    anchor_row = min(
        (r for r in existing_rows if r.get("week_index") == 1 and r.get("week_start")),
        key=lambda r: str(r["week_start"]),
        default=None,
    )
    if not anchor_row:
        rows_with_start = [r for r in existing_rows if r.get("week_start")]
        anchor_row = min(
            rows_with_start,
            key=lambda r: int(r.get("week_index") or 0),
            default=None,
        )

    if not anchor_row:
        return 1, today_iso

    anchor_start = str(anchor_row["week_start"])
    anchor_index = int(anchor_row.get("week_index") or 1)

    try:
        anchor_date = date.fromisoformat(anchor_start[:10])
    except Exception:
        return 1, today_iso

    if date.today() < anchor_date:
        return anchor_index, anchor_start

    days_since_anchor = (date.today() - anchor_date).days
    safety_horizon = max(4, (days_since_anchor // 7) + 4)

    probe_boundaries = compute_week_boundaries(anchor_start, safety_horizon)
    current_probe = next(
        (b for b in probe_boundaries if b["week_start"] <= today_iso <= b["week_end"]),
        None,
    )
    if not current_probe:
        current_probe = probe_boundaries[-1]

    current_week_index_offset = current_probe["week_index"] + anchor_index - 1
    start_date_for_weeks = current_probe["week_start"]

    return current_week_index_offset, start_date_for_weeks


def _compute_horizon_weeks_for_target_end_date(
    start_date_for_weeks: str,
    target_end_date: str,
    *,
    max_safety_weeks: int = 52,
) -> int:
    """"Skrátiť/predĺžiť plán" cez date picker (Coach Notes -> Veľká zmena)."""
    probe = compute_week_boundaries(start_date_for_weeks, max_safety_weeks)
    for wb in probe:
        if wb["week_end"] >= target_end_date:
            return wb["week_index"]
    return max_safety_weeks


# ============================================================
# MAIN BUILDER
# ============================================================

def build_weekly_context_from_db(
    user_id: int,
    *,
    ctx: AuthCtx,
    state_id: Optional[int],
    weeks: Optional[int],
    plan_meta_id: Optional[int],
    full_reset: bool = False,
    target_end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Zostaví kompletný context_payload pre weekly plan generátor.

    plan_meta_id: NOVÉ - ktorému konkrétnemu plánu (coach_plan_meta.id)
    tento replan patrí. Pri full_reset (prvotné generovanie) je zvyčajne
    None, keďže meta záznam ešte neexistuje - existing_rows preto vyjde
    prázdny a is_replan=False, čo je presne to, čo chceme (žiadny replan
    logika, žiadny anchor z cudzieho plánu).
    """
    analyze_input = build_input_from_db(user_id=user_id, ctx=ctx)
    if not isinstance(analyze_input, dict):
        analyze_input = {}

    prefs_ai = _extract_prefs(analyze_input)
    prefs_ai = apply_basic_mode_defaults(prefs_ai)

    external_events_block = analyze_input.get("external_events")
    if external_events_block is None:
        try:
            external_events_block = service_build_external_events_block_for_analysis(
                user_id=user_id, ctx=ctx
            )
        except Exception:
            external_events_block = None

    state_bundle = load_athlete_state_for_plan(
        user_id=user_id, state_id=state_id, ctx=ctx
    )
    used_state_id = state_bundle["state_id"]
    athlete_state = state_bundle["state"]

    is_returning_beginner = _check_is_returning_beginner(analyze_input)
    if isinstance(athlete_state, dict):
        athlete_state["is_returning_beginner"] = is_returning_beginner

    coach_notes = {"sticky_notes": [], "ephemeral_note": None, "ephemeral_note_id": None}
    try:
        coach_notes = service_get_notes_for_builder(user_id=user_id, ctx=ctx)
    except Exception as e:
        print(f"❌ [WEEKLY][builder] coach notes fetch failed: {repr(e)}")

    # FIX: existing_rows sa teraz načíta SCOPED na plan_meta_id, nie
    # naprieč všetkými plánmi usera - toto je presne to miesto, kde predtým
    # unikol anchor z nesúvisiaceho draftu do replanu aktívneho plánu.
    existing_rows = db_get_weekly_for_user_plan(user_id=user_id, plan_meta_id=plan_meta_id, ctx=ctx)
    is_replan = len(existing_rows) > 0 and not full_reset

    current_week_index_offset = 1
    start_date_for_weeks: Optional[str] = None

    if is_replan:
        current_week_index_offset, start_date_for_weeks = (
            _compute_current_week_index_for_replan(existing_rows)
        )
    else:
        start_date_for_weeks = _safe_date(
            prefs_ai.get("start_date") or prefs_ai.get("plan_start_date")
        )

    if target_end_date and start_date_for_weeks:
        horizon_weeks = max(
            1,
            _compute_horizon_weeks_for_target_end_date(
                start_date_for_weeks, target_end_date
            ),
        )
    else:
        raw_weeks = int(weeks or prefs_ai.get("weeks") or COACH_PLAN_DEFAULT_WEEKS)
        horizon_weeks = max(COACH_PLAN_MIN_WEEKS, min(raw_weeks, COACH_PLAN_MAX_WEEKS))

    raw_boundaries = compute_week_boundaries(start_date_for_weeks, horizon_weeks)
    week_boundaries = [
        {**wb, "week_index": wb["week_index"] + current_week_index_offset - 1}
        for wb in raw_boundaries
    ]

    analyze_input_min = _minify_analyze_input_for_weekly(analyze_input)

    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        "user_id": user_id,
        "weeks": horizon_weeks,
        "week_boundaries": week_boundaries,
        "is_replan": is_replan,
        "overwrite": True,
        "prefs": prefs_ai,
        "analyze_input_min": analyze_input_min,
        "athlete_state": athlete_state,
        "athlete_state_meta": {
            "state_id": used_state_id,
            "model": state_bundle.get("model"),
            "version": state_bundle.get("version"),
            "created_at": state_bundle.get("created_at"),
        },
        "coach_notes": {
            "sticky_notes": coach_notes.get("sticky_notes") or [],
            "ephemeral_note": coach_notes.get("ephemeral_note"),
        },
    }

    if target_end_date:
        context_payload["target_end_date"] = target_end_date

    if is_replan:
        past_weeks_summary = [
            {
                "week_index": r.get("week_index"),
                "week_start": r.get("week_start"),
                "week_end": r.get("week_end"),
                "load_phase": r.get("load_phase"),
                "goal": r.get("goal"),
                "actual_stats": r.get("actual_stats"),
            }
            for r in existing_rows
            if r.get("week_end") and str(r["week_end"]) < date.today().isoformat()
        ]
        if past_weeks_summary:
            context_payload["past_weeks_summary"] = past_weeks_summary

    if external_events_block is not None:
        context_payload["external_events"] = external_events_block

    return {
        "context_payload": context_payload,
        "state_bundle": state_bundle,
        "prefs_ai": prefs_ai,
        "horizon_weeks": horizon_weeks,
        "analyze_input": analyze_input,
        "analyze_input_min": analyze_input_min,
        "ephemeral_note_id": coach_notes.get("ephemeral_note_id"),
    }


# ============================================================
# AI OUTPUT PARSERS
# ============================================================

def extract_weeks_payload(weekly_plan: Any) -> List[Dict[str, Any]]:
    if isinstance(weekly_plan, dict):
        for key in ("weeks", "plan"):
            val = weekly_plan.get(key)
            if isinstance(val, list):
                return [w for w in val if isinstance(w, dict)]
        return []
    if isinstance(weekly_plan, list):
        return [w for w in weekly_plan if isinstance(w, dict)]
    return []


def build_weekly_rows_from_ai(
    user_id: int,
    weeks_list: List[Dict[str, Any]],
    plan_meta_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    plan_meta_id: NOVÉ - ak už poznáme (replan existujúceho plánu), zapíše
    sa priamo do každého riadku. Pri prvotnom generovaní (None) ostane v
    riadku chýbať a doplní sa AŽ PO vytvorení meta záznamu cez
    db_set_plan_meta_id_for_weekly_rows (pozri main.py).
    """
    rows: List[Dict[str, Any]] = []
    for idx, w in enumerate(weeks_list, start=1):
        if not isinstance(w, dict):
            continue
        week_index = int(w.get("week_index") or idx)
        row: Dict[str, Any] = {
            "user_id": user_id,
            "week_index": week_index,
            "week_start": w.get("week_start"),
            "week_end": w.get("week_end"),
            "goal": w.get("goal"),
            "focus": w.get("focus"),
            "load_phase": w.get("load_phase"),
            "planned_stats": w.get("planned_stats") or {},
            "actual_stats": {},
            "notes": w.get("notes"),
            "raw_json": w,
        }
        if plan_meta_id is not None:
            row["plan_meta_id"] = plan_meta_id
        rows.append(row)
    return rows