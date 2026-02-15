# Routes_AI/activity_review_prompts.py
from __future__ import annotations

import json
from typing import Dict, Optional, Tuple, Any

def minify_activity_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(context, dict): return {}
    out = json.loads(json.dumps(context, default=str))
    u = out.get("user")
    if isinstance(u, dict):
        for k in ("id", "email", "name"): u.pop(k, None)
    out.pop("_debug", None)
    act = out.get("activity")
    if isinstance(act, dict):
        for k in ("name", "external_id"): act.pop(k, None)
    return out

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

def _system_prompt(sport: str) -> str:
    base = (
        "You are a highly empathetic coaching assistant evaluating ONE completed training session. "
        "You receive structured JSON context containing the activity, history, and potentially the planned training for today and tomorrow. "
        "Return ONE valid JSON object only. No markdown. No extra text."
    )
    if sport == "run": return base + " Focus on running execution, intensity vs. plan, and aerobic decoupling."
    if sport == "ride": return base + " Focus on power/HR consistency, endurance steadiness, and execution vs. plan."
    if sport == "strength": return base + " Focus on volume load and recovery needs. Do not evaluate cardio metrics."
    if sport == "swim": return base + " Focus on swim consistency, effort control, and execution vs. plan."
    return base + " Focus on general training evaluation vs. plan and recovery impact."

def _sport_rules(sport_key: str) -> str:
    common = [
        "- Do NOT invent missing data.",
        "- Output must be valid JSON only (no markdown).",
        "- STYLE: Write like a human coach. Continuous prose. NO bullets, NO lists, NO headings inside the text fields.",
        "- Avoid repeating the same fact in multiple sentences.",
        "- Do NOT dump raw metrics. Instead of saying 'Your HR was 145', say 'Your heart rate stayed in the aerobic zone'.",
        "- Mention at most 1–2 specific numbers only if they tell a story (e.g. max HR on a hill).",
        "- If user_input.comment exists, acknowledge it ONCE and integrate it.",
        "- INTENSITY: Use specific HR zones if available (e.g. 'drž sa v Z2 okolo 145 tepov').",
        "- RPE/FEEL: If zones are missing, describe intensity by feeling (RPE).",
    ]
    if sport_key == "run":
        return "\n".join(common + [
            "- Identify the session kind based on intensity.",
            "- Check for HR Drift if pace is stable but HR rises.",
        ])
    if sport_key == "run_race":
        return "\n".join(common + [
            "- Treat as a RACE / KEY EVENT. Evaluate pacing discipline.",
            "- Always include recovery action.",
        ])
    if sport_key == "ride":
        return "\n".join(common + [
            "- Mention steadiness/spikiness. If power data exists, prioritize it over HR.",
        ])
    if sport_key == "strength":
        return "\n".join(common + [
            "- Focus on consistency and recovery. Do NOT evaluate pace.",
        ])
    return "\n".join(common)

def _plan_and_injury_rules() -> str:
    return "\n".join([
        "--- CRITICAL CONTEXT RULES ---",
        "1. INJURY REPORTED (ANTI-CHEAT & MEDICAL LIABILITY):",
        "   If context.user_input.injury OR context.context.injury_state is present, the athlete IS INJURED.",
        "   - Check the severity of the injury in the context.",
        "   - IF SEVERITY IS >= 7 (SEVERE): DO NOT advise on future training. Your ONLY instruction for the `next_day_plan` MUST be to rest, seek a medical professional, and remind them that the app assumes no liability for their treatment.",
        "   - IF SEVERITY IS < 7 (MILD): The tone MUST be empathetic. Prioritize recovery above fitness goals.",
        "   - DEAF COACH RULE: IGNORE any questions regarding performance, pacing, or pushing harder. Answer ONLY regarding their health and recovery.",
        "",
        "2. TODAY'S PLAN (plan_today):",
        "   - If present, compare their actual execution (context.activity.metrics) to what was planned.",
        "   - Did they go too fast/hard? Praise them if they stuck to the discipline, gently warn them if they overcooked an easy run.",
        "",
        "3. TOMORROW'S PLAN (plan_tomorrow):",
        "   - If present, use it to form the `next_day_plan`.",
        "   - Explain HOW today's effort impacts tomorrow.",
        "   - IF SEVERITY IS >= 7, IGNORE THIS STEP. The plan is cancelled.",
    ])

def _schema(lang: str, sport: str) -> str:
    return f"""
{{
  "schema_version": 6,
  "generated_at": "ISO timestamp",
  "model": "string",

  "activity_id": number | null,
  "sport": "{sport}",
  "source": "auto" | "user" | "service" | null,

  "session_kind": "recovery" | "easy" | "long" | "tempo" | "threshold" | "intervals" | "race" | "strength" | "other",

  "confidence_0_to_100": number | null,

  "review_text": "FREE TEXT. 6–12 sentences. {lang}. Address the athlete directly. Compare execution to today's plan if available. Apply Deaf Coach Rule if injured.",
  "next_day_plan": "FREE TEXT. 4–8 sentences. Advice for tomorrow based on plan_tomorrow (if available) and today's fatigue/injuries.",

  "key_numbers": {{
    "duration_min": number | null,
    "distance_km": number | null,
    "avg_hr_bpm": number | null,
    "max_hr_bpm": number | null,
    "dominant_zone": "Z1" | "Z2" | "Z3" | "Z4" | "Z5" | null
  }},

  "flags": {{
    "used_user_comment": boolean,
    "needs_caution": boolean
  }}
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

    resolved_sport = _canonical_sport(
        (context_payload.get("sport") if isinstance(context_payload, dict) else None)
        or sport
        or ((context_payload.get("activity") or {}).get("sport") if isinstance(context_payload, dict) else None)
        or "other"
    )

    sport_key = "run_race" if (resolved_sport == "run" and is_race) else resolved_sport

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
        "- History: context.history.days_0_7\n"
        "- Plans & Injuries: context.context.plan_today, context.context.plan_tomorrow, context.context.injury_state\n"
        "- Optional user comment: context.user_input.comment.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + _schema(lang_label, resolved_sport)
        + "\n\nRULES:\n"
        f"- Language: {lang_label}\n"
        f"- {second_person_note}\n"
        f"- Sport route (fixed by backend): {sport_key}\n"
        + _sport_rules(sport_key)
        + "\n" + _plan_and_injury_rules()
        + "\n"
        "- flags.needs_caution=true MUST be true if injury is reported or recovery is very poor.\n"
        "- Output must be valid JSON only.\n"
    )

    return system_txt, user_txt