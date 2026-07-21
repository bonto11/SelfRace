# Services/AI/provider/claude_client.py
from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional

import anthropic

from Configs.config import (
    CLAUDE_API_KEY,
    LLM_RETRIES,
    CLAUDE_DEFAULT_MODEL,
    CLAUDE_MODEL_FALLBACKS,
    LLM_TIMEOUT_S,
)
from Services.AI.utils.types import AiResult, AiError
from Services.AI.utils.json_parse import parse_ai_json

_CLIENT: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _CLIENT
    if _CLIENT is None:
        if not CLAUDE_API_KEY:
            raise RuntimeError("Missing CLAUDE_API_KEY v Configs.config")
        timeout = float(LLM_TIMEOUT_S or 300.0)
        _CLIENT = anthropic.Anthropic(
            api_key=CLAUDE_API_KEY,
            timeout=timeout,
        )
    return _CLIENT


def _models_priority(explicit_model: Optional[str]) -> List[str]:
    base: List[str] = []
    if CLAUDE_DEFAULT_MODEL:
        base.append(CLAUDE_DEFAULT_MODEL.strip())
    if isinstance(CLAUDE_MODEL_FALLBACKS, list):
        base.extend([m.strip() for m in CLAUDE_MODEL_FALLBACKS if m])

    unique: List[str] = []
    for m in base:
        if m and m not in unique:
            unique.append(m)

    if not unique:
        unique = ["claude-haiku-4-5"]

    if explicit_model:
        em = explicit_model.strip()
        if em:
            return [em] + [m for m in unique if m != em]
    return unique


def _extract_usage(resp: anthropic.types.Message) -> Optional[Dict[str, int]]:
    try:
        u = resp.usage
        prompt = int(getattr(u, "input_tokens", 0) or 0)
        completion = int(getattr(u, "output_tokens", 0) or 0)
        if prompt == 0 and completion == 0:
            return None
        return {
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "total_tokens": prompt + completion,
            "reasoning_tokens": 0,
        }
    except Exception:
        return None


def claude_call_json_model(
    *,
    context_payload: Dict[str, Any],
    system_prompt: str,
    user_instructions: str,
    model: Optional[str] = None,
    max_tokens: int = 4000,
    temperature: float = 0.2,
) -> AiResult[Dict[str, Any]]:
    client = _get_client()
    models = _models_priority(model)
    retries = int(LLM_RETRIES or 2)

    trace: Dict[str, Any] = {
        "provider": "claude",
        "models_tried": models,
        "attempts": [],
        "usage": None,
        "ok_model": None,
    }

    ctx_json = json.dumps(context_payload, ensure_ascii=False)
    full_user_prompt = (
        f"USER TASK:\n{user_instructions}\n\n"
        f"CONTEXT DATA (JSON):\n{ctx_json}"
    )

    last_err: Optional[str] = None

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            try:
                resp = client.messages.create(
                    model=m,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": full_user_prompt}
                    ],
                )

                # Vytiahneme text z response
                raw = ""
                if resp.content and len(resp.content) > 0:
                    raw = (getattr(resp.content[0], "text", "") or "").strip()

                dur_ms = int((time.time() - started) * 1000)
                finish_reason = str(getattr(resp, "stop_reason", "UNKNOWN"))

                if not raw:
                    last_err = f"Claude returned empty text. Stop reason: {finish_reason}"
                    trace["attempts"].append({
                        "model": m, "attempt": attempt, "ok": False,
                        "duration_ms": dur_ms, "error": last_err,
                    })
                    continue

                # Očistenie markdown blokov (rovnaká logika ako u teba)
                b_ticks = chr(96) * 3
                if raw.startswith(b_ticks):
                    raw = raw.replace(b_ticks + "json", "").replace(b_ticks, "").strip()

                start_idx = raw.find('{')
                end_idx = raw.rfind('}')
                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                    raw = raw[start_idx:end_idx + 1]

                parsed, cleaned, raw_keep = parse_ai_json(raw)
                ok = isinstance(parsed, dict)

                trace["attempts"].append({
                    "model": m,
                    "attempt": attempt,
                    "ok": ok,
                    "duration_ms": dur_ms,
                    "raw_preview": raw[:600] + ("...[truncated]" if len(raw) > 600 else ""),
                })

                if not ok:
                    print("\n" + "=" * 50)
                    print(f"[CLAUDE DEV] STOP REASON: {finish_reason}")
                    print("[CLAUDE DEV] FULL RAW OUTPUT START:")
                    print(raw)
                    print("[CLAUDE DEV] FULL RAW OUTPUT END")
                    print("=" * 50 + "\n")
                    last_err = f"Invalid JSON. Stop reason: {finish_reason}"
                    continue

                trace["ok_model"] = m
                u = _extract_usage(resp)
                if u:
                    trace["usage"] = u

                return AiResult(
                    ok=True, data=parsed, error=None,
                    provider="claude", model=m, trace=trace,
                )

            except anthropic.RateLimitError as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"RateLimitError: {e}"
                print(f"[CLAUDE DEV] Rate limit on {m}: {last_err}")
                trace["attempts"].append({
                    "model": m, "attempt": attempt, "ok": False,
                    "duration_ms": dur_ms, "error": last_err,
                })
                break  # Rate limit = preskoč na ďalší model

            except anthropic.NotFoundError as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"NotFoundError (model neexistuje?): {e}"
                print(f"[CLAUDE DEV] Model not found {m}: {last_err}")
                trace["attempts"].append({
                    "model": m, "attempt": attempt, "ok": False,
                    "duration_ms": dur_ms, "error": last_err,
                })
                break  # Neexistujúci model = preskoč ihneď

            except Exception as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                print(f"[CLAUDE DEV] Attempt {attempt} failed on {m}: {last_err}")
                trace["attempts"].append({
                    "model": m, "attempt": attempt, "ok": False,
                    "duration_ms": dur_ms, "error": last_err,
                })
                time.sleep(1.0 * attempt)

    return AiResult(
        ok=False,
        data=None,
        provider="claude",
        model=(models[0] if models else "unknown"),
        error=AiError(
            code="ai_claude_failed",
            message=(last_err or "All Claude models failed."),
        ),
        trace=trace,
    )


