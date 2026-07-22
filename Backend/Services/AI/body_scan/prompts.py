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
  "total_body_water_range_min": number | null,
  "total_body_water_range_max": number | null,
  "protein_kg": number | null,
  "mineral_kg": number | null,
  "body_fat_mass_kg": number | null,
  "skeletal_muscle_mass_kg": number | null,
  "weight_percent": number | null,
  "weight_scale_min": number | null,
  "weight_scale_max": number | null,
  "smm_percent": number | null,
  "smm_scale_min": number | null,
  "smm_scale_max": number | null,
  "body_fat_mass_percent": number | null,
  "body_fat_mass_scale_min": number | null,
  "body_fat_mass_scale_max": number | null,
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
        "- 'total_body_water_range_min/max': the (min~max) range printed next to "
        "Total Body Water in the 'Body Composition Analysis' table (same format "
        "as weight_range would use for Weight, e.g. '58.5 (43.3~52.9)' means "
        "total_body_water_l=58.5, total_body_water_range_min=43.3, "
        "total_body_water_range_max=52.9).\n"
        "- The 'Muscle-Fat Analysis' section has THREE horizontal percentage bars: "
        "Weight, SMM (Skeletal Muscle Mass), and Body Fat Mass. Each bar has its "
        "OWN numeric scale printed above it (a row of numbers from a minimum on the "
        "left to a maximum on the right, e.g. Weight's scale might read '55 70 85 "
        "100 115 130 145 160 175 190 205', SMM's scale might read '70 80 90 100 110 "
        "120 130 140 150 160 170', Body Fat Mass's scale might read '40 60 80 100 "
        "160 220 280 340 400 460 520'). For EACH of these three bars independently: "
        "read the scale's leftmost number as its 'scale_min' and rightmost number as "
        "its 'scale_max'. Then determine the percentage where the dark/filled bar "
        "indicator visually ends on that specific scale (where the '100' tick mark "
        "represents exactly 100%) - report this as '_percent' (e.g. weight_percent, "
        "smm_percent, body_fat_mass_percent). These three percentages are INDEPENDENT "
        "of each other and independent of any kg value elsewhere on the report - read "
        "each bar's own indicator position on its own scale.\n"
        "- 'segmental_analysis': the report typically shows a body silhouette with left/"
        "right arm, trunk, and left/right leg values for both 'Lean Mass' (or 'Segmental "
        "Lean Analysis') and 'Fat Mass' (or 'Segmental Fat Analysis'). Each has a kg value, "
        "a percentage value, and often an evaluation label (e.g. 'Under', 'Normal', 'Over') "
        "underneath. Map left/right exactly as shown - do not mirror or swap sides.\n"
        "- 'eval' fields inside segmental_analysis MUST always be one of the English "
        "words 'Under', 'Normal', 'Over' - regardless of what language the report "
        "itself is printed in (translate if needed, never invent other words).\n"
        "- 'extraction_confidence': your own honest assessment of how clearly readable "
        "the photo was overall ('high' if sharp and well-lit, 'low' if blurry/glare/cut off).\n"
        "- Ignore any 'Calorie Expenditure of Exercise' table if present - not needed.\n\n"
        "SCHEMA:\n"
        + _schema()
        + "\n\nReturn ONLY raw JSON."
    )

    return system_txt, user_txt
