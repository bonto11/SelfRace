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

DEBUG = True  # vypni na False, keď to doladíš


def _dbg(*args: Any) -> None:
    if DEBUG:
        print("[CLAUDE DEBUG]", *args)


def _get_client() -> anthropic.Anthropic:
    global _CLIENT
    _dbg("_get_client() called, cached client exists:", _CLIENT is not None)
    _dbg("_get_client() CLAUDE_API_KEY present:", bool(CLAUDE_API_KEY), "len:", len(CLAUDE_API_KEY) if CLAUDE_API_KEY else 0)
    if _CLIENT is None:
        if not CLAUDE_API_KEY:
            _dbg("_get_client() FAIL - missing CLAUDE_API_KEY")
            raise RuntimeError("Missing CLAUDE_API_KEY v Configs.config")
        timeout = float(LLM_TIMEOUT_S or 300.0)
        _dbg("_get_client() creating new anthropic.Anthropic client, timeout=", timeout)
        _CLIENT = anthropic.Anthropic(
            api_key=CLAUDE_API_KEY,
            timeout=timeout,
        )
        _dbg("_get_client() client created OK")
    return _CLIENT


def _models_priority(explicit_model: Optional[str]) -> List[str]:
    _dbg("_models_priority() called with explicit_model=", explicit_model)
    _dbg("_models_priority() CLAUDE_DEFAULT_MODEL=", CLAUDE_DEFAULT_MODEL)
    _dbg("_models_priority() CLAUDE_MODEL_FALLBACKS=", CLAUDE_MODEL_FALLBACKS)

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
        _dbg("_models_priority() no models configured, using hardcoded fallback claude-haiku-4-5")
        unique = ["claude-haiku-4-5"]

    if explicit_model:
        em = explicit_model.strip()
        if em:
            result = [em] + [m for m in unique if m != em]
            _dbg("_models_priority() result (explicit first):", result)
            return result

    _dbg("_models_priority() result:", unique)
    return unique


def _extract_usage(resp: anthropic.types.Message) -> Optional[Dict[str, int]]:
    try:
        u = resp.usage
        prompt = int(getattr(u, "input_tokens", 0) or 0)
        completion = int(getattr(u, "output_tokens", 0) or 0)
        if prompt == 0 and completion == 0:
            return None
        usage = {
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "total_tokens": prompt + completion,
            "reasoning_tokens": 0,
        }
        _dbg("_extract_usage() =", usage)
        return usage
    except Exception as e:
        _dbg("_extract_usage() FAILED:", repr(e))
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
    _dbg("=" * 60)
    _dbg("claude_call_json_model() START")
    _dbg("requested model param:", model)
    _dbg("max_tokens:", max_tokens, "temperature:", temperature)
    _dbg("system_prompt length:", len(system_prompt or ""))
    _dbg("user_instructions length:", len(user_instructions or ""))
    _dbg("context_payload keys:", list(context_payload.keys()) if isinstance(context_payload, dict) else type(context_payload))

    client = _get_client()
    models = _models_priority(model)
    retries = int(LLM_RETRIES or 2)
    _dbg("models chain to try:", models, "| retries per model:", retries)

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
    _dbg("full_user_prompt total length:", len(full_user_prompt))

    last_err: Optional[str] = None

    for m in models:
        _dbg(f"--- trying model={m} ---")
        for attempt in range(1, retries + 1):
            started = time.time()
            _dbg(f"[{m}] attempt {attempt}/{retries} - sending request to Anthropic API...")
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
                _dbg(f"[{m}] attempt {attempt} - RAW response object received, type:", type(resp).__name__)

                # Vytiahneme text z response
                raw = ""
                if resp.content and len(resp.content) > 0:
                    raw = (getattr(resp.content[0], "text", "") or "").strip()

                dur_ms = int((time.time() - started) * 1000)
                finish_reason = str(getattr(resp, "stop_reason", "UNKNOWN"))
                _dbg(f"[{m}] attempt {attempt} - duration_ms={dur_ms} stop_reason={finish_reason} raw_len={len(raw)}")

                if not raw:
                    last_err = f"Claude returned empty text. Stop reason: {finish_reason}"
                    _dbg(f"[{m}] attempt {attempt} - EMPTY TEXT, error:", last_err)
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
                _dbg(f"[{m}] attempt {attempt} - parse_ai_json ok={ok} parsed_keys={list(parsed.keys()) if ok else 'N/A'}")

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

                _dbg(f"[{m}] attempt {attempt} - SUCCESS, returning result")
                _dbg("=" * 60)

                return AiResult(
                    ok=True, data=parsed, error=None,
                    provider="claude", model=m, trace=trace,
                )

            except anthropic.RateLimitError as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"RateLimitError: {e}"
                print(f"[CLAUDE DEV] Rate limit on {m}: {last_err}")
                _dbg(f"[{m}] attempt {attempt} - RateLimitError, skipping to next model")
                trace["attempts"].append({
                    "model": m, "attempt": attempt, "ok": False,
                    "duration_ms": dur_ms, "error": last_err,
                })
                break  # Rate limit = preskoč na ďalší model

            except anthropic.NotFoundError as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"NotFoundError (model neexistuje?): {e}"
                print(f"[CLAUDE DEV] Model not found {m}: {last_err}")
                _dbg(f"[{m}] attempt {attempt} - NotFoundError (model name invalid?), skipping to next model")
                trace["attempts"].append({
                    "model": m, "attempt": attempt, "ok": False,
                    "duration_ms": dur_ms, "error": last_err,
                })
                break  # Neexistujúci model = preskoč ihneď

            except Exception as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                print(f"[CLAUDE DEV] Attempt {attempt} failed on {m}: {last_err}")
                _dbg(f"[{m}] attempt {attempt} - unexpected exception:", repr(e))
                trace["attempts"].append({
                    "model": m, "attempt": attempt, "ok": False,
                    "duration_ms": dur_ms, "error": last_err,
                })
                time.sleep(1.0 * attempt)

    _dbg("ALL MODELS FAILED, last_err:", last_err)
    _dbg("=" * 60)

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
    _dbg("get_claude_models() CALLED")
    result = [
        "claude-haiku-4-5",
        "claude-sonnet-4-6",
        "claude-opus-4-6",
        "claude-opus-4-7",
    ]
    _dbg("get_claude_models() returning:", result)
    return result


