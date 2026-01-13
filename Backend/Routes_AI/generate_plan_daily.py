# Routes_AI/generate_plan_daily.py
from __future__ import annotations

from zoneinfo import ZoneInfo
import json
import os
import re
import time
from datetime import datetime, timezone, date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException
from openai import OpenAI

from Configs.config import (
    OPENAI_API_KEY,
    LLM_TIMEOUT_S,
    DEFAULT_MODEL,
    COACH_PLAN_SCAN_HORIZON_DAYS,
)

from Services.AI.athlete_state import build_input_from_db
from Routes_DB.coach_athlete_state import db_get_latest_state_for_user
from Routes_DB.coach_plan_weekly import (
    db_get_week_row_for_plan,
    db_get_weekly_for_user_plan,
)
from Routes_DB.coach_plan_daily import (
    db_insert_daily_rows,
    db_clear_daily_for_user_week,
    db_list_daily_for_user_horizon,
)
from Routes_DB.coach_plan_meta import (
    db_get_active_plan_meta_for_user,
    db_get_latest_plan_meta_for_user,
)
from Services.coach_strength_mapper import enrich_daily_plan_with_strength_exercises
from Services.coach_external_events import service_list_external_events_window
from Services.users import require_jwt


# ---------- parsing utils ----------

CODEFENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)
WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _strip_codefence(s: str) -> str:
    m = CODEFENCE_RE.search(s)
    return m.group(1).strip() if m else s.strip()


def _find_outer_json_block(s: str) -> str:
    start = s.find("{")
    if start < 0:
        return s
    depth = 0
    for i in range(start, len(s)):
        ch = s[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1]
    end = s.rfind("}")
    return s[start : end + 1] if end > start else s


def _sanitize_json_guess(s: str) -> str:
    s = s.replace("“", '"').replace("”", '"').replace("’", "'")
    s = _strip_codefence(s)
    s = _find_outer_json_block(s)
    s = re.sub(r",\s*([}\]])", r"\1", s)
    s = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", s)
    s = re.sub(r"\bNaN\b|\bInfinity\b|-Infinity", "null", s)
    return s.strip()


def _parse_ai_json(raw: str) -> Tuple[Optional[dict], str, str]:
    if not raw:
        return None, "", ""
    try:
        return json.loads(raw.strip()), raw.strip(), raw.strip()
    except Exception:
        cleaned = _sanitize_json_guess(raw or "")
        try:
            return json.loads(cleaned), cleaned, raw
        except Exception:
            return None, cleaned, raw


def _llm_models_priority(explicit_model: Optional[str]) -> List[str]:
    env_list = os.getenv("OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini")
    env_models = [m.strip() for m in env_list.split(",") if m.strip()]
    if explicit_model and explicit_model not in env_models:
        return [explicit_model] + env_models
    return env_models if not explicit_model else [explicit_model] + env_models


# ---------- weekly template → konkrétne dátumy ----------


