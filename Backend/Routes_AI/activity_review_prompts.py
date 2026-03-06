from __future__ import annotations

import json
from typing import Dict, Optional, Tuple, Any

def _remove_empty(d: Any) -> Any:
    """Rekurzívne vymaže None, [], {} pre extrémnu úsporu AI tokenov."""
    if isinstance(d, dict):
        cleaned = {k: _remove_empty(v) for k, v in d.items()}
        return {k: v for k, v in cleaned.items() if v is not None and v != [] and v != {}}
    elif isinstance(d, list):
        cleaned = [_remove_empty(v) for v in d]
        return [v for v in cleaned if v is not None and v != [] and v != {}]
    return d

def minify_activity_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(context, dict): return {}
    out = json.loads(json.dumps(context, default=str))
    
    # 1. Čistenie používateľa
    u = out.get("user")
    if isinstance(u, dict):
        for k in ("id", "email", "name"): u.pop(k, None)
    out.pop("_debug", None)
    
    # 2. Čistenie hlavnej aktivity
    act = out.get("activity")
    if isinstance(act, dict):
        for k in ("name", "external_id", "activity_id"): act.pop(k, None)
    
    # 3. MASÍVNE ŠETRENIE: Odstránime history staršiu ako 7 dní
    history = out.get("history", {})
    if isinstance(history, dict):
        history.pop("days_8_14", None)
        days_0_7 = history.get("days_0_7", [])
        for day in days_0_7:
            day.pop("activity_id", None)
    
    # 4. MASÍVNE ŠETRENIE 2: Vyhodíme recent_load a duplicitné zóny
    ctx_block = out.get("context", {})
    if isinstance(ctx_block, dict):
        ctx_block.pop("recent_load", None)
        ctx_block.pop("hr_zones_bpm", None)
    
    return _remove_empty(out)

def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    lang = (settings.get("language") or "sk").lower()
    if lang.startswith("en"): return "English", "Use second person ('you')."
    if lang.startswith("cs"): return "Czech", "Používej 2. osobu a mluv přímo k atletovi."
    return "Slovak", "Používaj 2. osobu a hovor priamo k atlétovi."

def _canonical_sport(s: Any) -> str:
    if not s: return "other"
    v = str(s).lower().strip()
    if v in ("run", "trail", "trail_run") or v.startswith("run"): return "run"
    if v in ("ride", "bike", "cycle") or v.startswith(("ride", "bike", "cycle")): return "ride"
    if v in ("strength", "gym", "weights") or v.startswith("str") or "strength" in v or "gym" in v: return "strength"
    if "swim" in v: return "swim"
    return "other"

def _system_prompt(sport: str, is_race: bool = False) -> str:
    if is_race:
        return (
            "You are a Performance Analyst and Elite Coach. The athlete just completed an ALL-OUT RACE or maximum effort test. "
            "Your goal is to analyze physical limits, determine if current thresholds (LTHR/FTP) are outdated, and provide a deep analytical review. "
            "Ignore minor plan deviations; focus on physiological peak performance and recovery needs."
        )
    
    base = (
        "You are a highly empathetic coaching assistant evaluating ONE completed training session. "
        "Return ONE valid JSON object only. No markdown. No extra text."
    )
    if sport == "run": return base + " Focus on running execution and intensity vs. plan."
    if sport == "ride": return base + " Focus on power/HR consistency and execution vs. plan."
    return base + " Focus on general training evaluation."

def _sport_rules(sport_key: str) -> str:
    common = [
        "- Do NOT invent missing data.",
        "- Output must be valid JSON only (no markdown).",
        "- STYLE: Continuous prose. NO bullets, NO lists, NO headings inside text fields.",
        "- Avoid repeating facts. Mention numbers only if they tell a story.",
        "- If user_input.comment exists, acknowledge it once.",
    ]
    
    if sport_key == "run_race":
        return "\n".join(common + [
            "- ANALYZE: Compare Avg HR to current LTHR (Z4/Z5 boundary).",
            "- If Avg HR > current LTHR for > 20min, a threshold update is mandatory.",
            "- Mention pacing: did they fade or finish strong?",
            "- Mandatory recovery instruction (rest or active recovery)."
        ])
    
    if sport_key == "ride_race":
        return "\n".join(common + [
            "- ANALYZE: Compare Avg Power or HR to current thresholds (FTP/LTHR).",
            "- If Normalized Power (or Avg Power) > current FTP for > 40min, suggest a new FTP.",
            "- Look for 'all-out' signs: heart rate pinned in Z4/Z5, high variability index.",
            "- Mandatory recovery advice."
        ])

    if sport_key == "run":
        return "\n".join(common + [
            "- Identify session kind based on intensity. Check for HR Drift."
        ])
    
    if sport_key == "ride":
        return "\n".join(common + [
            "- Mention steadiness. Prioritize power data over HR if available."
        ])
    
    if sport_key == "strength":
        return "\n".join(common + [
            "- Focus on consistency and recovery. Do NOT evaluate pace."
        ])
        
    return "\n".join(common)

