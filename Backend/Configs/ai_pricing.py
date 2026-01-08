# Configs/ai_pricing.py
from __future__ import annotations

from typing import Dict

# ceny = µ (micros) / 1k tokenov, podľa STANDARD tier
AI_PRICING_MICROS: Dict[str, Dict[str, int]] = {
    "gpt-5.1": {
        "input_micros_per_1k": 1250,   # $1.25 / 1M
        "output_micros_per_1k": 10000, # $10.00 / 1M
    },
    "gpt-5-mini": {
        "input_micros_per_1k": 250,    # $0.25 / 1M
        "output_micros_per_1k": 2000,  # $2.00 / 1M
    },
    "gpt-5-nano": {
        "input_micros_per_1k": 50,     # $0.05 / 1M
        "output_micros_per_1k": 400,   # $0.40 / 1M
    },
    "gpt-4.1-mini": {
        "input_micros_per_1k": 400,    # $0.40 / 1M
        "output_micros_per_1k": 1600,  # $1.60 / 1M
    },
    "gpt-4o-mini": {
        "input_micros_per_1k": 150,    # $0.15 / 1M
        "output_micros_per_1k": 600,   # $0.60 / 1M
    },
}

DEFAULT_MODEL_PRICING_KEY = "gpt-4o-mini"


def get_ai_pricing_for_model(model: str) -> Dict[str, int]:
    """
    Vráti pricing dict pre daný model v µ/1k tokenov.
    Ak model nepoznáme, použijeme fallback.
    """
    if not model:
        return AI_PRICING_MICROS[DEFAULT_MODEL_PRICING_KEY]

    model = model.strip()

    if model in AI_PRICING_MICROS:
        return AI_PRICING_MICROS[model]

    base = (
        model.replace("-chat-latest", "")
        .replace("-latest", "")
        .replace(":flex", "")
        .replace(":batch", "")
    )
    if base in AI_PRICING_MICROS:
        return AI_PRICING_MICROS[base]

    return AI_PRICING_MICROS[DEFAULT_MODEL_PRICING_KEY]