def _resolve_week_slots_for_dates(
    week_meta: Dict[str, Any],
    weekly_template: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Zoberie generic weekly_template (Mon/Tue/...) a spraví týždeň s konkrétnymi dátumami:

    [
      { "date": "2026-01-14", "weekday": "Wed", "slots": [ {...}, ... ] },
      ...
    ]
    """
    ws_raw = week_meta.get("week_start")
    we_raw = week_meta.get("week_end") or ws_raw

    if not isinstance(ws_raw, str) or not isinstance(we_raw, str):
        return []

    try:
        ws = date.fromisoformat(ws_raw)
        we = date.fromisoformat(we_raw)
    except ValueError:
        return []

    # "Mon" -> slots[]
    days_def: Dict[str, List[Dict[str, Any]]] = {}
    for d in weekly_template.get("days") or []:
        day_name = d.get("day")
        slots = d.get("slots") or []
        if isinstance(day_name, str) and isinstance(slots, list):
            days_def[day_name] = slots

    out: List[Dict[str, Any]] = []
    cur = ws
    while cur <= we:
        wd_name = WEEKDAY_NAMES[cur.weekday()]  # 0 = Mon
        out.append(
            {
                "date": cur.isoformat(),
                "weekday": wd_name,
                "slots": days_def.get(wd_name) or [],
            }
        )
        cur += timedelta(days=1)

    return out


# ---------- context minimalizácia ----------


def _minify_context_for_ai(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Orezaná verzia context_payload pre LLM – len to, čo reálne potrebuje.
    """
    ctx2: Dict[str, Any] = {}

    # week meta
    if "week" in ctx:
        ctx2["week"] = ctx["week"]

    # zones & thresholds & recent_load
    if "zones" in ctx:
        ctx2["zones"] = ctx["zones"]
    if "thresholds" in ctx:
        ctx2["thresholds"] = ctx["thresholds"]
    if "recent_load" in ctx:
        ctx2["recent_load"] = ctx["recent_load"]

    # ---- PREFS (flatten .value) ----
    raw_prefs = ctx.get("prefs") or {}
    if (
        isinstance(raw_prefs, dict)
        and "value" in raw_prefs
        and isinstance(raw_prefs["value"], dict)
    ):
        prefs = raw_prefs["value"]
    else:
        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}

    prefs2: Dict[str, Any] = {
        "main_sport": prefs.get("main_sport"),
        "start_date": prefs.get("start_date"),
        "preferences": prefs.get("preferences") or {},
    }

    if "volume" in prefs:
        prefs2["volume"] = prefs.get("volume")
    if "weeks" in prefs:
        prefs2["weeks"] = prefs.get("weeks")
    if "strength_settings" in prefs:
        prefs2["strength_settings"] = prefs.get("strength_settings")

    # targets – len podstatné veci
    targets = (prefs.get("targets") or {}).copy()
    run_t = targets.get("run") or {}
    strength_t = targets.get("strength") or {}

    targets2: Dict[str, Any] = {}
    if run_t:
        targets2["run"] = {
            "race_goal": run_t.get("race_goal"),
            "race_type": run_t.get("race_type"),
            "target_time": run_t.get("target_time"),
            "races": run_t.get("races"),
        }
    if strength_t:
        targets2["strength"] = {
            "focus": strength_t.get("focus"),
            "sessions_per_week": strength_t.get("sessions_per_week"),
        }
    prefs2["targets"] = targets2

    # weekly_template necháme, ale len tak ako je
    wt = prefs.get("weekly_template")
    if isinstance(wt, dict):
        prefs2["weekly_template"] = wt

    ctx2["prefs"] = prefs2

    # athlete_state – len ai_state
    athlete_state = ctx.get("athlete_state") or {}
    ai_state = athlete_state.get("ai_state") or {}
    ctx2["athlete_state"] = {"ai_state": ai_state}

    # external_events – celé
    if "external_events" in ctx:
        ctx2["external_events"] = ctx["external_events"]

    if "last_activities" in ctx:
        ctx2["last_activities"] = ctx["last_activities"]

    # helper fields
    if "user_id" in ctx:
        ctx2["user_id"] = ctx["user_id"]
    if "plan_id" in ctx:
        ctx2["plan_id"] = ctx["plan_id"]
    if "user_settings" in ctx:
        ctx2["user_settings"] = ctx["user_settings"]
    if "weekly_template" in ctx and isinstance(ctx["weekly_template"], dict):
        ctx2["weekly_template"] = ctx["weekly_template"]
    if "week_slots" in ctx:
        ctx2["week_slots"] = ctx["week_slots"]

    return ctx2


# ---------- prompt builder ----------


