from __future__ import annotations

import json
from typing import Dict, Optional, Tuple, Any


# ============================================================
# context minify (aligned with builder payload)
# ============================================================

def minify_activity_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Builder už posiela minified veci (streams_minified/splits_minified/laps_minified).
    Takže:
      - drop user id/email/name
      - drop debug
      - NEDROPujeme minified streams/laps/splits v activity/history (chceme ich nechať).
      - nechávame aj user_input.comment (premium feature)
    """
    if not isinstance(context, dict):
        return {}

    out = json.loads(json.dumps(context, default=str))

    # user anonymizácia
    u = out.get("user")
    if isinstance(u, dict):
        for k in ("id", "email", "name"):
            u.pop(k, None)

    # debug preč
    out.pop("_debug", None)

    # activity safety (ak by sa tam niekedy objavilo)
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
    if v in ("ride", "bike", "cycle") or v.startswith(("ride", "bike", "cycle")):
        return "ride"
    if v in ("strength", "gym", "weights") or v.startswith("str") or "strength" in v or "gym" in v:
        return "strength"
    if "swim" in v:
        return "swim"
    return "other"


# ============================================================
# SYSTEM PROMPTS (short, hard constraints)
# ============================================================

def _system_prompt(sport: str) -> str:
    base = (
        "You are a coaching assistant evaluating ONE completed training session. "
        "You receive structured JSON context (focus activity + recent 14-day history + recovery + optional plan + optional user comment). "
        "Return ONE valid JSON object only. No markdown. No extra text."
    )

    if sport == "run":
        return base + " Focus on running execution, intensity distribution, and injury/fatigue signals."
    if sport == "ride":
        return base + " Focus on cycling load distribution, steadiness, and recovery impact."
    if sport == "strength":
        return base + " Focus on strength stress, recovery needs, and injury risk. Do not evaluate cardio."
    if sport == "swim":
        return base + " Focus on swim consistency, effort control, and recovery impact."
    return base + " Focus on general training evaluation and recovery impact."


# ============================================================
# SPORT-SPECIFIC RULES (style + what matters)
# ============================================================

def _sport_rules(sport_key: str) -> str:
    common = [
        "- Do NOT invent missing data.",
        "- Prefer concrete numbers (minutes, bpm, pace, cadence) when present.",
        "- Use horizon: today + last 7 days, and impact on next 1–2 days.",
        "- Avoid generic motivational clichés. If you motivate, be specific and earned.",
        "- If something is unknown, say it's unknown (do not guess).",
        "- If streams/splits/laps exist: use them only for 1–2 concrete observations (do not overfit).",
        "- If user_input.comment exists, explicitly acknowledge it and incorporate it into evaluation (without blindly agreeing).",
    ]

    if sport_key == "run":
        return "\n".join(common + [
            "- Classify session precisely (easy/long/tempo/threshold/intervals/race).",
            "- Justify using zones_min (z1..z5 minutes) and/or HR metrics.",
            "- If hr_zones_bpm exist, mention bpm bounds at least once (avoid only 'Z2').",
            "- Mention musculoskeletal risk only if supported (high Z4/Z5, long duration, load spike, poor recovery).",
            "- If pace exists, you may mention pacing stability vs fatigue (but don't invent target pace).",
            "- sport_specific.run: fill cadence_comment if cadence is present; fill pace_comment if pace exists; else nulls.",
        ])

    if sport_key == "run_race":
        return "\n".join(common + [
            "- Treat as a RACE / KEY EVENT.",
            "- Allow longer explanation than usual (still structured).",
            "- Evaluate pacing discipline, execution under fatigue, and mental resilience.",
            "- If plan context exists, explicitly compare: planned vs executed.",
            "- Always include: (1) one concrete post-race recovery action, (2) one next-quality-session timing guidance.",
            "- sport_specific.run: prefer to fill pace_comment + cadence_comment if any signal exists; otherwise nulls.",
        ])

    if sport_key == "ride":
        return "\n".join(common + [
            "- Emphasize steady vs spiky effort (zones, HR, streams if present).",
            "- Highlight fatigue carryover into next 1–2 days.",
            "- If mostly Z1–Z2, reinforce base value (not 'too easy').",
            "- sport_specific.ride.steadiness_comment: fill if any stream/zone signal exists; else null.",
        ])

    if sport_key == "strength":
        return "\n".join(common + [
            "- session_kind MUST be 'strength'.",
            "- Focus on fatigue accumulation, soreness risk, recovery needs.",
            "- Do NOT evaluate endurance metrics as performance goals.",
            "- If recovery is poor (sleep/HRV/RHR), recommend lowering intensity/volume next time.",
            "- sport_specific.strength.soreness_risk: fill only if supported; else null.",
        ])

    if sport_key == "swim":
        return "\n".join(common + [
            "- Keep concise.",
            "- Focus on effort control, consistency and recovery impact.",
            "- sport_specific.swim.consistency_comment: fill if any signal exists; else null.",
        ])

    return "\n".join(common)


# ============================================================
# PLAN + NEXT DAY RULES
# ============================================================

def _plan_rules() -> str:
    return "\n".join([
        "- Plan blocks may or may not be present. Never assume.",
        "- If context contains planned training blocks (e.g., 'plan_next', 'plan_today', 'plan_week', 'daily_plan', etc.), you MUST:",
        "  1) Fill comparison.vs_plan describing alignment/mismatch.",
        "  2) In next_steps include at least ONE item explicitly referencing the NEXT planned day/session.",
        "  3) In comparison.rest_of_day_guidance include 1–2 concrete actions for the rest of today.",
        "  4) Fill comparison.next_planned_day_reference with a short explicit reference string.",
        "- If plan context is missing, set comparison.vs_plan = null and comparison.next_planned_day_reference = null.",
        "- If there are multiple sessions in the same day (a list exists OR 'same_day_sessions_count' > 1), mention it's a multi-session day and adjust fueling/recovery guidance.",
    ])


# ============================================================
# SCHEMA (aligned with builder + sport differentiation)
# ============================================================

def _schema(lang: str, sport: str) -> str:
    return f"""
{{
  "schema_version": 5,
  "generated_at": "ISO timestamp",
  "model": "string",

  "activity_id": number | null,
  "sport": "{sport}",

  "session_kind": "recovery" | "easy" | "long" | "tempo" | "threshold" | "intervals" | "race" | "strength" | "other",
  "effort_rating_1_to_10": number | null,
  "execution_score_0_to_100": number | null,

  "intensity": {{
    "dominant_zone": "Z1" | "Z2" | "Z3" | "Z4" | "Z5" | null,
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
    "rest_of_day_guidance": string | null,
    "next_planned_day_reference": string | null
  }},

  "highlights": string[],
  "risks": string[],
  "what_went_well": string[],
  "what_to_improve": string[],

  "sport_specific": {{
    "run": {{
      "pace_comment": string | null,
      "cadence_comment": string | null
    }} | null,
    "ride": {{
      "steadiness_comment": string | null
    }} | null,
    "strength": {{
      "soreness_risk": string | null
    }} | null,
    "swim": {{
      "consistency_comment": string | null
    }} | null
  }},

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
    Builder sets root 'sport' => use that first.
    """

    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    # prefer builder root sport, then explicit param, then activity.sport
    resolved_sport = _canonical_sport(
        (context_payload.get("sport") if isinstance(context_payload, dict) else None)
        or sport
        or ((context_payload.get("activity") or {}).get("sport") if isinstance(context_payload, dict) else None)
        or "other"
    )

    sport_key = "run_race" if (resolved_sport == "run" and is_race) else resolved_sport

    # inject settings
    context = dict(context_payload) if isinstance(context_payload, dict) else {}
    context["user_settings"] = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }

    context_for_llm = minify_activity_context_for_ai(context)

    system_txt = _system_prompt(resolved_sport)

    user_txt = (
        "Evaluate ONE completed session using the provided JSON context.\n\n"
        "What you have:\n"
        "- Focus activity: context.activity\n"
        "- History: context.history.days_0_7 (detailed), context.history.days_8_14 (coarse)\n"
        "- Recovery + recent load + HR zones: context.context\n"
        "- Optional plan blocks may be present (do not assume).\n"
        "- Optional user comment may be present at context.user_input.comment.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _schema(lang_label, resolved_sport)
        + "\n\nRULES:\n"
        f"- Language: {lang_label}\n"
        f"- {second_person_note}\n"
        f"- Sport route (fixed by backend): {sport_key}\n"
        + _sport_rules(sport_key)
        + "\n"
        + _plan_rules()
        + "\n"
        "- Derive dominant_zone from z_minutes (max minutes). If z_minutes missing, set dominant_zone=null.\n"
        "- hr_zones_bpm_used=true ONLY if context.context.hr_zones_bpm exists and you actually referenced bpm bounds.\n"
        "- summary.bullets: max 4.\n"
        "- next_steps: 2–5 items, concrete, tied to THIS session and the NEXT planned day if plan exists.\n"
        "- sport_specific: fill ONLY the relevant sport block; set other sport blocks to null.\n"
        "- Output must be valid JSON only.\n"
    )

    return system_txt, user_txt