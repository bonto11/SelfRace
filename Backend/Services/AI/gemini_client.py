from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types

from Configs.config import (
    GEMINI_API_KEY,
    LLM_TIMEOUT_S,
    LLM_RETRIES,
    GEMINI_DEFAULT_MODEL,
    GEMINI_MODEL_FALLBACKS,
)
from Services.AI.types import AiResult, AiError
from Services.AI.json_parse import parse_ai_json

_CLIENT: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    """
    google-genai Python SDK:
      client = genai.Client(api_key=...)
    """
    global _CLIENT
    if _CLIENT is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("Missing GEMINI_API_KEY")
        _CLIENT = genai.Client(api_key=GEMINI_API_KEY)
    return _CLIENT


def _uniq_keep_order(items: List[str]) -> List[str]:
    out: List[str] = []
    for x in items:
        x = (x or "").strip()
        if x and x not in out:
            out.append(x)
    return out


def _models_priority(explicit_model: Optional[str]) -> List[str]:
    """
    Dôležité: nepoužívaj "*-latest" aliasy. Tie ti presne teraz robia 404.
    """
    base: List[str] = []

    if GEMINI_DEFAULT_MODEL:
        base.append(str(GEMINI_DEFAULT_MODEL))

    if isinstance(GEMINI_MODEL_FALLBACKS, list):
        base.extend([str(m) for m in GEMINI_MODEL_FALLBACKS if m])

    # hard fallback
    base = _uniq_keep_order(base) or ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"]

    if explicit_model:
        em = str(explicit_model).strip()
        if em:
            return _uniq_keep_order([em] + base)

    return base


def _is_model_not_found_error(e: Exception) -> bool:
    msg = str(e) or ""
    # tvoja chyba: ClientError: 404 NOT_FOUND ... "is not found for API version ..."
    return ("404" in msg and "NOT_FOUND" in msg) or ("is not found for API version" in msg)


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
            data=None,
            error=AiError(code="ai_missing_key", message="Missing GEMINI_API_KEY"),
            provider="gemini",
            model=model or "unknown",
        )

    client = _get_client()

    models = _models_priority(model)
    retries = int(LLM_RETRIES or 2)
    timeout_s = int(LLM_TIMEOUT_S or 30)

    trace: Dict[str, Any] = {
        "models_tried": models,
        "attempts": [],
        "timeout_s": timeout_s,
    }
    last_err: Optional[str] = None
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    full_user_query = (
        user_instructions.rstrip()
        + "\n\n---\nContext JSON (ground truth):\n"
        + ctx_json
    )

    cfg = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=float(temperature),
        max_output_tokens=int(max_tokens),
        response_mime_type="application/json",
    )

    for m_name in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                # SDK call
                resp = client.models.generate_content(
                    model=m_name,
                    contents=full_user_query,
                    config=cfg,
                )

                raw = (getattr(resp, "text", None) or "").strip()
                dur_ms = int((time.time() - started) * 1000)

                if not raw:
                    last_err = "Gemini returned empty response"
                    trace["attempts"].append(
                        {
                            "model": m_name,
                            "attempt": attempt,
                            "ok": False,
                            "duration_ms": dur_ms,
                            "error": last_err,
                        }
                    )
                    continue

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                ok = isinstance(parsed, dict)
                trace["attempts"].append(
                    {
                        "model": m_name,
                        "attempt": attempt,
                        "ok": ok,
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:800] + ("…[truncated]" if len(raw) > 800 else ""),
                    }
                )

                if not ok:
                    last_err = "Gemini returned invalid JSON"
                    continue

                return AiResult(
                    ok=True,
                    data=parsed,
                    error=None,
                    provider="gemini",
                    model=m_name,
                )

            except Exception as e:  # noqa: BLE001
                dur_ms = int((time.time() - started) * 1000)
                msg = f"{e.__class__.__name__}: {e}"
                last_err = msg

                trace["attempts"].append(
                    {
                        "model": m_name,
                        "attempt": attempt,
                        "ok": False,
                        "duration_ms": dur_ms,
                        "error": msg,
                        "kind": ("model_not_found" if _is_model_not_found_error(e) else "exception"),
                    }
                )

                # ak model neexistuje, nemá zmysel retry-ovať ten istý model
                if _is_model_not_found_error(e):
                    break

                time.sleep(0.4 * attempt)

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned

    return AiResult(
        ok=False,
        data=None,
        error=AiError(
            code="ai_gemini_failed",
            message=(last_err or "Unknown"),
            trace=(trace if debug_raw else None),
        ),
        provider="gemini",
        model=(models[0] if models else (model or "unknown")),
    )