def _build_prompts_for_daily(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    settings = settings or {}
    lang_code = (settings.get("language") or "sk").lower()

    if lang_code.startswith("en"):
        lang_label = "English"
        second_person_note = "Use 'you' and talk directly to the athlete."
    elif lang_code.startswith("cs"):
        lang_label = "Czech"
        second_person_note = "Mluv v 2. osobě ('ty' / 'vy') a přímo k atletovi."
    else:
        lang_label = "Slovak"
        second_person_note = "Hovor v 2. osobe ('ty') a priamo k atlétovi."

    week = context_payload.get("week") or {}

    # prefs (flatten)
    raw_prefs = context_payload.get("prefs") or {}
    if (
        isinstance(raw_prefs, dict)
        and "value" in raw_prefs
        and isinstance(raw_prefs["value"], dict)
    ):
        prefs = raw_prefs["value"]
    else:
        prefs = raw_prefs if isinstance(raw_prefs, dict) else {}

    targets = context_payload.get("targets") or prefs.get("targets") or {}
    week_slots = context_payload.get("week_slots") or []

    week_index = int(week.get("week_index") or context_payload.get("week_index") or 1)
    week_start = week.get("week_start") or context_payload.get("week_start") or ""
    week_end = week.get("week_end") or context_payload.get("week_end") or ""
    focus = week.get("focus") or ""
    load_phase = week.get("load_phase") or ""
    planned_minutes = week.get("planned_minutes")

    main_sport = prefs.get("main_sport") or "run"

    # basic prefs
    pref_obj = prefs.get("preferences") or {}
    days_off = pref_obj.get("days_off") or []
    long_run_days = pref_obj.get("long_run_days") or []
    avoid_two_a_day = bool(pref_obj.get("avoid_two_a_day"))
    avoid_back_to_back_hard = bool(pref_obj.get("avoid_back_to_back_hard"))

    weekly_template = prefs.get("weekly_template") or {}
    wt_mode = weekly_template.get("mode") or "off"

    # weekly template už rozpočítaná na konkrétne dni
    if week_slots:
        lines: List[str] = []
        for d in week_slots:
            ds = d.get("date")
            wd = d.get("weekday")
            slots = d.get("slots") or []
            if not ds or not wd:
                continue
            if not slots:
                lines.append(f"{ds} ({wd}): no template slots.")
                continue
            descs: List[str] = []
            for s in slots:
                sport = s.get("sport") or "?"
                kind = s.get("kind") or "?"
                priority = s.get("priority")
                ai_can_move = s.get("ai_can_move")
                meta_bits: List[str] = []
                if priority:
                    meta_bits.append(priority)
                if ai_can_move is False:
                    meta_bits.append("locked")
                elif ai_can_move is True:
                    meta_bits.append("flex")
                txt = f"{sport}:{kind}"
                if meta_bits:
                    txt += "[" + ",".join(meta_bits) + "]"
                descs.append(txt)
            lines.append(f"{ds} ({wd}): " + ", ".join(descs))

        weekly_template_line = (
            "- Weekly template for THIS week (already resolved to dates):\n"
            "  " + "\n  ".join(lines) + "\n"
            "- For every date above with slots, schedule matching sessions on that exact date (same sport & kind).\n"
            "- Slots with 'locked' (ai_can_move = false) must stay on that date; môžeš len zjemniť intenzitu / trvanie ak treba.\n"
            "- Nepridávaj ďalšie kľúčové tréningy na dátumy, ktoré nemajú key slot v template.\n"
        )
    else:
        weekly_template_line = (
            "- Weekly template not resolved for this week. Use only days_off and long_run_days.\n"
        )

    # volume prefs
    volume_prefs = prefs.get("volume") or {}
    volume_mode = volume_prefs.get("mode")
    volume_value = volume_prefs.get("value")

    # AI state (intensity/volume tolerance + plan_adjustment)
    ai_state = (context_payload.get("athlete_state") or {}).get("ai_state") or {}
    intensity_tol = ai_state.get("intensity_tolerance") or {}
    hard_max = intensity_tol.get("hard_sessions_per_week_max")

    volume_tol = ai_state.get("volume_tolerance") or {}
    weekly_min = volume_tol.get("weekly_minutes_min")
    weekly_max = volume_tol.get("weekly_minutes_max")

    plan_adj = ai_state.get("plan_adjustment") or {}
    soften_block = plan_adj.get("soften_next_days") or {}
    soften_flag = bool(soften_block.get("should_soften"))
    soften_days = soften_block.get("days")
    soften_reason = soften_block.get("reason")

    if soften_flag:
        if isinstance(soften_days, int) and soften_days > 0:
            soften_line = (
                f"- Plan adjustment: soften first ~{soften_days} calendar days after week_start "
                "(viac Z1/Z2, viac odpočinku, vysvetli v poznámkach).\n"
            )
        else:
            soften_line = (
                "- Plan adjustment: soften at least first 2–3 days after week_start "
                "(bez ťažkých tréningov, len easy/recovery alebo voľno).\n"
            )
        if soften_reason:
            soften_line += f"  Reason: {soften_reason}\n"
    else:
        soften_line = ""

    replan_flag = bool(plan_adj.get("should_replan_weekly"))
    weekly_replan_reason = plan_adj.get("weekly_replan_reason")
    if replan_flag:
        replan_line = (
            "- Plan adjustment: whole week should be conservative (nižší stredný objem, žiadne skoky).\n"
        )
        if weekly_replan_reason:
            replan_line += f"  Reason: {weekly_replan_reason}\n"
    else:
        replan_line = ""

    # textové verzie
    days_off_str = ", ".join(days_off) if days_off else "none"
    long_run_str = ", ".join(long_run_days) if long_run_days else "none"
    avoid_two_a_day_str = (
        "- Do NOT schedule two-a-day sessions.\n"
        if avoid_two_a_day
        else "- Two-a-day sessions are allowed if it still fits recovery.\n"
    )
    avoid_back_to_back_hard_str = (
        "- Do NOT schedule two hard days in a row.\n"
        if avoid_back_to_back_hard
        else "- Back-to-back hard days are allowed if they respect tolerance.\n"
    )

    strength_target = (targets.get("strength") or {}).get("sessions_per_week")
    strength_str = f"{strength_target}× per week" if strength_target else "no explicit target"

    if hard_max:
        hard_str = f"max {hard_max} hard sessions/week (vrátane intenzívnych externých eventov)"
    else:
        hard_str = "not specified"

    # volume hint
    if isinstance(planned_minutes, (int, float)):
        weekly_volume_line = (
            f"- Week planned_minutes ≈ {planned_minutes} min – sum of duration_min should be v tomto rozsahu (±15 %).\n"
        )
    elif isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        weekly_volume_line = (
            f"- Volume preference: weekly_hours ≈ {volume_value * 60:.0f} min/ týždeň, drž sa okolo toho.\n"
        )
    elif isinstance(volume_value, (int, float)) and volume_mode == "daily_minutes":
        weekly_volume_line = (
            "- Volume preference: daily_minutes – odhadni weekly volume ako daily_minutes * (7 - days_off).\n"
        )
    elif isinstance(weekly_min, (int, float)) or isinstance(weekly_max, (int, float)):
        weekly_volume_line = (
            "- Volume tolerance definovaná v ai_state – drž total duration_min medzi weekly_minutes_min a weekly_minutes_max.\n"
        )
    else:
        weekly_volume_line = (
            "- Žiadny pevný weekly objem – odvíjaj sa od recent_load a neprekroč ho o viac ako ~20 %.\n"
        )

    system_txt = (
        "You are an endurance coaching assistant. "
        "You get structured JSON for one training week and must generate day-by-day sessions. "
        "Return ONE valid JSON object only (no prose, no code fences)."
    )

    strength_slots_desc = """
- lower_quad: predné stehná + zadok (squat/step-up)
- lower_posterior: hamstringy + zadná strana (hinge, RDL, single-leg deadlift)
- core: stred tela (plank, anti-rotation, roll-out)
- upper_pull: chrbát + biceps (rows, pulls)
- upper_push: hruď + triceps (push-up, press)
""".strip()

    schema_text = f"""
{{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp with timezone offset",
  "model": "string",
  "week_index": number,
  "week_start": "YYYY-MM-DD",
  "week_end": "YYYY-MM-DD",
  "days": [
    {{
      "date": "YYYY-MM-DD",
      "sessions": [
        {{
          "sport": "run" | "ride" | "strength" | "swim" | "other",
          "title": string,
          "duration_min": number,
          "intensity": string | null,
          "session_type": string | null,
          "zone_text": string | null,
          "notes": string | null,
          "structure": {{
            "warmup"?: {{
              "minutes"?: number,
              "notes"?: string | null
            }},
            "main"?: [
              {{
                "reps"?: number,
                "work_min"?: number,
                "recover_min"?: number,
                "notes"?: string | null
              }}
            ],
            "cooldown"?: {{
              "minutes"?: number,
              "notes"?: string | null
            }},
            "strength_exercises"?: [
              {{
                "slot": "lower_quad" | "lower_posterior" | "core" | "upper_pull" | "upper_push",
                "sets": number,
                "reps": string,
                "rest_s": number,
                "notes": string | null
              }}
            ]
          }},
          "targets"?: {{
            "hr_bpm"?: [number, number] | null,
            "pace_min_per_km"?: string | null,
            "power_w"?: number | null
          }},
          "payload"?: object | null
        }}
      ]
    }}
  ]
}}
""".strip()

    context_for_ai = _minify_context_for_ai(context_payload)
    if settings:
        context_for_ai["user_settings"] = settings

    external_hint = (
        "- external_events.window.events obsahuje externé aktivity s poliami "
        "`occurrence_date`, `sport`, `duration_min`, `priority`, `title`.\n"
        "- Pre každý event v rozmedzí [week_start, week_end] urob session v ten istý deň a započítaj ho do objemu.\n"
        "- Tímové športy (futbal a pod.) ber ako hard session a neskladuj v ten deň ďalší ťažký tréning rovnakého typu.\n"
    )

    user_txt = (
        "Generate a DAILY TRAINING PLAN for exactly one calendar week from the context JSON.\n"
        f"Week index: {week_index}\n"
        f"Week range: {week_start or 'unknown'} .. {week_end or 'unknown'}\n"
        f"Focus: {focus or 'N/A'} | Load phase: {load_phase or 'N/A'}\n"
        f"Main sport: {main_sport}\n"
        f"Preferred days off: {days_off_str}\n"
        f"Preferred long run days: {long_run_str}\n"
        f"{weekly_template_line}"
        f"- Strength target: {strength_str}\n"
        f"- Intensity limit: {hard_str}\n"
        f"{weekly_volume_line}"
        "STRENGTH SLOTS (concept only, no concrete exercise names):\n"
        + strength_slots_desc
        + "\n\nPLAN ADJUSTMENT HINTS:\n"
        + soften_line
        + replan_line
        + "\nEXTERNAL EVENTS:\n"
        + external_hint
        + "\n\nCONTEXT_JSON:\n"
        + json.dumps(context_for_ai, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + schema_text
        + "\n\nHard rules:\n"
        "- Return a single JSON object matching the schema (fields môžu byť null, ale struktúra musí sedieť).\n"
        f"- Všetok text pre atlétov píš v jazyku {lang_label} a v 2. osobe. {second_person_note}\n"
        "- Každý deň v intervale [week_start, week_end] musí existovať presne raz v days[].\n"
        "- Pre rest day použi jednu session typu:\n"
        '  { "sport": "other", "title": "Rest day" (preložené), "duration_min": 0, "intensity": "rest", "session_type": "rest_day" }.\n'
        "- Rešpektuj days_off, long_run_days a date-resolved weekly template vyššie.\n"
        f"{avoid_two_a_day_str}"
        f"{avoid_back_to_back_hard_str}"
        "- Počet hard tréningov za týždeň nesmie prekročiť hard_sessions_per_week_max (ak je definovaný) a rátaj do toho aj hard external events.\n"
        "- Ak strength.sessions_per_week >= 1, rozlož približne toľko strength sessions cez týždeň.\n"
        "- Pre strength sessions používaj len structure.strength_exercises; každý záznam musí mať slot, sets, reps, rest_s, notes.\n"
        "- Typický strength objem: 1×/týždeň → 6–8 cvikov; 2×/týždeň → 6–8 na session; 3+× → 4–6 na session.\n"
        "- Nekonkrétne názvy cvikov (plank, drep…) NEPÍŠ, iba popíš zámer v notes (napr. 'ťažší core s anti-rotáciou').\n"
        "- Celkový weekly objem drž konzistentný s planned_minutes/volume_tolerance/recent_load.\n"
        "- Ak session výrazne zjemníš kvôli plan_adjustment, napíš dôvod v notes a nastav payload.plan_adjustment = {\"softened\": true, \"reason\": \"...\"}.\n"
        "- Nepoužívaj extrémne objemy ani absurdné kombinácie.\n"
    )

    return system_txt, user_txt


# ---------- LLM call ----------


def _call_openai_raw(
    client: OpenAI, model: str, system_txt: str, user_txt: str, max_tokens: int
) -> str:
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_txt},
            {"role": "user", "content": user_txt},
        ],
        temperature=0.2,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    return (resp.choices[0].message.content or "").strip()


