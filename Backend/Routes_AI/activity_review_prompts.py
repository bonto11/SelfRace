from __future__ import annotations

import json
from typing import Dict, Optional, Tuple, Any


# ============================================================
# context minify
# ============================================================

def minify_activity_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Posielame len to, čo má význam pre hodnotenie 0–7 dní + najbližší plán.
    - drop user id
    - drop debug
    - drop heavy (streams/laps/splits)
    """
    if not isinstance(context, dict):
        return {}

    out = json.loads(json.dumps(context, default=str))

    # user anonymizácia
    u = out.get("user")
    if isinstance(u, dict):
        for k in ("id", "email", "name"):
            u.pop(k, None)

    # debug / heavy
    for k in ("_debug", "streams", "laps", "splits"):
        out.pop(k, None)

    # activity safety
    act = out.get("activity")
    if isinstance(act, dict):
        for k in ("name", "external_id"):
            act.pop(k, None)

    return out


# ============================================================
# language
# ============================================================

def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    lang = (settings.get("language") or "sk").lower()
    if lang.startswith("en"):
        return "English", "Use second person ('you')."
    if lang.startswith("cs"):
        return "Czech", "Používej 2. osobu a mluv přímo k atletovi."
    return "Slovak", "Používaj 2. osobu a hovor priamo k atlétovi."


# ============================================================
# sport routing
# ============================================================

def _canonical_sport(s: Any) -> str:
    if not s:
        return "other"
    v = str(s).lower().strip()
    if v in ("run", "trail", "trail_run") or v.startswith("run"):
        return "run"
    if v in ("ride", "bike", "cycle") or v.startswith("ride"):
        return "ride"
    if "strength" in v or "gym" in v or v.startswith("str"):
        return "strength"
    if "swim" in v:
        return "swim"
    return "other"


# ============================================================
# SYSTEM PROMPTS (SHORT, HARD CONSTRAINTS)
# ============================================================

def _system_prompt(sport: str) -> str:
    base = (
        "You are an endurance coaching assistant evaluating ONE completed training session. "
        "You receive structured JSON context (activity + recent load + recovery + optional plan context). "
        "Return ONE valid JSON object only. No markdown, no prose."
    )

    if sport == "run":
        return base + " Focus on running-specific execution, intensity distribution and fatigue signals."
    if sport == "ride":
        return base + " Focus on cycling load distribution, pacing smoothness and fatigue impact."
    if sport == "strength":
        return base + " Focus on strength training stress, recovery needs and injury risk."
    if sport == "swim":
        return base + " Focus on swim effort consistency and recovery impact."
    return base + " Focus on general training evaluation."


# ============================================================
# SPORT-SPECIFIC RULES (STYLE + WHAT MATTERS)
# ============================================================

def _sport_rules(sport_key: str) -> str:
    common = [
        "- Do NOT invent missing data.",
        "- Prefer concrete numbers (minutes, bpm, %).",
        "- Keep horizon: today vs last 7 days, and impact on next 1–2 days.",
        "- Avoid generic motivational clichés.",
        "- If something is unknown/missing, say it's unknown (do not guess).",
    ]

    if sport_key == "run":
        return "\n".join(common + [
            "- Classify session precisely (easy / long / tempo / threshold / intervals / race).",
            "- Use z-minutes + dominant zones to justify conclusions.",
            "- Mention HR in bpm if zone bounds exist in context (avoid only 'Z2').",
            "- Mention musculoskeletal risk only if supported (high Z4/Z5, long duration, abrupt weekly jump).",
        ])

    if sport_key == "run_race":
        return "\n".join(common + [
            "- Treat this as a RACE or KEY EVENT.",
            "- Evaluate pacing discipline, execution under fatigue, and mental resilience.",
            "- Use supportive but honest tone. Allow longer explanation than other sports.",
            "- If plan context exists, explicitly compare: what was planned vs what happened.",
            "- Include 1 concrete post-race recovery action and 1 concrete next-quality-session guidance (if applicable).",
        ])

    if sport_key == "ride":
        return "\n".join(common + [
            "- Emphasize steady vs spiky effort using zones and any available HR signals.",
            "- Highlight fatigue carryover into next 1–2 days (legs, nervous system).",
            "- If intensity is mostly Z1–Z2, reinforce that it's valuable base (not 'too easy').",
        ])

    if sport_key == "strength":
        return "\n".join(common + [
            "- session_kind MUST be 'strength'.",
            "- Focus on fatigue accumulation, soreness risk, recovery needs.",
            "- Do NOT evaluate cardio performance.",
            "- If recovery is poor (sleep/HRV/RHR), recommend reducing intensity/volume next time.",
        ])

    if sport_key == "swim":
        return "\n".join(common + [
            "- Keep concise.",
            "- Focus on intensity distribution and recovery.",
        ])

    return "\n".join(common)


# ============================================================
# PLAN + NEXT DAY RULES (THIS IS WHAT YOU ASKED FOR)
# ============================================================

def _plan_rules() -> str:
    return "\n".join([
        "- If context contains planned training (e.g., 'plan_next' or 'plan_today' or 'plan_week' blocks), you MUST:",
        "  1) Fill comparison.vs_plan (string) describing alignment/mismatch.",
        "  2) In next_steps include at least ONE item that explicitly references the NEXT planned day/session.",
        "     Example: 'Zajtra máš v pláne intervals… dnes preto udrž regeneráciu…'.",
        "- If plan context is missing, set comparison.vs_plan = null and DO NOT invent plan details.",
        "- If there are multiple sessions on the same day (e.g., 'same_day_sessions_count' > 1 or a list exists), you MUST:",
        "  - mention that it's a multi-session day and adjust guidance (fueling, spacing, recovery).",
        "  - in next_steps include guidance for the REST of the day (sleep, food, mobility, easy walk, etc.).",
    ])


# ============================================================
# SCHEMA (shared, stable)
# ============================================================

def _schema(lang: str, sport: str) -> str:
    return f"""
{{
  "schema_version": 4,
  "generated_at": "ISO timestamp",
  "model": "string",

  "activity_id": number | null,
  "sport": "{sport}",
  "session_kind": "recovery" | "easy" | "long" | "tempo" | "threshold" | "intervals" | "race" | "strength" | "other",

  "effort_rating_1_to_10": number | null,
  "execution_score_0_to_100": number | null,

  "intensity": {{
    "z_minutes": {{
      "z1": number | null,
      "z2": number | null,
      "z3": number | null,
      "z4": number | null,
      "z5": number | null
    }},
    "hr_zones_bpm_used": boolean,
    "notes": string | null
  }},

  "summary": {{
    "headline": "1 sentence in {lang}",
    "bullets": string[]
  }},

  "comparison": {{
    "vs_last_7_days": string | null,
    "vs_plan": string | null,
    "rest_of_day_guidance": string | null
  }},

  "highlights": string[],
  "risks": string[],
  "what_went_well": string[],
  "what_to_improve": string[],

  "next_steps": [
    {{ "type": "recovery" | "training" | "nutrition" | "sleep" | "mobility", "text": string }}
  ]
}}
""".strip()


# ============================================================
# MAIN BUILDER
# ============================================================

def build_prompts_for_activity_review(
    context_payload: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
    sport: Optional[str] = None,
    is_race: bool = False,
) -> Tuple[str, str]:
    """
    Deterministic routing: BE decides sport/is_race and picks prompt.
    AI does not have to guess => cheaper + consistent.
    """

    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    resolved_sport = _canonical_sport(
        sport
        or (context_payload.get("activity") or {}).get("sport")
        or "other"
    )

    # special key for running race
    sport_key = "run_race" if resolved_sport == "run" and is_race else resolved_sport

    # inject settings
    context = dict(context_payload)
    context["user_settings"] = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }

    # minify
    context_for_llm = minify_activity_context_for_ai(context)

    system_txt = _system_prompt(resolved_sport)

    user_txt = (
        "Evaluate ONE completed session.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _schema(lang_label, resolved_sport)
        + "\n\nRULES:\n"
        f"- Language: {lang_label}\n"
        f"- {second_person_note}\n"
        f"- Sport route (fixed): {sport_key}\n"
        + _sport_rules(sport_key)
        + "\n"
        + _plan_rules()
        + "\n"
        "- Use bpm ranges if HR zones are present in context.\n"
        "- Summary bullets: max 4.\n"
        "- next_steps: 2–5 items, concrete, tied to THIS session and the NEXT planned day.\n"
        "- Output must be valid JSON only.\n"
    )

    return system_txt, user_txt