def call_claude_vision_json(
    system_prompt: str,
    user_prompt: str,
    *,
    image_base64: str,
    image_media_type: str = "image/jpeg",
    model: Optional[str] = None,
    max_tokens: int = 2000,
) -> AiResult[Dict[str, Any]]:
    """
    Rovnaké ako claude_call_json_model, ale posiela aj obrázok (base64) spolu
    s textovým promptom - pre vision extraction úlohy (napr. čítanie hodnôt
    z fotky InBody/iného body scan reportu). Anthropic API prijíma 'content'
    ako pole blokov namiesto plain stringu, keď je súčasťou obrázok - image
    blok ide pred text blok (odporúčanie Anthropic dokumentácie pre lepšiu
    presnosť). Bez cross-model fallback slučky (na rozdiel od
    claude_call_json_model) - vision extraction je jednorazová akcia
    iniciovaná userom, nie kritická cesta vyžadujúca retry naprieč modelmi.
    """
    _dbg("=" * 60)
    _dbg("call_claude_vision_json() START, image_media_type=", image_media_type, "image_base64_len=", len(image_base64) if image_base64 else 0)

    client = _get_client()
    models = _models_priority(model)
    resolved_model = models[0] if models else "claude-haiku-4-5"
    _dbg("call_claude_vision_json() resolved_model=", resolved_model)

    trace: Dict[str, Any] = {
        "provider": "claude",
        "models_tried": [resolved_model],
        "attempts": [],
        "usage": None,
        "ok_model": None,
    }

    started = time.time()
    try:
        resp = client.messages.create(
            model=resolved_model,
            max_tokens=max_tokens,
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
        _dbg("call_claude_vision_json() response received OK")
    except Exception as e:
        dur_ms = int((time.time() - started) * 1000)
        err = f"{e.__class__.__name__}: {e}"
        _dbg("call_claude_vision_json() FAILED:", err)
        trace["attempts"].append({
            "model": resolved_model, "attempt": 1, "ok": False,
            "duration_ms": dur_ms, "error": err,
        })
        return AiResult(
            ok=False,
            data=None,
            provider="claude",
            model=resolved_model,
            error=AiError(code="ai_claude_vision_failed", message=err),
            trace=trace,
        )

    raw = ""
    if resp.content and len(resp.content) > 0:
        raw = "".join(
            getattr(block, "text", "") for block in resp.content
            if getattr(block, "type", None) == "text"
        ).strip()

    dur_ms = int((time.time() - started) * 1000)
    finish_reason = str(getattr(resp, "stop_reason", "UNKNOWN"))
    _dbg(f"call_claude_vision_json() duration_ms={dur_ms} stop_reason={finish_reason} raw_len={len(raw)}")

    if not raw:
        err = f"Claude returned empty text. Stop reason: {finish_reason}"
        _dbg("call_claude_vision_json() EMPTY TEXT:", err)
        trace["attempts"].append({
            "model": resolved_model, "attempt": 1, "ok": False,
            "duration_ms": dur_ms, "error": err,
        })
        return AiResult(
            ok=False, data=None, provider="claude", model=resolved_model,
            error=AiError(code="ai_claude_vision_empty", message=err), trace=trace,
        )

    parsed, cleaned, raw_keep = parse_ai_json(raw)
    ok = isinstance(parsed, dict)
    _dbg("call_claude_vision_json() parse_ai_json ok=", ok)

    trace["attempts"].append({
        "model": resolved_model,
        "attempt": 1,
        "ok": ok,
        "duration_ms": dur_ms,
        "raw_preview": raw[:600] + ("...[truncated]" if len(raw) > 600 else ""),
    })

    if not ok:
        print("\n" + "=" * 50)
        print(f"[CLAUDE VISION DEV] STOP REASON: {finish_reason}")
        print("[CLAUDE VISION DEV] FULL RAW OUTPUT START:")
        print(raw)
        print("[CLAUDE VISION DEV] FULL RAW OUTPUT END")
        print("=" * 50 + "\n")
        err = f"Invalid JSON. Stop reason: {finish_reason}"
        return AiResult(
            ok=False, data=None, provider="claude", model=resolved_model,
            error=AiError(code="ai_claude_vision_invalid_json", message=err), trace=trace,
        )

    trace["ok_model"] = resolved_model
    u = _extract_usage(resp)
    if u:
        trace["usage"] = u

    _dbg("call_claude_vision_json() SUCCESS")
    _dbg("=" * 60)

    return AiResult(
        ok=True, data=parsed, error=None,
        provider="claude", model=resolved_model, trace=trace,
    )