def generate_daily_week_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    raw_settings = context_payload.get("user_settings") or {}
    settings: Dict[str, Any] = raw_settings if isinstance(raw_settings, dict) else {}

    system_txt, user_txt = _build_prompts_for_daily(
        context_payload,
        settings=settings,
    )

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)
    token_budgets = [2200, 2000, 1800]

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    week = context_payload.get("week") or {}
    week_index = int(week.get("week_index") or 1)
    week_start = week.get("week_start") or None
    week_end = week.get("week_end") or None
    plan_id_from_ctx = context_payload.get("plan_id")

    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(tz_name)
    except Exception:
        tzinfo = timezone.utc

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt - 1, len(token_budgets) - 1)]
            try:
                raw = _call_openai_raw(client, m, system_txt, user_txt, budget)
                dur_ms = int((time.time() - started) * 1000)
                parsed, cleaned, raw_keep = _parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": parsed is not None,
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:600]
                        + ("…[truncated]" if len(raw) > 600 else ""),
                    }
                )

                if not parsed:
                    last_err = "AI returned invalid JSON"
                    continue

                now_local = datetime.now(tzinfo)

                parsed.setdefault("schema_version", 1)
                parsed.setdefault("model", m)
                parsed.setdefault("week_index", week_index)
                parsed.setdefault("week_start", week_start)
                parsed.setdefault("week_end", week_end)
                if "generated_at" not in parsed:
                    parsed["generated_at"] = now_local.isoformat()
                if "days" not in parsed or not isinstance(parsed["days"], list):
                    parsed["days"] = []
                if plan_id_from_ctx and "plan_id" not in parsed:
                    parsed["plan_id"] = plan_id_from_ctx

                if debug_raw:
                    trace["raw"] = raw_keep
                    trace["cleaned"] = cleaned
                    trace["ok_model"] = m

                return parsed, trace

            except Exception as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": False,
                        "duration_ms": dur_ms,
                        "error": last_err,
                    }
                )
                time.sleep(0.5 * attempt)
                continue

    now_fallback = datetime.now(tzinfo).isoformat()
    fallback = {
        "schema_version": 1,
        "generated_at": now_fallback,
        "model": "daily-fallback",
        "week_index": week_index,
        "week_start": week_start,
        "week_end": week_end,
        "days": [],
        "error": last_err,
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None


# ---------- SERVICES: DB + AI + DB ----------


def _build_daily_rows_from_ai(
    user_id: int,
    plan_id: Optional[str],
    daily_plan: Dict[str, Any],
) -> List[Dict[str, Any]]:
    days = daily_plan.get("days") or []
    rows: List[Dict[str, Any]] = []

    for day in days:
        date_str = day.get("date")
        sessions = day.get("sessions") or []
        if not date_str or not isinstance(sessions, list):
            continue

        for idx, s in enumerate(sessions):
            if not isinstance(s, dict):
                continue

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": date_str,
                "sport": s.get("sport") or "other",
                "title": s.get("title"),
                "duration_min": s.get("duration_min"),
                "intensity": s.get("intensity"),
                "zone_text": s.get("zone_text"),
                "structure": s.get("structure"),
                "notes": s.get("notes"),
                "source": "ai_daily_v1",
                "plan_id": plan_id,
                "session_type": s.get("session_type"),
                "session_index": int(s.get("session_index") or idx),
                "payload": s.get("payload"),
                "activity_id": None,
            }
            rows.append(row)

    return rows


