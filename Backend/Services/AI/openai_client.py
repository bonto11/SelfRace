from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional

from openai import OpenAI

from Configs.config import (
    OPENAI_API_KEY,
    LLM_TIMEOUT_S,
    LLM_RETRIES,
    OPENAI_DEFAULT_MODEL,
    OPENAI_MODEL_FALLBACKS,
)
from Services.AI.types import AiResult, AiError
from Services.AI.json_parse import parse_ai_json


def _uniq_keep_order(items: List[str]) -> List[str]:
    out: List[str] = []
    for x in items:
        x = (x or "").strip()
        if x and x not in out:
            out.append(x)
    return out


def _models_priority(explicit_model: Optional[str]) -> List[str]:
    """
    Poradie:
      1) explicit_model (ak je)
      2) OPENAI_DEFAULT_MODEL
      3) OPENAI_MODEL_FALLBACKS
    """
    base: List[str] = []
    if OPENAI_DEFAULT_MODEL:
        base.append(str(OPENAI_DEFAULT_MODEL))

    if isinstance(OPENAI_MODEL_FALLBACKS, list):
        base.extend([str(m) for m in OPENAI_MODEL_FALLBACKS if m])

    base = _uniq_keep_order(base) or ["gpt-4o-mini"]

    if explicit_model:
        em = str(explicit_model).strip()
        if em:
            return _uniq_keep_order([em] + base)

    return base


def _call_openai_once(
    *,
    client: OpenAI,
    model: str,
    system_txt: str,
    user_txt: str,
    max_tokens: int,
    temperature: float,
) -> str:
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_txt},
            {"role": "user", "content": user_txt},
        ],
        temperature=float(temperature),
        max_tokens=int(max_tokens),
        response_format={"type": "json_object"},
    )
    return (resp.choices[0].message.content or "").strip()


def openai_call_json_model(
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    model: Optional[str] = None,
    max_tokens: int = 2000,
    debug_raw: bool = False,
    temperature: float = 0.2,
) -> AiResult[Dict[str, Any]]:
    if not OPENAI_API_KEY:
        return AiResult(
            ok=False,
            data=None,
            error=AiError(code="ai_missing_key", message="Missing OPENAI_API_KEY"),
            provider="openai",
            model=model or "unknown",
        )

    timeout_s = int(LLM_TIMEOUT_S or 30)
    retries = int(LLM_RETRIES or 2)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _models_priority(model)

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    last_err: Optional[str] = None
    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    ok_model: Optional[str] = None

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    user_txt = (
        user_instructions.rstrip()
        + "\n\n---\nContext JSON (ground truth):\n"
        + ctx_json
    )

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                raw = _call_openai_once(
                    client=client,
                    model=m,
                    system_txt=system_prompt,
                    user_txt=user_txt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                dur_ms = int((time.time() - started) * 1000)

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": isinstance(parsed, dict),
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:800] + ("…[truncated]" if len(raw) > 800 else ""),
                    }
                )

                if not isinstance(parsed, dict):
                    last_err = "OpenAI returned invalid JSON"
                    continue

                ok_model = m
                if debug_raw:
                    trace["raw"] = raw_keep
                    trace["cleaned"] = cleaned
                    trace["ok_model"] = m

                return AiResult(
                    ok=True,
                    data=parsed,
                    error=None,
                    provider="openai",
                    model=ok_model,
                )

            except Exception as e:  # noqa: BLE001
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": False,
                        "duration_ms": dur_ms,
                        "error": last_err,
                    }
                )
                time.sleep(0.3 * attempt)

    msg = f"AI call failed: {last_err or 'unknown error'}"
    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned

    return AiResult(
        ok=False,
        data=None,
        error=AiError(
            code="ai_openai_failed",
            message=msg,
            trace=(trace if debug_raw else None),
        ),
        provider="openai",
        model=(ok_model or (models[0] if models else "unknown")),
    )