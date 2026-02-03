# Routes_AI/activity_review_prompts.py
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple


def minify_activity_context_for_ai(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Minifikácia inputu pre Activity Review:
    - drop user.id a PII
    - drop heavy blocks (streams/laps/splits)
    - activity: ponechať len relevantné summary + zone mins + derived metrics
    """
    if not isinstance(ctx, dict):
        return {}

    out: Dict[str, Any] = json.loads(json.dumps(ctx, default=str))

    # --- user ---
    u = out.get("user")
    if isinstance(u, dict):
        u.pop("id", None)
        u.pop("email", None)
        u.pop("name", None)
        out["user"] = u

    # --- heavy blocks ---
    out.pop("streams", None)
    out.pop("laps", None)
    out.pop("splits", None)

    # --- activity cleanup ---
    act = out.get("activity")
    if isinstance(act, dict):
        act.pop("name", None)
        act.pop("external_id", None)
        out["activity"] = act

    return out


def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    lang_code = (settings.get("language") or "sk").lower()
    if lang_code.startswith("en"):
        return "English", "Use 'you' to talk directly to the athlete."
    if lang_code.startswith("cs"):
        return "Czech", "Používej 2. osobu ('ty/vy') a mluv přímo k atletovi."
    return "Slovak", "Používaj 2. osobu ('ty') a hovor priamo k atlétovi."


def build_prompts_for_activity_review(
    context_payload: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    Prompt builder pre AI hodnotenie JEDNEJ aktivity.
    """
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    ctx2 = dict(context_payload) if isinstance(context_payload, dict) else {}
    ctx2["user_settings"] = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }

    # ✅ MINIFY HERE
    ctx_for_llm = minify_activity_context_for_ai(ctx2)

    system_txt = (
        "You are an endurance coaching assistant evaluating ONE completed training session. "
        "You receive structured JSON with athlete context and one activity. "
        "Your task is to objectively evaluate the quality, intensity distribution and execution "
        "of that session and return a SINGLE valid JSON object. "
        "Do NOT output prose, markdown or explanations outside JSON."
    )

    schema_text = f"""
{{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp with timezone offset",
  "model": "string (your model name or 'Trainalyze Coach')",
  "activity_id": number | null,

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
    "notes": string | null
  }},

  "summary": {{
    "headline": "1 sentence in {lang_label}, 2nd person",
    "bullets": string[]
  }},

  "highlights": string[],
  "risks": string[],
  "what_went_well": string[],
  "what_to_improve": string[],

  "next_steps": [
    {{
      "type": "recovery" | "training" | "nutrition" | "sleep" | "mobility",
      "text": "string"
    }}
  ]
}}
""".strip()

    user_txt = (
        "Evaluate the completed activity and fill the schema.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(ctx_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return exactly one JSON object matching the schema.\n"
        f"- All free text MUST be written in {lang_label}.\n"
        f"- {second_person_note} Always speak directly to the athlete.\n"
        "- Do NOT invent metrics that are not present in the context.\n"
        "- If this is a strength session without zones, focus on load, execution and recovery.\n"
        "- Keep feedback concise and actionable.\n"
    )

    return system_txt, user_txt