def _flatten_prefs_for_ai(analyze_input: Dict[str, Any]) -> Dict[str, Any]:
    raw = analyze_input.get("prefs") or {}
    if isinstance(raw, dict) and "value" in raw and isinstance(raw["value"], dict):
        return raw["value"]
    return raw if isinstance(raw, dict) else {}


def _extract_targets_from_prefs(prefs: Dict[str, Any]) -> Dict[str, Any]:
    t = prefs.get("targets")
    return t if isinstance(t, dict) else {}


def service_generate_daily_week(
    user_id: int,
    *,
    week_index: int,
    plan_id: Optional[str] = None,
    overwrite: bool = True,
    model: Optional[str] = None,
    debug: bool = False,
    user_jwt: str,
) -> Dict[str, Any]:
    jwt = require_jwt(user_jwt)

    if week_index <= 0:
        raise ValueError("week_index must be >= 1")

    plan_id_effective: Optional[str] = plan_id
    if not plan_id_effective:
        meta = db_get_active_plan_meta_for_user(
            user_id=user_id,
            user_jwt=jwt,
        ) or db_get_latest_plan_meta_for_user(
            user_id=user_id,
            user_jwt=jwt,
        )
        if meta and isinstance(meta.get("plan_id"), str):
            plan_id_effective = meta["plan_id"]

    analyze_input = build_input_from_db(
        user_id=user_id,
        user_jwt=jwt,
    )

    prefs_ai = _flatten_prefs_for_ai(analyze_input)
    targets_ai = _extract_targets_from_prefs(prefs_ai)

    weekly_template: Dict[str, Any] = {}
    if isinstance(prefs_ai, dict):
        wt = prefs_ai.get("weekly_template")
        if isinstance(wt, dict):
            weekly_template = wt

    recent_load = analyze_input.get("recent_load") or {}
    zones = analyze_input.get("zones") or {}
    thresholds = analyze_input.get("thresholds") or {}

    week_row: Optional[Dict[str, Any]] = None
    if plan_id_effective:
        week_row = db_get_week_row_for_plan(
            user_id=user_id,
            plan_id=plan_id_effective,
            week_index=week_index,
            user_jwt=jwt,
        )

    week_meta: Dict[str, Any] = {
        "week_index": week_index,
        "week_start": week_row.get("week_start") if week_row else None,
        "week_end": week_row.get("week_end") if week_row else None,
        "goal": week_row.get("goal") if week_row else None,
        "focus": week_row.get("focus") if week_row else None,
        "load_phase": week_row.get("load_phase") if week_row else None,
        "planned_km": week_row.get("planned_km") if week_row else None,
        "planned_minutes": week_row.get("planned_minutes") if week_row else None,
    }

    week_slots: List[Dict[str, Any]] = []
    if weekly_template and week_meta.get("week_start") and week_meta.get("week_end"):
        week_slots = _resolve_week_slots_for_dates(week_meta, weekly_template)

    external_block: Optional[Dict[str, Any]] = None
    if week_meta["week_start"] and week_meta["week_end"]:
        try:
            ext_window = service_list_external_events_window(
                user_id=user_id,
                from_iso=week_meta["week_start"],
                to_iso=week_meta["week_end"],
                user_jwt=jwt,
            )
            external_block = {
                "window": {
                    "from": week_meta["week_start"],
                    "to": week_meta["week_end"],
                    "events": ext_window.get("events") or [],
                }
            }
        except Exception:
            external_block = None

    state_row = db_get_latest_state_for_user(
        user_id=user_id,
        version=1,
        user_jwt=jwt,
    )
    athlete_state_json = (state_row or {}).get("state_json") or None

    context_payload: Dict[str, Any] = {
        "schema_version": 1,
        "user_id": user_id,
        "week_index": week_index,
        "plan_id": plan_id_effective,
        "overwrite": overwrite,
        "week": week_meta,
        "prefs": prefs_ai,
        "targets": targets_ai,
        "athlete_state": athlete_state_json,
        "recent_load": recent_load,
        "zones": zones,
        "thresholds": thresholds,
        "weekly_template": weekly_template,
        "week_slots": week_slots,
    }
    if external_block is not None:
        context_payload["external_events"] = external_block

    daily_model = model or DEFAULT_MODEL or "gpt-4o-mini"

    daily_plan, trace = generate_daily_week_json(
        context_payload=context_payload,
        model=daily_model,
        debug_raw=debug,
    )

    if not isinstance(daily_plan, dict):
        daily_plan = {}

    plan_id_out = plan_id_effective
    if plan_id_out:
        daily_plan["plan_id"] = plan_id_out

    strength_settings = prefs_ai.get("strength_settings") or {}
    available_equipment = strength_settings.get("available") or []
    if not isinstance(available_equipment, list):
        available_equipment = []
    equipment_mode = strength_settings.get("equipment_mode") or "auto"
    if not isinstance(equipment_mode, str):
        equipment_mode = "auto"

    daily_plan = enrich_daily_plan_with_strength_exercises(
        user_id=user_id,
        daily_plan=daily_plan,
        available_equipment=available_equipment,
        equipment_mode=equipment_mode,
        today=date.today(),
        weeks_back=8,
        user_jwt=jwt,
    )

    deleted_rows = 0
    if overwrite and plan_id_out and week_meta["week_start"] and week_meta["week_end"]:
        deleted_rows = db_clear_daily_for_user_week(
            user_id=user_id,
            plan_id=plan_id_out,
            week_start=week_meta["week_start"],
            week_end=week_meta["week_end"],
            user_jwt=jwt,
        )

    rows_to_insert: List[Dict[str, Any]] = _build_daily_rows_from_ai(
        user_id=user_id,
        plan_id=plan_id_out,
        daily_plan=daily_plan,
    )

    inserted_rows = (
        db_insert_daily_rows(
            rows_to_insert,
            user_jwt=jwt,
        )
        if rows_to_insert
        else 0
    )

    resp: Dict[str, Any] = {
        "daily_plan": daily_plan,
        "plan_id": plan_id_out,
        "week_index": week_index,
        "week_start": daily_plan.get("week_start") or week_meta["week_start"],
        "week_end": daily_plan.get("week_end") or week_meta["week_end"],
        "state_id": (state_row or {}).get("id"),
        "model": daily_model,
        "overwrite": overwrite,
        "inserted_rows": inserted_rows,
        "deleted_rows": deleted_rows,
    }
    if debug:
        resp["debug"] = trace
        resp["context_payload"] = context_payload

    return resp


