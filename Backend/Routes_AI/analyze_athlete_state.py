# Routes_AI/analyze_athlete_state.py
from __future__ import annotations

from typing import Any, Dict, Optional

from Routes_AI.ai_client import call_json_model


def call_ai_analyze_athlete_state(
    input_data: Dict[str, Any],
    *,
    model: Optional[str] = None,
    debug_raw: bool = False,
) -> Dict[str, Any]:
    """
    Volanie LLM pre CoachAnalyzeInput -> CoachAthleteState.

    - input_data = CoachAnalyzeInput (to, čo skladáš v Services/coach_athlete_state)
    - model = preferovaný model (napr. "gpt-4.1-mini"); ak None, použije fallback reťazec
    - debug_raw = či chceme mať vrátený trace (momentálne ho ignorujeme, ale môžeš ho logovať)

    Vráti čistý dict CoachAthleteState (žiadne extra obaly).
    """

    system_prompt = (
        "You are Trainalyze Coach, an endurance coaching assistant.\n"
        "You receive a JSON object called CoachAnalyzeInput containing:\n"
        "- user profile (sex, age, height, weight, training age)\n"
        "- zones & thresholds (HR, pace)\n"
        "- preferences (goal, weeks, sport mix, rules)\n"
        "- personal bests (bests)\n"
        "- recent_load (weekly training minutes & hard sessions)\n"
        "- recovery metrics (RHR, HRV, sleep)\n\n"
        "You MUST respond with exactly ONE valid JSON object called CoachAthleteState.\n"
        "Do NOT include any explanations, prose or code fences. JSON only."
    )

    schema_text = """
CoachAthleteState JSON should roughly follow this structure (keys may be extended but not removed):

{
  "schema_version": 1,
  "generated_at": "ISO-8601 timestamp (UTC)",
  "model": "string (model name)",
  "user_summary": {
    "headline": "short Slovak headline about current form",
    "bullets": string[],
    "risks"?: string[],
    "suggestions_short"?: string[]
  },
  "ai_state": {
    "fitness_level": {
      "run"?: { "level_1_to_10": number, "comment"?: string },
      "ride"?: { "level_1_to_10": number, "comment"?: string },
      "strength"?: { "level_1_to_10": number, "comment"?: string }
    },
    "fatigue_level"?: "low" | "moderate" | "high",
    "injury_risk"?: "low" | "moderate" | "high",
    "volume_tolerance"?: {
      "weekly_minutes_min"?: number | null,
      "weekly_minutes_max"?: number | null,
      "note"?: string | null
    },
    "intensity_tolerance"?: {
      "hard_sessions_per_week_max"?: number | null,
      "comment"?: string | null
    },
    "suggested_block_kind"?: string,
    "key_limitations"?: string[],
    "key_strengths"?: string[],
    "metrics"?: {
      "estimated_vo2max"?: number | null,
      "estimated_5k_time_min"?: number | null,
      "chronic_load_score"?: number | null,
      "acute_load_score"?: number | null
    }
  }
}

All free-form text (headline, bullets, comments) should be in Slovak.
Values MUST be consistent with the input data (do not hallucinate crazy numbers).
""".strip()

    user_instructions = (
        "Analyze the athlete's current fitness, fatigue and injury risk using the provided "
        "CoachAnalyzeInput.\n"
        "Respect the physiological data and recent load – do not overestimate fitness.\n"
        "Fill all fields that you can infer, leave others null or omit them.\n"
        "Follow strictly the JSON shape described in the schema below.\n\n"
        "Schema:\n" + schema_text
    )

    state_json, trace = call_json_model(
        context_payload=input_data,
        system_prompt=system_prompt,
        user_instructions=user_instructions,
        model=model,
        max_tokens=1800,
        debug_raw=debug_raw,
    )

    # trace máš k dispozícii, ak ho chceš neskôr logovať; zatiaľ ho ignorujeme
    _ = trace

    return state_json