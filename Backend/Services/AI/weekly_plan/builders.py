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
    v pláne, deterministicky v Pythone (AI si dátumy/dni v týždni nesmie počítať
    samo - LLM na to nie sú spoľahlivé, viedlo to k nesprávnym dňom v týždni,
    napr. pri identifikácii dňa preteku).

    - Ak start_date_str chýba, berie sa dnešok.
    - PRVÝ týždeň (week_index=1 v tomto výstupe, offsetuje sa neskôr pri
      replane): od start_date po najbližšiu nedeľu (môže byť kratší ako 7
      dní, nikdy nie dlhší).
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
# 🌟 REPLAN WEEK-INDEX ANCHOR (deterministický, kalendárový)
# ============================================================

def _compute_current_week_index_for_replan(
    existing_rows: List[Dict[str, Any]],
) -> tuple[int, str]:
    """
    Vypočíta (current_week_index_offset, start_date_for_weeks) pre replan
    VÝHRADNE z kalendára — nikdy z toho, aký najvyšší week_index náhodou
    leží v DB.

    PREČO: pôvodná logika hľadala riadok kde week_start <= dnešok <= week_end,
    a ak ho nenašla (napr. medzera medzi týždňami spôsobená starším bugom,
    alebo oneskorené pregenerovanie), spravila `max(existing week_index) + 1`.
    To je nespoľahlivé — ak v tabuľke ostal osirotený/starý riadok s vysokým
    week_index (napr. z predošlého chybného generovania), replan naň naviazal
    a vznikol skok v číslovaní (napr. 7 -> 18) aj rast celkového počtu
    týždňov pri opakovanom pregenerovaní (10 -> 12 -> 15), lebo nové týždne
    sa nikdy neprekryli s existujúcimi a teda ich nenahradili.

    Namiesto toho: zoberieme week_start týždňa s week_index == 1 (skutočný,
    pôvodný začiatok plánu) ako pevný "anchor" a dopočítame, do ktorého
    kalendárneho týždňa padá dnešok, rovnakou logikou ako
    compute_week_boundaries. Výsledok je vždy rovnaký bez ohľadu na to, aké
    (prípadne poškodené) riadky momentálne existujú v DB.
    """
    today_iso = date.today().isoformat()

    anchor_row = min(
        (r for r in existing_rows if r.get("week_index") == 1 and r.get("week_start")),
        key=lambda r: str(r["week_start"]),
        default=None,
    )
    if not anchor_row:
        # Núdzový fallback — week_index=1 riadok chýba (nemalo by nastať pri
        # zdravých dátach). Zoberieme riadok s najnižším week_index ako anchor,
        # aspoň relatívne konzistentne.
        rows_with_start = [r for r in existing_rows if r.get("week_start")]
        anchor_row = min(
            rows_with_start,
            key=lambda r: int(r.get("week_index") or 0),
            default=None,
        )

    if not anchor_row:
        # Úplne bez použiteľných dát — správaj sa ako pri prvom generovaní.
        return 1, today_iso

    anchor_start = str(anchor_row["week_start"])
    anchor_index = int(anchor_row.get("week_index") or 1)

    try:
        anchor_date = date.fromisoformat(anchor_start[:10])
    except Exception:
        return 1, today_iso

    if date.today() < anchor_date:
        # Dnešok je pred pôvodným začiatkom plánu (nemalo by nastať) — poistka.
        return anchor_index, anchor_start

    days_since_anchor = (date.today() - anchor_date).days
    # Dostatočne veľký horizont, aby určite pokryl dnešok, aj keby plán
    # výrazne mešká oproti tomu, čo je aktuálne v DB.
    safety_horizon = max(4, (days_since_anchor // 7) + 4)

    probe_boundaries = compute_week_boundaries(anchor_start, safety_horizon)
    current_probe = next(
        (b for b in probe_boundaries if b["week_start"] <= today_iso <= b["week_end"]),
        None,
    )
    if not current_probe:
        # Nemalo by sa stať vďaka safety_horizon, ale poistka nech nič nezhodí.
        current_probe = probe_boundaries[-1]

    # probe_boundaries číslujú od 1 → posunieme o (anchor_index - 1), aby
    # výsledné číslovanie nadväzovalo na pôvodné, historické week_index.
    current_week_index_offset = current_probe["week_index"] + anchor_index - 1
    start_date_for_weeks = current_probe["week_start"]

    return current_week_index_offset, start_date_for_weeks


# ============================================================
# MAIN BUILDER
# ============================================================

def build_weekly_context_from_db(
    user_id: int,
    *,
    ctx: AuthCtx,
    state_id: Optional[int],
    weeks: Optional[int],
    full_reset: bool = False,
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
    # 🌟 NOVÉ: ak user nemá zapnutý detailed_mode, doplní sa rozumnými
    # defaultami (strength 2x/týždeň full gym, long run nedeľa, atď.) —
    # rovnaká logika a rovnaké defaulty ako v daily builderi, aby weekly
    # a daily plán boli medzi sebou konzistentné.
    prefs_ai = apply_basic_mode_defaults(prefs_ai)

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

    # 🌟 REPLAN DETECTION: ak už existujú weekly riadky pre tohto usera, ide
    # o replan existujúceho plánu, nie o prvotné vytvorenie. Pri replane
    # NESMIEME znova generovať už uzavreté minulé týždne (spôsobovalo to
    # duplicity - staré riadky s week_end v minulosti sa nemažú, ale AI ich
    # aj tak vygenerovala znova s rovnakými dátumami).
    existing_rows = db_get_weekly_for_user_plan(user_id=user_id, ctx=ctx)
    # 🌟 full_reset=True znamená, že sa chystáme kompletne premazať staré
    # riadky (v service_generate_weekly_plan, hneď po tomto builderi) - preto
    # sa tu SPRÁVAME, akoby žiadne staré dáta neboli, aby week_index začínal
    # znova od 1 a race_hint/dátumy vychádzali zo skutočného start_date z
    # prefs, nie z kontinuácie starého (čoskoro zmazaného) plánu.
    is_replan = len(existing_rows) > 0 and not full_reset

    current_week_index_offset = 1
    start_date_for_weeks: Optional[str] = None

    if is_replan:
        # 🌟 FIX: week_index pre "dnešok" sa počíta ČISTO z kalendára,
        # ukotvený na pôvodnom week_index=1 starte — nie z toho, aký
        # najvyšší index náhodou existuje v DB. Pozri docstring funkcie
        # _compute_current_week_index_for_replan pre detailné vysvetlenie
        # bugu (skok 7 -> 18, rastúci weeks_total pri opakovanom replane).
        current_week_index_offset, start_date_for_weeks = (
            _compute_current_week_index_for_replan(existing_rows)
        )
    else:
        start_date_for_weeks = _safe_date(
            prefs_ai.get("start_date") or prefs_ai.get("plan_start_date")
        )

    # Presné, Python-vypočítané hranice týždňov (pondelok-nedeľa, prvý
    # týždeň môže byť kratší podľa start_date) - AI ich dostane ako fakt cez
    # prompt, nesmie si dátumy/dni v týždni počítať sama. Pri replane sa
    # week_index posunie tak, aby nadväzoval na existujúce číslovanie.
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

    # Pri replane pošleme AI aj krátky súhrn UŽ UZAVRETÝCH minulých týždňov
    # (goal/load_phase/actual_stats) ako kontext - AI ich nemá generovať
    # znova, ale môže sa na ne odvolávať (napr. "pokračujeme v build fáze").
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