def get_claude_models() -> List[str]:
    """Vráti zoznam aktuálnych Claude modelov (statický zoznam, API na listing neexistuje)."""
    return [
        "claude-haiku-4-5",
        "claude-sonnet-4-6",
        "claude-opus-4-6",
        "claude-opus-4-7",
    ]
    
def call_claude_vision_json(
    system_prompt: str,
    user_prompt: str,
    *,
    image_base64: str,
    image_media_type: str = "image/jpeg",
    model: Optional[str] = None,
    max_completion_tokens: int = 2000,
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    """
    Rovnaké ako call_claude_json, ale posiela aj obrázok (base64) spolu
    s textovým promptom - pre vision extraction úlohy (napr. čítanie
    hodnôt z fotky InBody/iného body scan reportu). Anthropic API prijíma
    'content' ako pole blokov namiesto plain stringu, keď je súčasťou
    obrázok - image blok ide pred text blok (odporúčanie Anthropic
    dokumentácie pre lepšiu presnosť).

    Vracia rovnaký (data, trace, error_message) tvar ako call_claude_json.
    """
    resolved_model = model or CLAUDE_MODEL_DEFAULT
    trace: Dict[str, Any] = {
        "provider": "claude",
        "model_requested": resolved_model,
        "attempts_raw": [],
    }

    try:
        message = _client.messages.create(
            model=resolved_model,
            max_tokens=max_completion_tokens,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": image_media_type,
                                "data": image_base64,
                            },
                        },
                        {"type": "text", "text": user_prompt},
                    ],
                }
            ],
        )
    except Exception as e:
        trace["attempts_raw"].append({"error": str(e)})
        trace["ok_provider"] = "claude"
        trace["ok_model"] = resolved_model
        return None, trace, f"Claude vision request failed: {e}"

    raw_text = "".join(
        block.text for block in message.content if getattr(block, "type", None) == "text"
    )
    trace["attempts_raw"].append({"raw_text": raw_text})

    usage = getattr(message, "usage", None)
    if usage is not None:
        trace["input_tokens"] = getattr(usage, "input_tokens", None)
        trace["output_tokens"] = getattr(usage, "output_tokens", None)

    trace["ok_provider"] = "claude"
    trace["ok_model"] = resolved_model

    parsed = _extract_json_object(raw_text)
    if parsed is None:
        return None, trace, "Claude vision response was not valid JSON."

    return parsed, trace, None
