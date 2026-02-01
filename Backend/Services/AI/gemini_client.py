# Services/AI/clients/gemini_client.py
from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Optional

import google.generativeai as genai
from google.generativeai.types import GenerationConfig

from Configs.config import LLM_TIMEOUT_S
from Services.AI.types import AiResult, AiError
from Services.AI.json_parse import parse_ai_json

try:
    from Configs.config import GEMINI_API_KEY
except Exception:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

_GEMINI_CONFIGURED = False

def _configure_gemini_once() -> None:
    global _GEMINI_CONFIGURED
    if _GEMINI_CONFIGURED:
        return
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        _GEMINI_CONFIGURED = True

def _gemini_models_priority(explicit_model: Optional[str]) -> List[str]:
    base = [
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-1.5-pro-latest",
        "gemini-1.5-pro",
    ]
    if explicit_model:
        return [explicit_model] + [m for m in base if m != explicit_model]
    return base

def gemini_call_json_model(
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    model: Optional[str] = None,
    max_tokens: int = 2000,
    debug_raw: bool = False,
    temperature: float = 0.2,
) -> AiResult[Dict[str, Any]]:

    if not GEMINI_API_KEY:
        return AiResult(
            ok=False,
            error=AiError(code="ai_missing_key", message="Missing GEMINI_API_KEY"),
            provider="gemini",
            model=model or "unknown",
        )

    _configure_gemini_once()

    models = _gemini_models_priority(model)
    retries = int(os.getenv("GEMINI_RETRIES", "2") or "2")
    timeout_s = int(os.getenv("GEMINI_TIMEOUT_S", str(LLM_TIMEOUT_S or 30)) or "30")

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    last_err: Optional[str] = None
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    full_user_query = f"{user_instructions.rstrip()}\n\n---\nContext JSON (ground truth):\n{ctx_json}"

    for m_name in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                gen_model = genai.GenerativeModel(
                    model_name=m_name,
                    system_instruction=system_prompt,
                )

                config = GenerationConfig(
                    temperature=float(temperature),
                    max_output_tokens=int(max_tokens),
                    response_mime_type="application/json",
                )

                response = gen_model.generate_content(
                    full_user_query,
                    generation_config=config,
                    request_options={"timeout": timeout_s},
                )

                raw = (getattr(response, "text", None) or "").strip()
                dur_ms = int((time.time() - started) * 1000)

                if not raw:
                    last_err = "Gemini returned empty response"
                    trace["attempts"].append(
                        {"model": m_name, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": last_err}
                    )
                    continue

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                trace["attempts"].append(
                    {
                        "model": m_name,
                        "attempt": attempt,
                        "ok": parsed is not None,
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:800] + ("…[truncated]" if len(raw) > 800 else ""),
                    }
                )

                if parsed is None or not isinstance(parsed, dict):
                    last_err = "Gemini returned invalid JSON"
                    continue

                # success
                return AiResult(
                    ok=True,
                    data=parsed,
                    error=None,
                    provider="gemini",
                    model=m_name,
                )

            except Exception as e:  # noqa: BLE001
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                trace["attempts"].append(
                    {"model": m_name, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": last_err}
                )
                time.sleep(0.4 * attempt)

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned

    return AiResult(
        ok=False,
        data=None,
        error=AiError(code="ai_gemini_failed", message=(last_err or "Unknown"), trace=(trace if debug_raw else None)),
        provider="gemini",
        model=(models[0] if models else (model or "unknown")),
    )