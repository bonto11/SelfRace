# Services/AI/activity_review/prompts.py
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
    
    # 1. Čistenie používateľa - NEVYMAZÁVAME 'name' (zmeníme na first_name) a nechávame gender
    u = out.get("user")
    if isinstance(u, dict):
        for k in ("id", "email"): u.pop(k, None) 
        # Meno nechávame, ale ak je to celé meno, môžeme ho tu rozdeliť, 
        # alebo predpokladať, že sa to spracuje vonku.
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

def _lang_notes(settings: Dict[str, Any], user_data: Optional[Dict[str, Any]] = None) -> Tuple[str, str]:
    lang = (settings.get("language") or "sk").lower()
    user_data = user_data or {}
    
    first_name = user_data.get("first_name")
    gender = user_data.get("gender")
    address_rule = ""
    
    if lang.startswith("en"): 
        lang_label = "English"
        address_rule = "Use second person ('you'). "
        if first_name:
            address_rule += f"Address the athlete by their first name: '{first_name}'. "
            
    elif lang.startswith("cs"): 
        lang_label = "Czech"
        address_rule = "Používej 2. osobu (tykání) a mluv přímo k atletovi. "
        if first_name:
            address_rule += f"Oslovuj atlete jménem: '{first_name}'. "
        if gender == "female":
            address_rule += "DŮLEŽITÉ: Atletka je ŽENA. Používej ženský rod (např. 'běžela jsi', 'zvládla jsi'). "
        elif gender == "male":
            address_rule += "Atlet je MUŽ. Používej mužský rod (např. 'běžel jsi', 'zvládl jsi'). "
            
    else: # Slovak fallback
        lang_label = "Slovak"
        address_rule = "Používaj 2. osobu (tykanie) a hovor priamo k atlétovi. "
        if first_name:
            address_rule += f"Oslovuj atléta menom: '{first_name}'. "
        if gender == "female":
            address_rule += "DÔLEŽITÉ: Atlétka je ŽENA. Používaj výhradne ženský rod slovies a prídavných mien (napr. 'bežala si', 'zvládla si', 'bola si'). "
        elif gender == "male":
            address_rule += "Atlét je MUŽ. Používaj mužský rod slovies a prídavných mien (napr. 'bežal si', 'zvládol si', 'bol si'). "

    return lang_label, address_rule

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
            "You are an Elite Performance Analyst. The athlete has performed an ALL-OUT RACE/TEST. "
            "Your primary mission is to audit their physiological thresholds (LTHR/FTP). "
            "You must be analytical, precise, and decisive regarding fitness improvements or regressions."
        )
    
    base = (
        "You are a highly empathetic coaching assistant evaluating ONE completed training session. "
        "Return ONE valid JSON object only. No markdown. No extra text."
    )
    if sport == "run": return base + " Focus on running execution and intensity vs. plan."
    if sport == "ride": return base + " Focus on power/HR consistency and execution vs. plan."
    return base + " Focus on general training evaluation."

def _sport_rules(sport_key: str, is_race: bool = False) -> str:
    common = [
        "- Do NOT invent missing data.",
        "- Output must be valid JSON only (no markdown).",
        "- STYLE: Continuous prose. NO bullets, NO lists, NO headings inside text fields.",
        "- PACE FORMAT: Always write pace in 'mm:ss/km' format (e.g., 4:35/km). NEVER write pace in raw seconds.",
    ]
    
    if not is_race:
        common.append("- CRITICAL THRESHOLD RULE: Because this is a STANDARD TRAINING session (not a Race Effort), DO NOT suggest new thresholds. Set 'suggested_thresholds' to null.")
    
    if sport_key == "run_race":
        return "\n".join(common + [
            "- MANDATORY LTHR AUDIT: You MUST compare the session's Average HR with the current LTHR (Z4/Z5 boundary).",
            "- VERDICT: Explicitly state in 'review_text' whether the LTHR has improved, worsened, or remained stable.",
            "- Mention pacing: did they start too fast or finish with a strong kick?",
            "- Mandatory recovery instruction."
        ])
    
    if sport_key == "ride_race":
        return "\n".join(common + [
            "- MANDATORY FTP AUDIT: Compare Avg/Normalized Power with current FTP.",
            "- VERDICT: Explicitly state whether the FTP threshold has improved, worsened, or remained stable.",
            "- Mandatory recovery advice."
        ])

    return "\n".join(common + ["- Identify session kind and evaluate intensity vs plan."])

