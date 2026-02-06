from __future__ import annotations

import json
from typing import Dict, Optional, Tuple, Any
from Modules.Supabase.auth import AuthCtx


def minify_activity_context_for_ai(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Do AI posielame len to, čo má reálny vplyv na hodnotenie v horizonte ~1 týždeň.
    - drop user id
    - drop debug
    - drop všetko heavy (streams/laps/splits)
    """
    if not isinstance(context, dict):
        return {}

    out = json.loads(json.dumps(context, default=str))

    # user
    u = out.get("user")
    if isinstance(u, dict):
        u.pop("id", None)
        u.pop("email", None)
        u.pop("name", None)

    # debug preč
    out.pop("_debug", None)

    # heavy preč (ak by sa tam niekedy objavili)
    out.pop("streams", None)
    out.pop("laps", None)
    out.pop("splits", None)

    # activity safety
    act = out.get("activity")
    if isinstance(act, dict):
        act.pop("name", None)
        act.pop("external_id", None)

    return out


def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    lang = (settings.get("language") or "sk").lower()
    if lang.startswith("en"):
        return "English", "Use 'you' to speak directly to the athlete."
    if lang.startswith("cs"):
        return "Czech", "Používej 2. osobu a mluv přímo k atletovi."
    return "Slovak", "Používaj 2. osobu a hovor priamo k atlétovi."


def build_prompts_for_activity_review(
    context_payload: Dict[str, Any],
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    context = dict(context_payload)
    context["user_settings"] = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }

    context_for_llm = minify_activity_context_for_ai(context)

    system_txt = (
        "You are an endurance coaching assistant evaluating ONE completed training session. "
        "You receive structured JSON about the athlete and one activity. "
        "Return a SINGLE valid JSON object only. No prose, no markdown."
    )

    schema = f"""
{{
  "schema_version": 1,
  "generated_at": "ISO timestamp",
  "model": "string",

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
    "headline": "1 sentence in {lang_label}",
    "bullets": string[]
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

    user_txt = (
        "Evaluate the completed activity with emphasis on 7-day horizon context (recovery + recent load).\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(context_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + schema
        + "\n\nRules:\n"
        f"- Language: {lang_label}\n"
        f"- {second_person_note}\n"
        "- Be objective and concise.\n"
        "- Do NOT invent missing data.\n"
        "- If recovery signals show strain (HRV down, sleep bad, RHR high), highlight risk and suggest easier next steps.\n"
    )

    return system_txt, user_txt