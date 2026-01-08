# Configs/ai_pricing.py
from __future__ import annotations
from typing import Dict

# ceny podľa OpenAI STANDARD tieru (USD / 1M tokens)
# prepočítané na micros / 1k tokens: price_per_1M * 1000

_AI_PRICING: Dict[str, Dict[str, int]] = {
    # 1) tvoj default – gpt-4o-mini
    "gpt-4o-mini": {
        "price_input_micros_per_1k": 150,   # 0.15 $ / 1M
        "price_output_micros_per_1k": 600,  # 0.60 $ / 1M
        "price_reasoning_micros_per_1k": 600,
    },

    # 2) lacnejší ale silnejší – gpt-5-mini
    "gpt-5-mini": {
        "price_input_micros_per_1k": 250,   # 0.25 $ / 1M
        "price_output_micros_per_1k": 2000, # 2.00 $ / 1M
        "price_reasoning_micros_per_1k": 2000,
    },

    # 3) hlavný "pro" – gpt-5.1
    "gpt-5.1": {
        "price_input_micros_per_1k": 1250,  # 1.25 $ / 1M
        "price_output_micros_per_1k": 10000,# 10.00 $ / 1M
        "price_reasoning_micros_per_1k": 10000,
    },

    # 4) najnovší veľký – gpt-5.2
    "gpt-5.2": {
        "price_input_micros_per_1k": 1750,  # 1.75 $ / 1M
        "price_output_micros_per_1k": 14000,# 14.00 $ / 1M
        "price_reasoning_micros_per_1k": 14000,
    },

    # 5) klasický univerzál – gpt-4o
    "gpt-4o": {
        "price_input_micros_per_1k": 2500,  # 2.50 $ / 1M
        "price_output_micros_per_1k": 10000,# 10.00 $ / 1M
        "price_reasoning_micros_per_1k": 10000,
    },
}


def get_ai_pricing_for_model(model: str) -> Dict[str, int]:
    """
    Vráti pricing pre daný model v µ na 1k tokenov.
    - ak model nepoznáme, vrátime nuly → usage sa loguje, ale cost=0
    """
    base = (model or "").split(":")[0]  # keby si mal napr. "gpt-4o-mini:standard"
    pricing = _AI_PRICING.get(base)
    if pricing:
        return pricing

    # neznámy model – radšej neúčtovať ako účtovať zle
    print(f"[AI_PRICING] Unknown model in get_ai_pricing_for_model: {model}")
    return {
        "price_input_micros_per_1k": 0,
        "price_output_micros_per_1k": 0,
        "price_reasoning_micros_per_1k": 0,
    }