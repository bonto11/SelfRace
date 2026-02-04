# Routes_AI/activity_review_prompts.py
from __future__ import annotations

import json
from typing import Dict, Optional, Tuple, Any


def minify_activity_context_for_ai(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Keep only what matters for 1-week activity review:
    - user: drop PII
    - context: recovery + recent_load (already minified by builder, but keep safe)
    - activity: metrics + zones + flags
    Drop anything else if present.
    """
    if not isinstance(ctx, dict):
        return {}

    out = json.loads(json.dumps(ctx, default=str))

    # --- user (remove PII/internal) ---
    u = out.get("user")
    if isinstance(u, dict):
        u.pop("id", None)
        u.pop("email", None)
        u.pop("name", None)

    # --- hard drop common heavy/noisy keys (defensive) ---
    for k in ("streams", "laps", "splits", "external_events", "prefs", "targets", "thresholds", "zones", "active_plan"):
        if k in out:
            out.pop(k, None)

    # --- keep only context.recovery + context.recent_load ---
    ctx_obj = out.get("context")
    if isinstance(ctx_obj, dict):
        keep_ctx = {
            "recovery": ctx_obj.get("recovery"),
            "recent_load": ctx_obj.get("recent_load"),
        }
        out["context"] = keep_ctx
    else:
        out["context"] = {"recovery": None, "recent_load": None}

    # --- activity: keep only compact fields ---
    act = out.get("activity")
    if isinstance(act, dict):
        keep_act = {
            "activity_id": act.get("activity_id"),
            "days_ago": act.get("days_ago"),
            "sport": act.get("sport"),
            "metrics": act.get("metrics"),
            "zones": act.get("zones"),
            "flags": act.get("flags"),
        }
        out["activity"] = keep_act

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
    """
    Prompt builder for ONE activity evaluation with ~1-week horizon.
    Focus on: recovery (HRV/RHR/sleep trend) + recent load (current/prev weeks) + this activity intensity.
    """
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    ctx = dict(context_payload)
    ctx["user_settings"] = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }

    ctx_for_llm = minify_activity_context_for_ai(ctx)

    system_txt = (
        "You are an endurance coaching assistant evaluating ONE completed training session. "
        "You receive compact JSON with: recovery status, recent load (week horizon), and activity metrics/zones. "
        "Return ONLY a single valid JSON object. No prose, no markdown."
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

  "next_steps": [
    {{ "type": "recovery" | "training" | "nutrition" | "sleep" | "mobility", "text": string }}
  ]
}}
""".strip()

    user_txt = (
        "Evaluate the activity using ONLY the provided data.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(ctx_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA:\n"
        + schema
        + "\n\nRules:\n"
        f"- Language: {lang_label}\n"
        f"- {second_person_note}\n"
        "- Focus on ~1 week horizon: recovery (HRV/RHR/sleep trend) + recent load + this session intensity.\n"
        "- Be objective and concise. Do not moralize.\n"
        "- Do NOT invent missing data.\n"
        "- If recovery trend is down / sleep not ok, reflect it in risks/next_steps (without panic).\n"
        "- Do NOT talk about long-term races, season goals, or multi-week planning.\n"
    )

    return system_txt, user_txt