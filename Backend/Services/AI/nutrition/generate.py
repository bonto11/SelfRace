# Services/AI/nutrition/generate.py
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from Configs.config import ai_model_for
from Services.AI.nutrition.prompts import build_prompts_for_food_text
from Services.AI.provider.provider import ai_call_json_model
from Services.AI.utils.others import debug_log_ai_io


def _trace(res: Any) -> Dict[str, Any]:
    tr = getattr(res, "trace", None)
    if isinstance(tr, dict):
        return tr
    return {
        "ok_provider": str(getattr(res, "provider", None) or "unknown"),
        "ok_model": str(getattr(res, "model", None) or "") or None,
    }


def generate_food_text_json(
    *, text: str, lang: str
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    """(data, trace, error) – data None, ak AI zlyhalo aj po fallbackoch."""
    system_txt, user_txt = build_prompts_for_food_text(lang=lang)
    res = ai_call_json_model(
        context_payload={"meal_text": text},
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=ai_model_for("nutrition_text"),
        max_tokens=1500,
    )
    trace = _trace(res)
    debug_log_ai_io(system_txt, user_txt, res.data if res.ok else None, trace)
    if res.ok and isinstance(res.data, dict):
        return dict(res.data), trace, None
    return None, trace, (res.error.message if res.error else "AI fallback system failed")
