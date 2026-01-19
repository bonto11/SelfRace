# Routes_AI/athlete_state_prompts.py
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


def minify_analyze_context_for_ai(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Minifikácia CoachAnalyzeInput pre LLM:
    - drop user.id + potenciálne PII
    - last_activities: drop name + activity_id, date -> relatívne ak je možné
    - drop heavy/raw blocks ak by sa niekde objavili (streams/laps/splits)
    """
    if not isinstance(ctx, dict):
        return {}

    out: Dict[str, Any] = json.loads(json.dumps(ctx, default=str))  # deep-ish copy

    # --- user: remove id/email/name if exist ---
    u = out.get("user")
    if isinstance(u, dict):
        u.pop("id", None)
        u.pop("email", None)
        u.pop("name", None)
        out["user"] = u

    # --- prefs: drop external_activities if present ---
    prefs = out.get("prefs")
    if isinstance(prefs, dict):
        # handle prefs.value too
        pv = prefs.get("value")
        if isinstance(pv, dict):
            pv.pop("external_activities", None)
            prefs["value"] = pv
        prefs.pop("external_activities", None)
        out["prefs"] = prefs

    # --- heavy raw blocks (just in case) ---
    out.pop("streams", None)
    out.pop("laps", None)
    out.pop("splits", None)

    # --- last_activities anonymize ---
    def _parse_date_yyyy_mm_dd(s: str) -> Optional[datetime]:
        try:
            if not s:
                return None
            return datetime.strptime(str(s)[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            return None

    def _rel_day_label(date_str: Optional[str]) -> Optional[str]:
        dt = _parse_date_yyyy_mm_dd(date_str or "")
        if not dt:
            return date_str  # fallback: keep as is
        today = datetime.now(timezone.utc).date()
        d = (today - dt.date()).days
        if d <= 0:
            return "today"
        return f"today-{int(d)}"

    la = out.get("last_activities")
    if isinstance(la, list):
        cleaned = []
        for it in la:
            if not isinstance(it, dict):
                continue
            it2 = dict(it)
            it2["activity_id"] = None
            it2["name"] = None
            if "date" in it2:
                it2["date"] = _rel_day_label(it2.get("date"))
            cleaned.append(it2)
            if len(cleaned) >= 20:
                break
        out["last_activities"] = cleaned

    # --- user_settings: keep only lang/tz if present ---
    us = out.get("user_settings")
    if isinstance(us, dict):
        out["user_settings"] = {
            "language": us.get("language"),
            "timezone": us.get("timezone"),
        }

    return out


def _lang_notes(settings: Dict[str, Any]) -> Tuple[str, str]:
    lang_code = (settings.get("language") or "sk").lower()
    if lang_code.startswith("en"):
        return "English", "Use 'you' to talk directly to the athlete."
    if lang_code.startswith("cs"):
        return "Czech", "Používej 2. osobu ('ty/vy') a mluv přímo k atletovi."
    return "Slovak", "Používaj 2. osobu ('ty') a hovor priamo k atlétovi."


def build_prompts_for_analyze(
    context_payload: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    Prompt builder pre ANALYZE ATHLETE STATE.
    """
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    # attach safe settings
    ctx2 = dict(context_payload) if isinstance(context_payload, dict) else {}
    ctx2["user_settings"] = {
        "language": settings.get("language"),
        "timezone": settings.get("timezone"),
    }

    # ✅ MINIFY HERE
    ctx_for_llm = minify_analyze_context_for_ai(ctx2)

    prefs = (ctx_for_llm.get("prefs") or {})
    # prefs môže byť {value:{...}} alebo flat
    if isinstance(prefs, dict) and isinstance(prefs.get("value"), dict):
        prefs2 = prefs["value"]
    else:
        prefs2 = prefs if isinstance(prefs, dict) else {}

    weeks = int(prefs2.get("weeks") or 4)
    main_sport = prefs2.get("main_sport") or "run"

    system_txt = (
        "You are an endurance coaching assistant for runners and multisport athletes. "
        "You receive structured JSON about an athlete (profile, zones, thresholds, personal bests, "
        "recent load, recovery, preferences including volume, external events, and last activities). "
        "External events are fixed sessions that already create load and must be considered. "
        "Your task is to analyze the current training state and return a SINGLE valid JSON object. "
        "Do NOT output prose or code fences, only JSON."
    )

    schema_text = f"""
{{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp with timezone offset",
  "model": "string (your model name or 'Trainalyze Coach')",
  "user_summary": {{
    "headline": "short summary in {lang_label} (1 sentence, 2nd person)",
    "bullets": string[],
    "risks": string[],
    "suggestions_short": string[]
  }},
  "ai_state": {{
    "fitness_level": {{
      "run":      {{ "level_1_to_10": number, "comment": string | null }},
      "ride":     {{ "level_1_to_10": number, "comment": string | null }} | null,
      "strength": {{ "level_1_to_10": number, "comment": string | null }} | null
    }},
    "fatigue_level": "low" | "moderate" | "high",
    "injury_risk": "low" | "moderate" | "high",
    "volume_tolerance": {{
      "weekly_minutes_min": number | null,
      "weekly_minutes_max": number | null,
      "note": string | null
    }},
    "intensity_tolerance": {{
      "hard_sessions_per_week_max": number | null,
      "comment": string | null
    }},
    "suggested_block_kind": "base_aerobic" | "base_long" | "threshold_speed" | "regeneration" | "race_specific" | string,
    "key_limitations": string[],
    "key_strengths": string[],
    "metrics": {{
      "estimated_vo2max": number | null,
      "estimated_5k_time_min": number | null,
      "chronic_load_score": number | null,
      "acute_load_score": number | null
    }},
    "plan_adjustment": {{
      "soften_next_days": {{
        "should_soften": boolean,
        "days": number | null,
        "reason": string | null
      }},
      "should_replan_weekly": boolean,
      "weekly_replan_reason": string | null,
      "should_notify_user": boolean,
      "notify_message": string | null
    }}
  }}
}}
""".strip()

    user_txt = (
        "Analyze the athlete context JSON and fill the schema.\n"
        f"The main sport is: {main_sport}.\n"
        f"The upcoming horizon is about {weeks} weeks.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(ctx_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return a single JSON object exactly matching the schema.\n"
        f"- All free text MUST be written in {lang_label}.\n"
        f"- {second_person_note} Always speak directly to the athlete in 2nd person.\n"
        "- Use recent_load, recovery, external_events and last_activities for fatigue/injury risk.\n"
        "- If prefs.volume is defined, set weekly_minutes_min/max around it (roughly 70–120%) adjusted by recovery.\n"
        "- Keep numbers realistic.\n"
    )

    return system_txt, user_txt


def build_prompts_for_progress(
    previous_state: dict,
    current_state: dict,
    *,
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    settings = settings or {}
    lang_label, second_person_note = _lang_notes(settings)

    ctx_for_llm = {
        "previous_state": previous_state or {},
        "current_state": current_state or {},
        "user_settings": {
            "language": settings.get("language"),
            "timezone": settings.get("timezone"),
        },
    }

    system_txt = (
        "You are an endurance coaching assistant that compares two athlete state JSON objects. "
        "Return a SINGLE valid JSON object describing meaningful changes. "
        "Do NOT output prose or code fences, only JSON."
    )

    schema_text = f"""
{{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp with timezone offset",
  "model": "string (your model name or 'Trainalyze Coach')",
  "summary": {{
    "headline": "1 sentence in {lang_label}, 2nd person",
    "bullets": string[]
  }},
  "comparisons": {{
    "fatigue_level": {{
      "previous": "low" | "moderate" | "high" | null,
      "current": "low" | "moderate" | "high" | null,
      "comment": string | null
    }},
    "injury_risk": {{
      "previous": "low" | "moderate" | "high" | null,
      "current": "low" | "moderate" | "high" | null,
      "comment": string | null
    }},
    "block_kind": {{
      "previous": string | null,
      "current": string | null,
      "comment": string | null
    }},
    "fitness_level": {{
      "run": {{ "previous": number | null, "current": number | null, "comment": string | null }} | null,
      "ride": {{ "previous": number | null, "current": number | null, "comment": string | null }} | null,
      "strength": {{ "previous": number | null, "current": number | null, "comment": string | null }} | null
    }},
    "volume_tolerance": {{
      "previous_weekly_minutes_min": number | null,
      "previous_weekly_minutes_max": number | null,
      "current_weekly_minutes_min": number | null,
      "current_weekly_minutes_max": number | null,
      "comment": string | null
    }},
    "plan_adjustment": {{
      "soften_change": string | null,
      "weekly_replan_change": string | null
    }}
  }},
  "recommendations": {{
    "celebrations": string[],
    "risks_to_watch": string[],
    "focus_next_weeks": string[]
  }}
}}
""".strip()

    user_txt = (
        "Compare previous_state vs current_state and fill the schema.\n\n"
        "CONTEXT_JSON:\n"
        + json.dumps(ctx_for_llm, ensure_ascii=False)
        + "\n\nSCHEMA_AND_INSTRUCTIONS:\n"
        + schema_text
        + "\n\nHard requirements:\n"
        "- Always return exactly one JSON object matching the schema.\n"
        f"- All free text MUST be written in {lang_label}.\n"
        f"- {second_person_note} Always speak directly to the athlete in 2nd person.\n"
    )

    return system_txt, user_txt