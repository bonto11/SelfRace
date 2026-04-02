from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from Modules.Supabase.auth import AuthCtx

def _remove_empty(d: Any) -> Any:
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}}
    elif isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d

def minify_analyze_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(context, dict): return {}
    out: Dict[str, Any] = json.loads(json.dumps(context, default=str))
    
    u = out.get("user")
    if isinstance(u, dict):
        u.pop("id", None)
        u.pop("email", None)
        u.pop("name", None)
        out["user"] = u

    prefs = out.get("prefs")
    if isinstance(prefs, dict):
        pv = prefs.get("value")
        if isinstance(pv, dict):
            pv.pop("external_activities", None)
            prefs["value"] = pv
        prefs.pop("external_activities", None)
        out["prefs"] = prefs

    out.pop("streams", None)
    out.pop("laps", None)
    out.pop("splits", None)

    def _parse_date_yyyy_mm_dd(s: str) -> Optional[datetime]:
        try:
            if not s: return None
            return datetime.strptime(str(s)[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception: return None

    def _rel_day_label(date_str: Optional[str]) -> Optional[str]:
        dt = _parse_date_yyyy_mm_dd(date_str or "")
        if not dt: return date_str
        today = datetime.now(timezone.utc).date()
        d = (today - dt.date()).days
        if d <= 0: return "today"
        return f"today-{int(d)}"

    la = out.get("last_activities")
    if isinstance(la, list):
        cleaned = []
        for it in la:
            if not isinstance(it, dict): continue
            it2 = dict(it)
            it2.pop("activity_id", None)
            it2.pop("name", None)
            if "date" in it2: it2["date"] = _rel_day_label(it2.get("date"))
            cleaned.append(it2)
            if len(cleaned) >= 20: break
        out["last_activities"] = cleaned

    us = out.get("user_settings")
    if isinstance(us, dict):
        out["user_settings"] = {"language": us.get("language"), "timezone": us.get("timezone")}

    return _remove_empty(out)


def _minify_state_for_progress(state: dict) -> dict:
    if not isinstance(state, dict): return {}
    minified = {"ai_state": state.get("ai_state"), "user_summary": state.get("user_summary")}
    return _remove_empty(minified)

def build_prompts_for_progress(previous_state: dict, current_state: dict, *, settings: Optional[Dict[str, Any]] = None, ctx: AuthCtx) -> Tuple[str, str]:
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    context_for_llm = {
        "previous_state": _minify_state_for_progress(previous_state),
        "current_state": _minify_state_for_progress(current_state),
        "user_settings": {"language": settings.get("language"), "timezone": settings.get("timezone")},
    }

    system_txt = (
        "You are an endurance coaching assistant that compares two athlete state JSON objects. "
        "Return a SINGLE valid JSON object describing meaningful changes. "
        "Do NOT output prose or code fences, only JSON."
    )

    schema_text = f"""
{{
  "summary": {{
    "headline": "1 short punchy sentence in {lang_label}, 2nd person",
    "bullets": ["max 3 short points"]
  }},
  "comparisons": {{
    "fatigue_level": {{ "previous": "low" | "moderate" | "high" | null, "current": "low" | "moderate" | "high" | null, "comment": "max 1 sentence" }},
    "injury_risk": {{ "previous": "low" | "moderate" | "high" | null, "current": "low" | "moderate" | "high" | null, "comment": "max 1 sentence" }},
    "block_kind": {{ "previous": string | null, "current": string | null, "comment": "max 1 sentence" }},
    "vo2max": {{ "previous": number | null, "current": number | null, "comment": "max 1 sentence" }} | null,
    "volume_tolerance": {{ "previous_weekly_minutes_min": number | null, "previous_weekly_minutes_max": number | null, "current_weekly_minutes_min": number | null, "current_weekly_minutes_max": number | null, "comment": "max 1 sentence" }},
    "plan_adjustment": {{ "soften_change": string | null, "weekly_replan_change": string | null }}
  }},
  "recommendations": {{
    "celebrations": ["max 2 short points"],
    "risks_to_watch": ["max 2 short points"],
    "focus_next_weeks": ["max 2 short points"]
  }}
}}
""".strip()

    user_txt = (
        "Compare previous_state vs current_state and fill the schema.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- NO PARROTING. Do NOT parrot back fields if they haven't changed meaningfully.\n"
        "- Always return exactly one JSON object matching the schema.\n"
        f"- All free text MUST be written in {lang_label}.\n"
        f"- {second_person_note} Always speak directly to the athlete in 2nd person.\n"
        "- Keep string arrays short and impactful.\n"
        "- If possible, extract and compare estimated_vo2max from metrics.\n"
    )
    return system_txt, user_txt

def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    lang_code = (settings.get("language") or "sk").lower()
    if lang_code.startswith("en"): return "English", "Use 'you' to talk directly to the athlete."
    if lang_code.startswith("cs"): return "Czech", "Používej 2. osobu ('ty/vy') a mluv přímo k atletovi."
    return "Slovak", "Používaj 2. osobu ('ty') a hovor priamo k atlétovi."

def build_prompts_for_analyze(context_payload: dict, *, settings: Optional[Dict[str, Any]] = None, ctx: AuthCtx) -> Tuple[str, str]:
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    context2 = dict(context_payload) if isinstance(context_payload, dict) else {}
    context2["user_settings"] = {"language": settings.get("language"), "timezone": settings.get("timezone")}

    context_for_llm = minify_analyze_context_for_ai(context2)

    prefs = (context_for_llm.get("prefs") or {})
    if isinstance(prefs, dict) and isinstance(prefs.get("value"), dict): prefs2 = prefs["value"]
    else: prefs2 = prefs if isinstance(prefs, dict) else {}

    weeks = int(prefs2.get("weeks") or 4)
    main_sport = prefs2.get("main_sport") or "run"
    is_beginner = context_for_llm.get("is_returning_beginner")

    last_acts = context_for_llm.get("last_activities") or []
    days_since_last_run = 999
    
    for a in last_acts:
        if isinstance(a, dict) and a.get("sport") == "run":
            date_label = str(a.get("date", ""))
            if date_label == "today":
                days_since_last_run = 0
                break
            elif date_label.startswith("today-"):
                try: days_since_last_run = int(date_label.split("-")[1])
                except ValueError: pass
                break

    detraining_hint = ""
    if 0 < days_since_last_run <= 10:
        detraining_hint = "\n- RECOVERY/DELOAD DETECTED: Fitness is maintained. Do NOT degrade paces or race estimates.\n"
    elif 10 < days_since_last_run <= 21:
        detraining_hint = "\n- MILD DETRAINING DETECTED: Slightly degrade intensive paces (Z4, Z5) by 2-5 sec/km and add some time to race estimates.\n"
    elif days_since_last_run > 21:
        detraining_hint = "\n- SIGNIFICANT DETRAINING DETECTED: Noticeable loss of fitness. Degrade all paces by 10-20 sec/km, significantly increase race estimates, and lower VO2max.\n"

    system_txt = (
        "You are an endurance coaching assistant for runners and multisport athletes. "
        "You receive structured JSON about an athlete. "
        "Your task is to analyze the current training state and return a SINGLE valid JSON object. "
        "Do NOT output prose or code fences, only JSON."
    )

    schema_text = f"""
{{
  "user_summary": {{
    "headline": "1 punchy sentence in {lang_label}, 2nd person",
    "bullets": ["max 3 short points"],
    "risks": ["max 2 short points"],
    "suggestions_short": ["max 3 short points"]
  }},
  "ai_state": {{
    "capabilities": {{
      "run":      {{ "level_1_to_5": number, "label": "Beginner"|"Hobby"|"Intermediate"|"Performance"|"Elite", "comment": "max 1 sentence" }},
      "ride":     {{ "level_1_to_5": number, "label": "Beginner"|"Hobby"|"Intermediate"|"Performance"|"Elite", "comment": "max 1 sentence" }} | null,
      "strength": {{ "level_1_to_5": number, "label": "Beginner"|"Hobby"|"Intermediate"|"Performance"|"Elite", "comment": "max 1 sentence" }} | null
    }},
    "fatigue_level": "low" | "moderate" | "high",
    "injury_risk": "low" | "moderate" | "high",
    "volume_tolerance": {{ "weekly_minutes_min": number | null, "weekly_minutes_max": number | null, "note": "max 1 sentence" }},
    "intensity_tolerance": {{ "hard_sessions_per_week_max": number | null, "comment": "max 1 sentence" }},
    "suggested_block_kind": "base_aerobic" | "base_long" | "threshold_speed" | "regeneration" | "race_specific" | string,
    "metrics": {{
      "estimated_vo2max": number | null,
      "estimated_5k_time_s": number | null,
      "estimated_10k_time_s": number | null,
      "estimated_half_marathon_time_s": number | null,
      "estimated_marathon_time_s": number | null
    }},
    "estimated_paces": {{
      "z1_pace_s": number | null,
      "z2_pace_s": number | null,
      "z3_pace_s": number | null,
      "z4_pace_s": number | null,
      "z5_pace_s": number | null,
      "best_1k_s": number | null
    }},
    "plan_adjustment": {{
      "soften_next_days": {{ "should_soften": boolean, "days": number | null, "reason": "max 1 sentence" }},
      "should_replan_weekly": boolean,
      "weekly_replan_reason": "max 1 sentence" | null,
      "should_notify_user": boolean,
      "notify_message": "max 1 sentence" | null
    }}
  }}
}}
""".strip()

    beginner_hint = ""
    if is_beginner: beginner_hint = "- USER IS DETECTED AS BEGINNER/RETURNING. Assign capabilities.run.level_1_to_5 = 1.\n"

    user_txt = (
        "Analyze the athlete context JSON and fill the schema.\n"
        f"The main sport is: {main_sport}.\n"
        f"The upcoming horizon is about {weeks} weeks.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object exactly matching the schema.\n"
        "- NO PARROTING: Do NOT output acute_load_score or chronic_load_score in the schema.\n"
        f"- All free text MUST be written in {lang_label}.\n"
        f"- {second_person_note} Always speak directly to the athlete in 2nd person.\n"
        "- Use recent_load, recovery, external_events and last_activities for fatigue/injury risk.\n"
        + beginner_hint
        + detraining_hint
        + "\nCRITICAL INSTRUCTIONS FOR 'estimated_paces':\n"
        "1. NO RUNS = NO UPDATE (UNLESS DETRAINING).\n"
        "2. DO NOT USE OVERALL AVG PACE FOR INTERVALS.\n"
        "3. EVALUATE SEGMENTS: Use distance, pace and HR to judge capability.\n"
        "4. EVOLUTION, NOT REVOLUTION.\n"
        "5. REALITY CHECK: Z1 pace should never exceed 7:30 min/km if 5K is < 25 min.\n"
    )

    return system_txt, user_txt