def _plan_and_injury_rules() -> str:
    return "\n".join([
        "--- CRITICAL CONTEXT RULES ---",
        "1. INJURY: If injury_state is present, focus only on rest. Ignore performance metrics.",
        "2. TODAY'S PLAN: Compare execution to plan_today if it exists.",
        "3. TOMORROW'S PLAN: Explain recovery needs for the next planned session."
    ])

def _schema(lang: str, sport: str, is_race: bool = False) -> str:
    review_len = "12–18 sentences" if is_race else "6–12 sentences"
    return f"""
{{
  "schema_version": 6,
  "generated_at": "ISO timestamp",
  "model": "string",
  "activity_id": number | null,
  "sport": "{sport}",
  "session_kind": "{"race" if is_race else "training"}",
  "review_text": "FREE TEXT. {review_len}. {lang}. Performance audit mode. Address athlete directly. USE mm:ss/km for all pace mentions. Compare threshold to session data and give a verdict.",
  "next_day_plan": "FREE TEXT. 4–8 sentences. Recovery focus.",
  "key_numbers": {{
    "duration_min": number,
    "distance_km": number,
    "avg_hr_bpm": number,
    "max_hr_bpm": number,
    "dominant_zone": "Z1" | "Z2" | "Z3" | "Z4" | "Z5"
  }},
  "suggested_thresholds": {{
    "sport": "running" | "cycling",
    "threshold_type": "LT2" | "FTP",
    "hr_bpm": number | null,
    "pace_sec_km": number | null,
    "power_watt": number | null,
    "notes": "Scientific reasoning. Use mm:ss/km format when mentioning pace in notes."
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
    
    # Vytiahneme údaje o používateľovi z pôvodného kontextu (pred minifikáciou)
    user_data = context_payload.get("user", {})
    
    lang_label, second_person_note = _lang_notes(settings, user_data=user_data)

    user_input_data = context_payload.get("user_input") or {}
    actually_is_race = is_race or bool(user_input_data.get("is_race_effort"))

    resolved_sport = _canonical_sport(context_payload.get("sport") or sport or "other")

    if actually_is_race:
        sport_key = f"{resolved_sport}_race"
    else:
        sport_key = resolved_sport

    context_for_llm = minify_activity_context_for_ai(context_payload)

    system_txt = _system_prompt(resolved_sport, is_race=actually_is_race)

    # Špeciálna analýza pre Race Effort (Audit prahu)
    race_logic = ""
    if actually_is_race:
        race_logic = (
            "\n--- PERFORMANCE AUDIT PROTOCOL ---\n"
            "1. ACCESS CURRENT DATA: Find the current LTHR in `context.user_zones` (the top of Z4).\n"
            "2. PERFORM COMPARISON: Compare that value (e.g., 180 bpm) with the session `avg_hr_bpm`.\n"
            "3. MANDATORY STATEMENT: You MUST explicitly mention that you have performed this comparison in the `review_text`.\n"
            "4. VERDICT: State if the threshold has improved, worsened, or remains stable. Explain the logic.\n"
            "5. FORMATTING: All pace values MUST be in mm:ss/km format.\n"
            "6. DATA SUGGESTION: If improved, provide the new suggested LTHR in `suggested_thresholds`.\n"
        )

    user_txt = (
        f"Analyze this {resolved_sport.upper()} session. Mode: {'[PERFORMANCE AUDIT]' if actually_is_race else '[STANDARD REVIEW]'}\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _schema(lang_label, resolved_sport, is_race=actually_is_race)
        + "\n\nRULES:\n"
        f"- Language: {lang_label}\n"
        f"- {second_person_note}\n"
        + _sport_rules(sport_key, is_race=actually_is_race) # Pridaný parameter is_race
        + race_logic
        + "\n- Return ONLY raw JSON."
    )

    return system_txt, user_txt