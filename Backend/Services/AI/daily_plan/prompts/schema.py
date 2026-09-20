# Services/AI/daily_plan/prompts/schema.py
"""JSON schéma, ktorú musí AI výstup presne dodržať."""

from __future__ import annotations


def build_daily_schema(lang_label: str) -> str:
    return f"""
{{
  "schema_version": 2,
  "days": [
    {{
      "plan_date": "YYYY-MM-DD",
      "weekday": "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun",
      "sessions": [
        {{
          "sport": "run" | "ride" | "swim" | "strength" | "other" | "rest",
          "kind": "easy" | "long" | "interval" | "tempo" | "recovery" | "race" | "mobility" | "rest" | "other",
          "title": "Descriptive title in {lang_label}",
          "duration_min": number,
          "distance_km": number,
          "tss_estimate": number,
          "notes": "REQUIRED. 1-2 short sentences in {lang_label} describing session purpose.",
          "session_type": "external_event" | null,
          "structure": {{
            "warmup": {{ "minutes": number, "notes": "Target HR (bpm) AND Pace/Power. max 2 sentences." }},
            "main_part": [
              {{
                "minutes": number,
                "notes": "Target HR (bpm) AND Pace/Power. max 2 sentences."
              }}
              // OR for interval sessions, use this EXACT shape instead (see INTERVAL BLOCK FORMAT rule):
              // {{
              //   "kind": "interval_block",
              //   "rounds": number,
              //   "work": {{ "minutes": number, "notes": "..." }},
              //   "rest":  {{ "minutes": number, "notes": "..." }}
              // }}
            ],
            "cooldown": {{ "minutes": number, "notes": "Target HR (bpm) AND Pace/Power. max 2 sentences." }},
            "activation": [ {{ "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": "max 3 words" }} ],
            "strength_main_part": [ {{ "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": "max 3 words" }} ],
            "add_ons": [ {{ "exercise_id": string, "sets": number, "reps": string, "rest_s": number, "notes": "max 3 words" }} ]
          }}
        }}
      ]
    }}
  ]
}}
""".strip()
