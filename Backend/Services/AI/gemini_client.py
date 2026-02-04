# Services/AI/gemini_client.py
from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

from Configs.config import (
    GEMINI_API_KEY,
    LLM_RETRIES,
    GEMINI_DEFAULT_MODEL,
    GEMINI_MODEL_FALLBACKS,
)
from Services.AI.types import AiResult, AiError
from Services.AI.json_parse import parse_ai_json

_CLIENT: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _CLIENT
    if _CLIENT is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("Missing GEMINI_API_KEY v Configs.config")
        _CLIENT = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options={"api_version": "v1", "timeout": 60},
        )
    return _CLIENT


def _clean_model_name(name: str) -> str:
    s = (name or "").strip()
    if s.lower().startswith("models/"):
        s = s.split("/", 1)[1]
    return s


def _models_priority(explicit_model: Optional[str]) -> List[str]:
    base: List[str] = []
    if GEMINI_DEFAULT_MODEL:
        base.append(_clean_model_name(GEMINI_DEFAULT_MODEL))
    if isinstance(GEMINI_MODEL_FALLBACKS, list):
        base.extend([_clean_model_name(m) for m in GEMINI_MODEL_FALLBACKS if m])

    unique: List[str] = []
    for m in base:
        if m and m not in unique:
            unique.append(m)

    if not unique:
        unique = ["gemini-1.5-flash"]

    if explicit_model:
        em = _clean_model_name(explicit_model)
        if em:
            return [em] + [m for m in unique if m != em]

    return unique


def _extract_usage(resp: Any) -> Optional[Dict[str, int]]:
    """
    Best-effort: rôzne verzie SDK majú usage metadata inde.
    """
    um = getattr(resp, "usage_metadata", None)
    if um is None:
        um = getattr(resp, "usage", None)

    # skúšame typické polia
    def _g(obj: Any, name: str) -> int:
        try:
            return int(getattr(obj, name, 0) or 0)
        except Exception:
            return 0

    if um is None:
        return None

    prompt = _g(um, "prompt_token_count") or _g(um, "prompt_tokens")
    completion = _g(um, "candidates_token_count") or _g(um, "completion_tokens")
    total = _g(um, "total_token_count") or _g(um, "total_tokens")

    if prompt == 0 and completion == 0 and total == 0:
        return None

    if total == 0:
        total = prompt + completion

    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": total,
        "reasoning_tokens": 0,
    }


def gemini_call_json_model(
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    model: Optional[str] = None,
    max_tokens: int = 2000,
    temperature: float = 0.2,
) -> AiResult[Dict[str, Any]]:
    client = _get_client()
    models = _models_priority(model)
    retries = int(LLM_RETRIES or 2)

    trace: Dict[str, Any] = {
        "provider": "gemini",
        "models_tried": models,
        "attempts": [],
        "usage": None,
        "ok_model": None,
    }

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    full_prompt = (
        f"SYSTEM INSTRUCTIONS:\n{system_prompt}\n\n"
        f"USER TASK:\n{user_instructions}\n\n"
        f"CONTEXT DATA (JSON):\n{ctx_json}\n\n"
        f"IMPORTANT: Respond ONLY with a valid JSON object. No markdown."
    )

    last_err: Optional[str] = None

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                resp = client.models.generate_content(
                    model=m,
                    contents=full_prompt,
                    config=types.GenerateContentConfig(
                        temperature=float(temperature),
                        max_output_tokens=int(max_tokens),
                        http_options=types.HttpOptions(timeout=60),
                    ),
                )

                raw = (getattr(resp, "text", None) or "").strip()
                dur_ms = int((time.time() - started) * 1000)

                if not raw:
                    trace["attempts"].append({"model": m, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": "empty_text"})
                    continue

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                ok = isinstance(parsed, dict)

                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": ok,
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:600] + ("…[truncated]" if len(raw) > 600 else ""),
                    }
                )

                if not ok:
                    last_err = "Gemini returned invalid JSON"
                    continue

                trace["ok_model"] = m
                u = _extract_usage(resp)
                if u:
                    trace["usage"] = u

                return AiResult(ok=True, data=parsed, error=None, provider="gemini", model=m, trace=trace)

            except Exception as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                trace["attempts"].append({"model": m, "attempt": attempt, "ok": False, "duration_ms": dur_ms, "error": last_err})
                if "404" in last_err:
                    break
                time.sleep(0.6 * attempt)

    return AiResult(
        ok=False,
        data=None,
        provider="gemini",
        model=(models[0] if models else "unknown"),
        error=AiError(code="ai_gemini_failed", message=(last_err or "All models failed or timed out.")),
        trace=trace,
    )