# Services/AI/body_scan/prompts.py
from __future__ import annotations

from typing import Tuple


def _schema() -> str:
    """JSON schéma pre extrakciu InBody/body scan reportu z fotky."""
    return """
{
  "scan_date": "YYYY-MM-DD | null - z 'Test Date/Time', prekonvertuj na ISO formát",
  "weight_kg": number | null,
  "height_cm": number | null,
  "total_body_water_l": number | null,
  "protein_kg": number | null,
  "mineral_kg": number | null,
  "body_fat_mass_kg": number | null,
  "skeletal_muscle_mass_kg": number | null,
  "bmi": number | null,
  "pbf_percent": number | null,
  "waist_hip_ratio": number | null,
  "visceral_fat_level": number | null,
  "basal_metabolic_rate_kcal": number | null,
  "inbody_score": number | null,
  "obesity_degree_percent": number | null,
  "smi": number | null,
  "segmental_analysis": {
    "lean": {
      "left_arm": {"kg": number | null, "pct": number | null, "eval": "string | null"},
      "right_arm": {"kg": number | null, "pct": number | null, "eval": "string | null"},
      "trunk": {"kg": number | null, "pct": number | null, "eval": "string | null"},
      "left_leg": {"kg": number | null, "pct": number | null, "eval": "string | null"},
      "right_leg": {"kg": number | null, "pct": number | null, "eval": "string | null"}
    },
    "fat": {
      "left_arm": {"kg": number | null, "pct": number | null, "eval": "string | null"},
      "right_arm": {"kg": number | null, "pct": number | null, "eval": "string | null"},
      "trunk": {"kg": number | null, "pct": number | null, "eval": "string | null"},
      "left_leg": {"kg": number | null, "pct": number | null, "eval": "string | null"},
      "right_leg": {"kg": number | null, "pct": number | null, "eval": "string | null"}
    }
  },
  "extraction_confidence": "high" | "medium" | "low",
  "unreadable_fields": ["string"] 
}
""".strip()


def build_prompts_for_body_scan_extraction() -> Tuple[str, str]:
    """
    Zostaví (system_prompt, user_prompt) pre extrakciu dát z fotky InBody
    (alebo podobného body composition) reportu. Text-only prompt (obrázok sa
    posiela samostatne cez call_claude_vision_json image content block).
    """
    system_txt = (
        "You are a precise data extraction assistant. You will be shown a photo of a "
        "body composition analysis report (e.g. InBody). Extract EXACTLY the values "
        "printed on the report into the given JSON schema. Return ONE valid JSON "
        "object only. No markdown, no extra text, no commentary."
    )

    user_txt = (
        "Extract all visible values from this body composition report photo into "
        "the following JSON schema. Rules:\n"
        "- Read numbers EXACTLY as printed - do not round, estimate, or correct them.\n"
        "- If a field is not visible, blurry, cut off, or not present on this report, "
        "set it to null and add its schema key name to 'unreadable_fields'.\n"
        "- NEVER invent or guess a number you cannot clearly read.\n"
        "- 'scan_date': convert the printed test date to ISO 'YYYY-MM-DD' format "
        "regardless of the original format (e.g. '06.21.2026' -> '2026-06-21').\n"
        "- 'segmental_analysis': the report typically shows a body silhouette with left/"
        "right arm, trunk, and left/right leg values for both 'Lean Mass' (or 'Segmental "
        "Lean Analysis') and 'Fat Mass' (or 'Segmental Fat Analysis'). Each has a kg value, "
        "a percentage value, and often an evaluation label (e.g. 'Under', 'Normal', 'Over') "
        "underneath. Map left/right exactly as shown - do not mirror or swap sides.\n"
        "- 'extraction_confidence': your own honest assessment of how clearly readable "
        "the photo was overall ('high' if sharp and well-lit, 'low' if blurry/glare/cut off).\n"
        "- Ignore any 'Calorie Expenditure of Exercise' table if present - not needed.\n\n"
        "SCHEMA:\n"
        + _schema()
        + "\n\nReturn ONLY raw JSON."
    )

    return system_txt, user_txt