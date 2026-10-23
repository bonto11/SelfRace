# Services/AI/nutrition/prompts.py
"""
Prompt pre odhad jedla z textu („2 rožky s maslom a šunkou“).

System prompt je zámerne STATICKÝ (bez jazyka, dátumu, mena) – jazyk ide do
user časti. Pri dlhšom prompte tak zaberie prompt caching; dnes je krátky,
ale nech sa neskôr nemusí prerábať.
"""

from __future__ import annotations

from typing import Dict, Tuple

_LANG_LABEL: Dict[str, str] = {"sk": "Slovak", "cs": "Czech", "en": "English"}

SYSTEM_PROMPT_TEXT = """You are a nutrition estimation engine inside a fitness app used in Slovakia and the Czech Republic.
Task: split the user's free-text description of what they ate into food items and estimate the portion and nutrition of each item.

Output ONLY one JSON object, no other text, no markdown:
{
  "items": [
    {"name": string, "grams": number, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number}
  ],
  "confidence": number,
  "note": string | null
}

Rules:
- One item per distinct food: "2 rožky s maslom a šunkou" = 3 items (rožky, maslo, šunka). Quantity goes into grams of that item ("2 rožky" = one item, 80 g).
- name: short food name in the requested language, capitalized, without the amount (e.g. "Rožky", "Maslo", "Šunka").
- grams: edible weight of the whole portion in grams (drinks: ml ≈ g).
- Missing amount: use a typical Slovak/Czech portion. Reference portions: rožok 40 g, krajec chleba 40 g, plátok šunky 15 g, plátok syra 20 g, maslo na pečivo 10 g, vajce 55 g, jogurt 150 g, banán 120 g, jablko 150 g, tanier polievky 300 g, varená ryža/cestoviny/zemiaky ako príloha 200 g, porcia mäsa 150 g, pivo 500 ml, káva s mliekom 200 ml.
- Unclear amount or dish: pick a medium portion and lower the confidence. Do not ask questions.
- kcal, protein_g, carbs_g, fat_g are for the WHOLE portion of the item (not per 100 g). Use standard food composition data.
- kcal must match macros (about 4 × protein + 4 × carbs + 9 × fat; alcohol adds 7 kcal per gram).
- Numbers are plain numbers (no units, no ranges), rounded to whole grams / kcal.
- confidence 0..1 for the whole answer: 0.9+ exact amounts of common foods, 0.6–0.8 typical portions assumed, below 0.5 vague description.
- Text that is not food or drink: "items": [] and a short note.
- note: optional, max 120 characters, in the requested language, only to say what you assumed (e.g. portion size). null when nothing to add.
- Never give diet advice and never judge the food."""


def build_prompts_for_food_text(*, lang: str) -> Tuple[str, str]:
    label = _LANG_LABEL.get((lang or "sk").lower(), "Slovak")
    user = (
        "Estimate the food items in CONTEXT DATA.meal_text. "
        f"Write every `name` and the `note` in {label}."
    )
    return SYSTEM_PROMPT_TEXT, user
