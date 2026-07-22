# Services/AI/body_scan/generate.py
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from Services.AI.provider.claude_client import call_claude_vision_json
from Services.AI.body_scan.prompts import build_prompts_for_body_scan_extraction
from Services.AI.utils.others import debug_log_ai_io


def generate_body_scan_extraction(
    *,
    image_base64: str,
    image_media_type: str = "image/jpeg",
    model: Optional[str] = None,
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    """
    Extrahuje dáta z fotky body composition (InBody) reportu pomocou Claude
    vision. Zámerne ide VŽDY priamo cez Claude (call_claude_vision_json),
    nie cez cross-provider ai_call_json_model fallback reťaz - zatiaľ len
    Claude má v tomto systéme vision support napojený.

    Vracia (parsed_dict, trace, error_message) - parsed_dict je None ak
    extrakcia zlyhala úplne (network/API chyba alebo nevalidný JSON output).
    """
    system_txt, user_txt = build_prompts_for_body_scan_extraction()

    result = call_claude_vision_json(
        system_txt,
        user_txt,
        image_base64=image_base64,
        image_media_type=image_media_type,
        model=model,
        max_tokens=1500,
    )

    debug_log_ai_io(system_txt, user_txt, result.data if result.ok else None, result.trace or {})

    if result.ok and isinstance(result.data, dict):
        return result.data, (result.trace or {}), None

    error_msg = result.error.message if result.error else "Body scan extraction failed"
    return None, (result.trace or {}), error_msg