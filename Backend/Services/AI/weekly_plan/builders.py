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
from DB.coach_athlete_state import (
    db_get_state_by_id,
    db_get_latest_state_for_user,
)
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
    v pláne, deterministicky v Pythone (AI si dátumy/dni v týždni nesmie počítať
    samo - LLM na to nie sú spoľahlivé, viedlo to k nesprávnym dňom v týždni,
    napr. pri identifikácii dňa preteku).

    - Ak start_date_str chýba, berie sa dnešok.
    - PRVÝ týždeň: od start_date po najbližšiu nedeľu (môže byť kratší ako 7 dní,
      nikdy nie dlhší).
    - KAŽDÝ ĎALŠÍ týždeň: vždy presne pondelok -> nedeľa (7 dní).
    """
    if start_date_str:
        try:
            start = date.fromisoformat(start_date_str[:10])
        except Exception:
            start = date.today()
    else:
        start = date.today()

    boundaries: List[Dict[str, Any]] = []

    # Najbližšia nedeľa od start (vrátane, ak start je už nedeľa). weekday():
    # Monday=0 ... Sunday=6.
    days_until_sunday = (6 - start.weekday()) % 7
    first_week_end = start + timedelta(days=days_until_sunday)

    boundaries.append({
        "week_index": 1,
        "week_start": start.isoformat(),
        "week_end": first_week_end.isoformat(),
    })

    cursor = first_week_end + timedelta(days=1)  # ďalší pondelok
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
    """
    Načíta athlete state pre generovanie plánu.
    Preferuje state_id ak je zadaný, inak berie posledný.
    Vyhodí ValueError ak žiadny neexistuje.
    """
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
    """
    Vytiahne prefs dict z contextu — skúša analyze_input_min aj root context.
    Unwrapuje vnorený 'value' kľúč ak existuje.
    """
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
    """
    Osekáva analyze_input pre weekly plán — odstráni polia
    ktoré sú redundantné (posielané samostatne v context_payload).
    Zachováva last_activities s kľúčovými metrikami.
    """
    ai: Dict[str, Any] = dict(analyze_input) if isinstance(analyze_input, dict) else {}

    # Interné polia
    u = ai.get("user")
    if isinstance(u, dict):
        u2 = dict(u)
        for k in ("id", "email", "name"):
            u2.pop(k, None)
        ai["user"] = u2

    # last_activities — zachováme len kľúčové metriky
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

    # Posielané samostatne v context_payload — redundantné tu
    for k in ("prefs", "thresholds", "zones", "bests", "streams", "laps", "splits"):
        ai.pop(k, None)

    return ai


# ============================================================
# MAIN BUILDER
# ============================================================

def build_weekly_context_from_db(
    user_id: int,
    *,
    ctx: AuthCtx,
    state_id: Optional[int],
    weeks: Optional[int],
) -> Dict[str, Any]:
    """
    Zostaví kompletný context_payload pre weekly plan generátor.
    Načíta analyze_input z DB (ťažký call), athlete_state, external_events
    a coach_user_notes (sticky + ephemeral).
    """
    # Plný analyze input — potrebujeme last_activities, recovery, recent_load
    analyze_input = build_input_from_db(user_id=user_id, ctx=ctx)
    if not isinstance(analyze_input, dict):
        analyze_input = {}

    prefs_ai = _extract_prefs(analyze_input)

    # External events — berieme z analyze_input ak už tam sú, inak fresh fetch
    external_events_block = analyze_input.get("external_events")
    if external_events_block is None:
        try:
            external_events_block = service_build_external_events_block_for_analysis(
                user_id=user_id, ctx=ctx
            )
        except Exception:
            external_events_block = None

    # Athlete state — posledný alebo podľa state_id
    state_bundle = load_athlete_state_for_plan(
        user_id=user_id, state_id=state_id, ctx=ctx
    )
    used_state_id = state_bundle["state_id"]
    athlete_state = state_bundle["state"]

    # Beginner flag do athlete_state
    is_returning_beginner = _check_is_returning_beginner(analyze_input)
    if isinstance(athlete_state, dict):
        athlete_state["is_returning_beginner"] = is_returning_beginner

    # Coach notes — sticky + ephemeral pre AI context
    coach_notes = {"sticky_notes": [], "ephemeral_note": None, "ephemeral_note_id": None}
    try:
        coach_notes = service_get_notes_for_builder(user_id=user_id, ctx=ctx)
    except Exception as e:
        print(f"❌ [WEEKLY][builder] coach notes fetch failed: {repr(e)}")

    # Horizon weeks — z parametra alebo prefs, oklipovaný na min/max
    raw_weeks = int(weeks or prefs_ai.get("weeks") or COACH_PLAN_DEFAULT_WEEKS)
    horizon_weeks = max(COACH_PLAN_MIN_WEEKS, min(raw_weeks, COACH_PLAN_MAX_WEEKS))

    # 🌟 Presné, Python-vypočítané hranice týždňov (pondelok-nedeľa, prvý
    # týždeň môže byť kratší podľa start_date) - AI ich dostane ako fakt cez
    # prompt, nesmie si dátumy/dni v týždni počítať sama.
    start_date_for_weeks = _safe_date(
        prefs_ai.get("start_date") or prefs_ai.get("plan_start_date")
    )
    week_boundaries = compute_week_boundaries(start_date_for_weeks, horizon_weeks)

    analyze_input_min = _minify_analyze_input_for_weekly(analyze_input)

    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        "user_id": user_id,
        "weeks": horizon_weeks,
        "week_boundaries": week_boundaries,
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
    """Vytiahne zoznam týždenných riadkov z AI outputu — zvláda rôzne formáty."""
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
) -> List[Dict[str, Any]]:
    """Prevedie AI weekly output na DB riadky pre coach_plan_weekly tabuľku."""
    rows: List[Dict[str, Any]] = []
    for idx, w in enumerate(weeks_list, start=1):
        if not isinstance(w, dict):
            continue
        week_index = int(w.get("week_index") or idx)
        rows.append({
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
        })
    return rows
