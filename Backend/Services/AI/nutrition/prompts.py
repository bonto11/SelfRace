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


# ---------------------------------------------------------------------------
# FOTKA ETIKETY (fáza 2) – len prepis, nič sa nedopočítava
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_LABEL = """You read nutrition labels on food packaging from photos.
The first image is the nutrition table. An optional second image is the front of the package (product name and brand).

Output ONLY one JSON object, no other text, no markdown:
{
  "name": string | null,
  "brand": string | null,
  "per_100g": {"kcal": number|null, "energy_kj": number|null, "protein_g": number|null, "carbs_g": number|null, "fat_g": number|null, "fiber_g": number|null, "sugar_g": number|null, "salt_g": number|null} | null,
  "per_serving": {same keys} | null,
  "serving_g": number | null,
  "readable": boolean
}

Rules:
- Copy the numbers EXACTLY as printed. Never calculate, estimate or convert anything (no kJ to kcal, no per-serving to per-100 g). A value that is not printed is null.
- per_100g = the "per 100 g" / "per 100 ml" / "na 100 g" / "ve 100 g" column. per_serving = the per-portion column. Fill each only if that column is on the label.
- carbs_g = total carbohydrates ("sacharidy", "uhlohydráty"), sugar_g = "z toho cukry". fat_g = total fat, not saturated.
- salt_g = salt ("soľ", "sůl"). If only sodium is printed, leave salt_g null.
- serving_g = portion size in grams or ml if printed (e.g. "1 porcia = 30 g"), else null.
- Decimal commas become decimal points (12,5 -> 12.5). "<0,5" -> 0.5.
- name = product name from the package (front image if present), without marketing slogans. brand = brand name. null if not visible.
- readable = false when the nutrition table is missing, cut off or too blurry to read; then all numbers null."""


def build_prompts_for_label(*, has_front: bool) -> Tuple[str, str]:
    user = (
        "Read the nutrition label in the first image"
        + (" and the product name from the second image." if has_front else ".")
    )
    return SYSTEM_PROMPT_LABEL, user


# ---------------------------------------------------------------------------
# FOTKA TANIERA (fáza 3) – rovnaký výstup ako text
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_PHOTO = SYSTEM_PROMPT_TEXT.replace(
    "Task: split the user's free-text description of what they ate into food items and estimate the portion and nutrition of each item.",
    "Task: look at the photo of a meal (plate, bowl, snack, drink) and list the food items you can see "
    "with an estimated portion and nutrition of each item. Judge portion size from the plate, cutlery "
    "and packaging. Hidden ingredients (oil, butter, sauce, sugar in a drink) you cannot see: add them "
    "only when they are typical for the dish, and lower the confidence.",
).replace(
    "- Text that is not food or drink: \"items\": [] and a short note.",
    "- A photo without food or drink: \"items\": [] and a short note.",
)


def build_prompts_for_food_photo(*, lang: str, hint: str = "") -> Tuple[str, str]:
    label = _LANG_LABEL.get((lang or "sk").lower(), "Slovak")
    user = f"Estimate the food items in the photo. Write every `name` and the `note` in {label}."
    if hint:
        user += f" The user adds: {hint}"
    return SYSTEM_PROMPT_PHOTO, user