def service_get_daily_overview(
    user_id: int,
    horizon_days: int = 7,
    *,
    user_jwt: str,
) -> Dict[str, Any]:
    jwt = require_jwt(user_jwt)

    if horizon_days <= 0:
        horizon_days = 7

    meta = db_get_active_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
    ) or db_get_latest_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
    )

    plan_id: Optional[str] = None
    if meta and isinstance(meta.get("plan_id"), str):
        plan_id = meta["plan_id"]

    rows: List[Dict[str, Any]] = (
        db_list_daily_for_user_horizon(
            user_id=user_id,
            horizon_days=horizon_days,
            plan_id=plan_id,
            user_jwt=jwt,
        )
        or []
    )

    by_date: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        d = r.get("plan_date")
        if not d:
            continue
        by_date.setdefault(d, []).append(r)

    days_out: List[Dict[str, Any]] = []

    for date_str, sessions in sorted(by_date.items(), key=lambda kv: kv[0]):
        sessions_out: List[Dict[str, Any]] = []

        for s in sorted(sessions, key=lambda x: int(x.get("session_index") or 0)):
            payload = s.get("payload") or {}
            structure = s.get("structure") or payload.get("structure")

            if structure is None:
                strength_ex = s.get("strength_exercises") or payload.get(
                    "strength_exercises"
                )
                if strength_ex:
                    structure = {"strength_exercises": strength_ex}

            sessions_out.append(
                {
                    "sport": s.get("sport") or "other",
                    "title": s.get("title"),
                    "duration_min": s.get("duration_min"),
                    "intensity": s.get("intensity"),
                    "zone_text": s.get("zone_text"),
                    "notes": s.get("notes"),
                    "session_type": s.get("session_type"),
                    "structure": structure,
                }
            )

        days_out.append(
            {
                "date": date_str,
                "sessions": sessions_out,
            }
        )

    return {
        "horizon_days": horizon_days,
        "days": days_out,
    }