def _plan_and_injury_rules() -> str:
    return "\n".join([
        "--- CRITICAL CONTEXT RULES ---",
        "1. INJURY: If context.context.injury_state is present, apply DEAF COACH RULE: ignore performance, focus ONLY on recovery/medical advice.",
        "2. TODAY'S PLAN: Compare execution to plan_today. Praise discipline or warn if they overcooked it.",
        "3. TOMORROW'S PLAN: Explain how today impacts plan_tomorrow. If injured, cancel the plan."
    ])

def _schema(lang: str, sport: str, is_race: bool = False) -> str:
    review_len = "10–15 sentences" if is_race else "6–12 sentences"
    return f"""
{{
  "schema_version": 6,
  "generated_at": "ISO timestamp",
  "model": "string",
  "activity_id": number | null,
  "sport": "{sport}",
  "session_kind": "{"race" if is_race else "easy"}",
  "review_text": "FREE TEXT. {review_len}. {lang}. Performance mode if race. Address athlete directly.",
  "next_day_plan": "FREE TEXT. 4–8 sentences. Recovery focus.",
  "key_numbers": {{
    "duration_min": number | null,
    "distance_km": number | null,
    "avg_hr_bpm": number | null,
    "max_hr_bpm": number | null,
    "dominant_zone": "Z1" | "Z2" | "Z3" | "Z4" | "Z5" | null
  }},
  "suggested_thresholds": {{
    "sport": "running" | "cycling",
    "threshold_type": "LT2" | "FTP",
    "hr_bpm": number | null,
    "pace_sec_km": number | null,
    "power_watt": number | null,
    "notes": "Scientific reasoning for the change."
  }} | null,
  "flags": {{ "used_user_comment": boolean, "needs_caution": boolean }}
}}
""".strip()

def build_prompts_for_activity_review(
    context_payload: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
    sport: Optional[str] = None,
    is_race: bool = False,
) -> Tuple[str, str]:

    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    user_input_data = context_payload.get("user_input") or {}
    actually_is_race = is_race or bool(user_input_data.get("is_race_effort"))

    resolved_sport = _canonical_sport(
        (context_payload.get("sport") if isinstance(context_payload, dict) else None)
        or sport or "other"
    )

    # Nastavenie sport_key pre výber pravidiel
    if actually_is_race:
        sport_key = "run_race" if resolved_sport == "run" else "ride_race" if resolved_sport == "ride" else resolved_sport
    else:
        sport_key = resolved_sport

    context_for_llm = minify_activity_context_for_ai(context_payload)

    system_txt = _system_prompt(resolved_sport, is_race=actually_is_race)

    # Špeciálna analýza pre Race Effort
    race_logic = ""
    if actually_is_race:
        race_logic = (
            "\n--- PERFORMANCE ANALYTICS PROTOCOL ---\n"
            "1. Find current thresholds in `context.user_zones` or `context.context.user_zones`.\n"
            "2. If `avg_hr_bpm` >= current LTHR (Z4/Z5 boundary) for > 20min, athlete's fitness has increased.\n"
            "3. If `ride` and `avg_power` or `NP` > current FTP for > 40min, athlete's fitness has increased.\n"
            "4. Suggest new thresholds in `suggested_thresholds` only if the data clearly exceeds current limits.\n"
            "5. Acknowledge this was an all-out effort. Do not warn about high heart rate; it is expected in a race.\n"
        )

    user_txt = (
        f"Analyze this {resolved_sport.upper()} session. {'[ALL-OUT EFFORT MODE]' if actually_is_race else '[STANDARD MODE]'}\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _schema(lang_label, resolved_sport, is_race=actually_is_race)
        + "\n\nRULES:\n"
        f"- Language: {lang_label}\n"
        f"- {second_person_note}\n"
        + _sport_rules(sport_key)
        + "\n" + _plan_and_injury_rules()
        + race_logic
        + "\n- Return ONLY raw JSON."
    )

    return system_txt, user_txt