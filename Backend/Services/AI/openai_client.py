# Services/AI/clients/openai_client.py
from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from openai import OpenAI

from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S
from Services.AI.types import AiResult, AiError

_CODEFENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _strip_codefence(s: str) -> str:
    m = _CODEFENCE_RE.search(s)
    return m.group(1).strip() if m else s.strip()


def _find_outer_json_block(s: str) -> str:
    start = s.find("{")
    if start < 0:
        return s
    depth = 0
    for i, ch in enumerate(s[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1]
    end = s.rfind("}")
    return s[start : end + 1] if end > start else s


def _sanitize_json_guess(s: str) -> str:
    s = s.replace("“", '"').replace("”", '"').replace("’", "'")
    s = _strip_codefence(s)
    s = _find_outer_json_block(s)
    s = re.sub(r",\s*([}\]])", r"\1", s)  # trailing commas
    s = re.sub(r'\\(?!["\\/bfnrtu])', r"\\\\", s)  # lone backslashes
    s = re.sub(r"\bNaN\b|\bInfinity\b|-Infinity", "null", s)
    return s.strip()


def parse_ai_json(raw: str) -> Tuple[Optional[dict], str, str]:
    if not raw:
        return None, "", ""
    try:
        return json.loads(raw.strip()), raw.strip(), raw.strip()
    except Exception:
        cleaned = _sanitize_json_guess(raw or "")
        try:
            return json.loads(cleaned), cleaned, raw
        except Exception:
            return None, cleaned, raw


def _llm_models_priority(explicit_model: Optional[str]) -> List[str]:
    env_list = os.getenv("OPENAI_MODEL_FALLBACKS", "gpt-4.1-mini,gpt-4o-mini")
    env_models = [m.strip() for m in env_list.split(",") if m.strip()]

    base = env_models or ["gpt-4.1-mini", "gpt-4o-mini"]
    if explicit_model and explicit_model not in base:
        return [explicit_model] + base
    if explicit_model:
        return [explicit_model] + [m for m in base if m != explicit_model]
    return base


def _call_openai_once(
    *,
    client: OpenAI,
    model: str,
    system_txt: str,
    user_txt: str,
    max_tokens: int,
    temperature: float = 0.2,
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
    """
    Provider-friendly verzia tvojho call_json_model:
      - neháže HTTPException
      - vracia AiResult[dict]
    """
    if not OPENAI_API_KEY:
        return AiResult(
            ok=False,
            error=AiError(code="ai_missing_key", message="Missing OPENAI_API_KEY"),
            provider="openai",
            model=model or "unknown",
        )

    timeout_s = int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 30)) or "30")
    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)

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
                        "ok": parsed is not None,
                        "duration_ms": dur_ms,
                        "raw_preview": raw[:800] + ("…[truncated]" if len(raw) > 800 else ""),
                    }
                )

                if parsed is None or not isinstance(parsed, dict):
                    last_err = "AI returned invalid JSON"
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

    detail = f"AI call failed: {last_err or 'unknown error'}"
    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned

    return AiResult(
        ok=False,
        data=None,
        error=AiError(code="ai_openai_failed", message=detail, trace=(trace if debug_raw else None)),
        provider="openai",
        model=(ok_model or (models[0] if models else "unknown")),
    )