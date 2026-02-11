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
      - nechávame minified streams/laps/splits v activity/history
      - nechávame user_input.comment (premium feature)
    """
    if not isinstance(context, dict):
        return {}

    # deep copy via json (safe enough for our dicts)
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
        "- Output must be valid JSON only (no markdown).",

        # STYLE: stop the form-filling behavior
        "- STYLE: Write like a human coach. Continuous prose. NO bullets, NO lists, NO headings.",
        "- Avoid repeating the same fact in multiple sentences.",
        "- Do NOT dump metrics. Mention at most 1–2 numbers that actually change interpretation (e.g., duration + dominant zone, or peak HR if relevant).",
        "- If you reference intensity, prefer dominant_zone + short interpretation, not a full zone breakdown.",
        "- Use horizon: today + last 7 days only for ONE short comparison sentence (optional).",
        "- If user_input.comment exists, acknowledge it ONCE and integrate it (do not copy it).",
        "- If splits/laps/streams exist: use them for at most ONE observation (e.g., pacing fade / spiky effort).",
        "- If something is unknown, explicitly say it is unknown (do not guess).",
    ]

    if sport_key == "run":
        return "\n".join(common + [
            "- Identify the session kind (easy/tempo/intervals/etc.) based on available signals.",
            "- Mention injury/fatigue risk only if supported (spike, high intensity, poor recovery).",
        ])

    if sport_key == "run_race":
        return "\n".join(common + [
            "- Treat as a RACE / KEY EVENT.",
            "- Evaluate pacing discipline and execution under fatigue.",
            "- Always include one concrete recovery action and one timing guidance for next quality session (in free text).",
        ])

    if sport_key == "ride":
        return "\n".join(common + [
            "- Mention steadiness/spikiness only if supported by streams/zones/laps.",
        ])

    if sport_key == "strength":
        return "\n".join(common + [
            "- session_kind MUST be 'strength' if sport is strength.",
            "- Focus on strength stress, soreness risk, recovery needs, and movement quality constraints.",
            "- Do NOT evaluate endurance/cardio performance goals.",
            "- If lower body was intentionally reduced, interpret it as a smart constraint, not weakness.",
        ])

    if sport_key == "swim":
        return "\n".join(common + [
            "- Keep concise and practical.",
        ])

    return "\n".join(common)


# ============================================================
# PLAN + NEXT DAY RULES
# ============================================================

def _plan_rules() -> str:
    # Keep it short; long plan rules = bigger prompt + more "form feel"
    return "\n".join([
        "- Plan blocks may or may not be present. Never assume.",
        "- If plan context exists, briefly reference what is next and how to approach it in next_day_plan.",
        "- If plan context is missing, still give a sensible next-day suggestion based on recovery/load.",
    ])


def _has_any_plan_block(ctx_for_llm: Dict[str, Any]) -> bool:
    """
    Best-effort detection to avoid bloating prompt when no plan exists.
    """
    if not isinstance(ctx_for_llm, dict):
        return False

    # common candidate keys (future-proof)
    keys = (
        "plan_next", "plan_today", "plan_week", "daily_plan",
        "plan", "plans", "next_plan", "next_session",
        "calendar", "training_plan",
    )

    for k in keys:
        v = ctx_for_llm.get(k)
        if v is None:
            continue
        # if any non-empty dict/list/str exists -> yes
        if isinstance(v, dict) and len(v) > 0:
            return True
        if isinstance(v, list) and len(v) > 0:
            return True
        if isinstance(v, str) and v.strip():
            return True

    # maybe nested under context or activity
    nested = ctx_for_llm.get("context")
    if isinstance(nested, dict):
        for k in keys:
            v = nested.get(k)
            if isinstance(v, dict) and len(v) > 0:
                return True
            if isinstance(v, list) and len(v) > 0:
                return True
            if isinstance(v, str) and v.strip():
                return True

    return False


# ============================================================
# SCHEMA v6 (free-text output, minimal structure)
# ============================================================

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

  "review_text": "FREE TEXT. 6–14 viet. 2. osoba. Čitateľné ako tréner. Bez odrážok.",
  "next_day_plan": "FREE TEXT. 4–10 viet. Čo ťa čaká zajtra / ďalší deň, ako sa pripraviť, ako to odbehnúť/odcvičiť, čo sledovať.",

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


# ============================================================
# MAIN PROMPT BUILDER
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
    Returns: (system_prompt, user_prompt)
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

    # inject settings into context
    context = dict(context_payload) if isinstance(context_payload, dict) else {}
    context["user_settings"] = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }

    context_for_llm = minify_activity_context_for_ai(context)

    system_txt = _system_prompt(resolved_sport)

    # include plan rules only if plan seems present (saves tokens + reduces formality)
    plan_rules_txt = _plan_rules() if _has_any_plan_block(context_for_llm) else ""

    user_txt = (
        "Evaluate ONE completed session using the provided JSON context.\n\n"
        "What you have:\n"
        "- Focus activity: context.activity\n"
        "- History: context.history.days_0_7 (detailed), context.history.days_8_14 (coarse)\n"
        "- Recovery + recent load + HR zones: context.context\n"
        "- Optional plan blocks may be present.\n"
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
        + ("\n" + plan_rules_txt if plan_rules_txt else "")
        + "\n"
        "- key_numbers: fill from context.activity.metrics when present; otherwise nulls.\n"
        "- dominant_zone: derive from context.activity.zones_min (max minutes) if available; else null.\n"
        "- source: copy from context.user_input.source if present else null.\n"
        "- flags.used_user_comment=true ONLY if context.user_input.comment exists and you actually incorporated it.\n"
        "- flags.needs_caution=true ONLY if you explicitly recommend caution due to recovery/injury/load.\n"
        "- confidence_0_to_100: lower if data is missing (e.g., no zones/HR/history).\n"
        "- Output must be valid JSON only.\n"
    )

    return system_txt, user_txt