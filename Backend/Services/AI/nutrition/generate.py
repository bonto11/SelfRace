# Services/AI/nutrition/generate.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from Configs.config import ai_model_for
from Services.AI.nutrition.prompts import (
    build_prompts_for_food_photo,
    build_prompts_for_food_text,
    build_prompts_for_label,
)
from Services.AI.provider.claude_client import call_claude_vision_json
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


def _vision(
    task: str,
    system_txt: str,
    user_txt: str,
    images: List[Tuple[str, str]],
    max_tokens: int,
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    """
    Vision ide priamo cez Claude ako body scan – cross-provider reťaz
    obrázky nepodporuje. Keď zlyhá model úlohy, skúsi sa ešte default.
    """
    (first_b64, first_type), extra = images[0], images[1:]
    task_model = ai_model_for(task)
    res = call_claude_vision_json(
        system_txt,
        user_txt,
        image_base64=first_b64,
        image_media_type=first_type,
        model=task_model,
        max_tokens=max_tokens,
        extra_images=extra or None,
    )
    if not res.ok and task_model:
        res = call_claude_vision_json(
            system_txt,
            user_txt,
            image_base64=first_b64,
            image_media_type=first_type,
            model=None,
            max_tokens=max_tokens,
            extra_images=extra or None,
        )
    trace = res.trace or {}
    debug_log_ai_io(system_txt, user_txt, res.data if res.ok else None, trace)
    if res.ok and isinstance(res.data, dict):
        return dict(res.data), trace, None
    return None, trace, (res.error.message if res.error else f"{task} failed")


def generate_food_label_json(
    *, label: Tuple[str, str], front: Optional[Tuple[str, str]] = None
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    """label/front = (base64, media_type)."""
    system_txt, user_txt = build_prompts_for_label(has_front=front is not None)
    images = [label] + ([front] if front else [])
    return _vision("nutrition_label", system_txt, user_txt, images, max_tokens=1200)


def generate_food_photo_json(
    *, image: Tuple[str, str], lang: str, hint: str = ""
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    system_txt, user_txt = build_prompts_for_food_photo(lang=lang, hint=hint)
    return _vision("nutrition_photo", system_txt, user_txt, [image], max_tokens=1500)