def service_auto_extend_daily_plan(
    user_id: int,
    *,
    min_horizon_days: int = 6,
    user_jwt: str,
) -> Dict[str, Any]:
    jwt = require_jwt(user_jwt)

    if min_horizon_days <= 0:
        min_horizon_days = 6

    today = date.today()

    meta = db_get_active_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
    ) or db_get_latest_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
    )

    plan_id: Optional[str] = None
    if meta and isinstance(meta.get("plan_id"), str):
        plan_id = meta["plan_id"]

    if not plan_id:
        return {
            "changed": False,
            "reason": "no_plan",
        }

    daily_rows: List[Dict[str, Any]] = (
        db_list_daily_for_user_horizon(
            user_id=user_id,
            horizon_days=COACH_PLAN_SCAN_HORIZON_DAYS,
            plan_id=plan_id,
            user_jwt=jwt,
        )
        or []
    )

    if not daily_rows:
        return {
            "changed": False,
            "reason": "no_daily_rows",
        }

    last_date_str = max(
        str(r.get("plan_date"))[:10] for r in daily_rows if r.get("plan_date")
    )
    last_date = date.fromisoformat(last_date_str)
    days_left = (last_date - today).days

    if days_left >= min_horizon_days:
        return {
            "changed": False,
            "reason": "enough_horizon",
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    weekly_rows: List[Dict[str, Any]] = (
        db_get_weekly_for_user_plan(
            user_id=user_id,
            plan_id=plan_id,
            user_jwt=jwt,
        )
        or []
    )

    if not weekly_rows:
        return {
            "changed": False,
            "reason": "no_weekly_rows",
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    weekly_sorted = sorted(
        weekly_rows,
        key=lambda w: int(w.get("week_index") or 0),
    )

    current_week_index: Optional[int] = None
    for w in weekly_sorted:
        ws_raw = w.get("week_start")
        we_raw = w.get("week_end") or ws_raw

        if not isinstance(ws_raw, str) or not isinstance(we_raw, str):
            continue

        try:
            ws = date.fromisoformat(ws_raw)
            we = date.fromisoformat(we_raw)
        except ValueError:
            continue

        if ws <= last_date <= we:
            current_week_index = int(w.get("week_index") or 0)
            break

    if current_week_index is None:
        for w in weekly_sorted:
            ws_raw = w.get("week_start")
            if not isinstance(ws_raw, str):
                continue
            try:
                ws = date.fromisoformat(ws_raw)
            except ValueError:
                continue
            if ws <= last_date:
                current_week_index = int(w.get("week_index") or 0)

    if current_week_index is None:
        return {
            "changed": False,
            "reason": "cannot_determine_current_week",
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    future_weeks = [
        w for w in weekly_sorted if int(w.get("week_index") or 0) > current_week_index
    ]
    if not future_weeks:
        return {
            "changed": False,
            "reason": "no_future_weeks",
            "current_week_index": current_week_index,
            "days_left": days_left,
            "last_daily_date": last_date_str,
        }

    generated: List[int] = []
    current_last_str = last_date_str
    current_last_date = last_date

    for w in future_weeks:
        week_idx = int(w.get("week_index") or 0)

        gen = service_generate_daily_week(
            user_id=user_id,
            week_index=week_idx,
            plan_id=plan_id,
            overwrite=True,
            model=None,
            debug=False,
            user_jwt=jwt,
        )
        generated.append(week_idx)

        daily_rows = (
            db_list_daily_for_user_horizon(
                user_id=user_id,
                horizon_days=COACH_PLAN_SCAN_HORIZON_DAYS,
                plan_id=plan_id,
                user_jwt=jwt,
            )
            or []
        )
        current_last_str = max(
            str(r.get("plan_date"))[:10] for r in daily_rows if r.get("plan_date")
        )
        current_last_date = date.fromisoformat(current_last_str)
        days_left = (current_last_date - today).days

        if days_left >= min_horizon_days:
            break

    return {
        "changed": bool(generated),
        "generated_weeks": generated,
        "current_week_index": current_week_index,
        "final_days_left": days_left,
        "last_daily_date": current_last_str,
        "plan_id": plan_id,
    }