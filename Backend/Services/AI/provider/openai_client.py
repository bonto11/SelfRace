# Services/AI/provider/openai_client.py
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
from Services.AI.utils.types import AiResult, AiError
from Services.AI.utils.json_parse import parse_ai_json


def _uniq_keep_order(items: List[str]) -> List[str]:
    out: List[str] = []
    for x in items:
        x = (x or "").strip()
        if x and x not in out:
            out.append(x)
    return out


def _models_priority(explicit_model: Optional[str]) -> List[str]:
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


def openai_call_json_model(
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    model: Optional[str] = None,
    max_tokens: int = 2000,
    temperature: float = 0.2,
) -> AiResult[Dict[str, Any]]:
    if not OPENAI_API_KEY:
        return AiResult(
            ok=False,
            data=None,
            error=AiError(code="ai_missing_key", message="Missing OPENAI_API_KEY"),
            provider="openai",
            model=model or "unknown",
            trace={
                "provider": "openai",
                "models_tried": _models_priority(model),
                "attempts": [],
                "usage": None,
                "ok_model": None,
            },
        )

    timeout_s = int(LLM_TIMEOUT_S or 30)
    retries = int(LLM_RETRIES or 2)
    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)

    models = _models_priority(model)
    trace: Dict[str, Any] = {
        "provider": "openai",
        "models_tried": models,
        "attempts": [],
        "usage": None,
        "ok_model": None,
    }

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    user_txt = (
        user_instructions.rstrip()
        + "\n\n---\nContext JSON (ground truth):\n"
        + ctx_json
    )

    last_err: Optional[str] = None

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                resp = client.chat.completions.create(
                    model=m,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_txt},
                    ],
                    temperature=float(temperature),
                    max_tokens=int(max_tokens),
                    response_format={"type": "json_object"},
                )

                raw = (resp.choices[0].message.content or "").strip()
                dur_ms = int((time.time() - started) * 1000)

                parsed, cleaned, raw_keep = parse_ai_json(raw)

                ok = isinstance(parsed, dict)
                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": ok,
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:600]
                        + ("…[truncated]" if len(raw) > 600 else ""),
                    }
                )

                if not ok:
                    last_err = "OpenAI returned invalid JSON"
                    continue

                # ✅ usage tokeny
                usage_obj = getattr(resp, "usage", None)
                if usage_obj is not None:
                    trace["usage"] = {
                        "prompt_tokens": int(
                            getattr(usage_obj, "prompt_tokens", 0) or 0
                        ),
                        "completion_tokens": int(
                            getattr(usage_obj, "completion_tokens", 0) or 0
                        ),
                        "total_tokens": int(getattr(usage_obj, "total_tokens", 0) or 0),
                        "reasoning_tokens": 0,
                    }

                trace["ok_model"] = m

                return AiResult(
                    ok=True,
                    data=parsed,
                    error=None,
                    provider="openai",
                    model=m,
                    trace=trace,
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
    return AiResult(
        ok=False,
        data=None,
        error=AiError(code="ai_openai_failed", message=msg),
        provider="openai",
        model=(models[0] if models else "unknown"),
        trace=trace,
    )

def get_openai_models() -> List[str]:
    """Vráti zoznam dostupných OpenAI modelov."""
    if not OPENAI_API_KEY:
        raise ValueError("Chýba OPENAI_API_KEY")
    
    timeout_s = int(LLM_TIMEOUT_S or 30)
    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    
    models = client.models.list()
    # Vyfiltrujeme len textové modely a zoradíme ich
    return sorted([m.id for m in models.data if "gpt" in m.id or "o1" in m.id or "o3" in m.id])