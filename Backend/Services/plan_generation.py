<<<<<<< HEAD
# Services/plan_generation.py
=======
>>>>>>> 65b4aa8034d0e42994e31c235ac18bf050c14854
import os, json, re, time, datetime as dt
from typing import Any, Dict, List, Tuple, Optional
from fastapi import HTTPException
from openai import OpenAI
from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S

# ---------- parsing utils ----------
CODEFENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)

def _strip_codefence(s: str) -> str:
    m = CODEFENCE_RE.search(s)
    return m.group(1).strip() if m else s.strip()

def _find_outer_json_block(s: str) -> str:
    start = s.find("{")
    if start < 0: return s
    depth = 0
    for i in range(start, len(s)):
        ch = s[i]
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0: return s[start:i+1]
    end = s.rfind("}")
    return s[start:end+1] if end > start else s

def _sanitize_json_guess(s: str) -> str:
    s = s.replace("“","\"").replace("”","\"").replace("’","'")
    s = _strip_codefence(s)
    s = _find_outer_json_block(s)
    s = re.sub(r",\s*([}\]])", r"\1", s)
    s = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', s)
    s = re.sub(r"\bNaN\b|\bInfinity\b|-Infinity", "null", s)
    return s.strip()

def _parse_ai_json(raw: str) -> Tuple[dict, str]:
    try:
        return json.loads(raw.strip()), raw.strip()
    except Exception:
        cleaned = _sanitize_json_guess(raw or "")
        try:
            return json.loads(cleaned), cleaned
        except Exception as e:
            snippet = cleaned[:400]
            raise ValueError(f"malformed_json_after_sanitize: {e}; snippet={snippet!r}")

<<<<<<< HEAD
# ---------- normalize (len aliasy; bez dopĺňania) ----------
def normalize_plan_json(obj: dict, plan_start_iso: Optional[str] = None) -> dict:
=======
# ----------- minimal normalize (bez dopĺňania) -----------
def normalize_plan_json(obj: dict, plan_start_iso: Optional[str] = None) -> dict:
    """Len premenuj aliasy, nič nevymýšľaj."""
>>>>>>> 65b4aa8034d0e42994e31c235ac18bf050c14854
    if not isinstance(obj, dict):
        raise ValueError("AI output is not a JSON object")
    return {
        "summary": obj.get("summary") or "No summary.",
        "insights": obj.get("insights") or [],
        "red_flags": obj.get("red_flags") or [],
        "week_overview": obj.get("week_overview") or obj.get("outline_10w") or [],
<<<<<<< HEAD
=======
        # preferuj first_10_days; ak AI dá iba next_10_days, prenechaj ho (nič nemaž)
>>>>>>> 65b4aa8034d0e42994e31c235ac18bf050c14854
        "first_10_days": obj.get("first_10_days") or obj.get("next_10_days") or [],
        "next_10_days": obj.get("next_10_days") or None,
        "next_week_plan": obj.get("next_week_plan") if obj.get("next_week_plan") not in ([], {}) else None,
        "_meta": {
            "plan_source": "ai",
            "week_start": plan_start_iso or None,
            "next10_start": plan_start_iso or None,
        },
    }

<<<<<<< HEAD
# ---------- LLM call (STRICT JSON) ----------
=======
# ----------- LLM volanie (STRICT) -----------
>>>>>>> 65b4aa8034d0e42994e31c235ac18bf050c14854
def _llm_models_priority(explicit_model: Optional[str]) -> List[str]:
    env_list = os.getenv("OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini")
    env_models = [m.strip() for m in env_list.split(",") if m.strip()]
    if explicit_model and explicit_model not in env_models:
        return [explicit_model] + env_models
    return env_models if not explicit_model else [explicit_model] + env_models

def _build_prompts(context_payload: dict, schema_text: str):
    system_txt = (
        "You are an endurance coaching assistant. "
<<<<<<< HEAD
        "Return a single valid JSON object matching the schema. "
=======
        "Return a single valid JSON object conforming to the schema. "
>>>>>>> 65b4aa8034d0e42994e31c235ac18bf050c14854
        "No prose, no code fences."
    )
    user_txt = (
        "Context JSON:\n" + json.dumps(context_payload, ensure_ascii=False) +
        "\n\nSchema (instructional):\n" + schema_text +
        "\n\nHard requirements:\n"
<<<<<<< HEAD
        "- Provide `next_10_days` with EXACTLY 10 items.\n"
        "- Each item MUST have `day` (YYYY-MM-DD) and `sessions` (non-empty array).\n"
        "- If the day is rest, include a session object: {\"title\":\"Rest Day\",\"duration_min\":0}.\n"
        "- Never leave `sessions` empty.\n"
        "- `next_week_plan` may be null; still produce valid `next_10_days`.\n"
        "- Output JSON only."
=======
        "- Always include `next_10_days` as an array of exactly 10 objects.\n"
        "- Each item must have `day` (YYYY-MM-DD) and `sessions` (array).\n"
        "- `next_week_plan` may be null; still produce `next_10_days`.\n"
        "- No additional commentary."
>>>>>>> 65b4aa8034d0e42994e31c235ac18bf050c14854
    )
    return system_txt, user_txt

def _call_openai(client: OpenAI, model: str, system_txt: str, user_txt: str, max_tokens: int) -> str:
    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": [
            {"role":"system","content":system_txt},
            {"role":"user","content":user_txt},
        ],
        "temperature": 0.2,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    cc = client.chat.completions.create(**kwargs)
    return (
        getattr(getattr(cc.choices[0], "message", {}), "content", None)
        or getattr(cc.choices[0], "text", None)
        or ""
    ).strip()

def _extract_start_date(ctx: dict) -> Optional[str]:
    sd = ctx.get("plan_start_date") or ctx.get("start_date")
    if isinstance(sd, str) and sd:
        return sd
    g = ctx.get("goal")
    if isinstance(g, dict):
        sd2 = g.get("start_date")
        if isinstance(sd2, str) and sd2:
            return sd2
    return None

def generate_plan_json(context_payload: dict, model: str, *, debug_raw: bool=False, loose: bool=False) -> Tuple[dict, Optional[dict]]:
    # `loose` tu ignorujeme – ideme striktne
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)
    token_budgets = [2200, 1800, 1400]

    schema_text = """
{
  "summary": string,
  "insights": string[],
  "red_flags": { "type": string, "details"?: string, "evidence"?: string }[],
  "week_overview"?: string[],
  "next_week_plan"?: { ... } | null,
  "first_10_days"?: { "day": "YYYY-MM-DD", "sessions": Session[] }[],
<<<<<<< HEAD
  "next_10_days": { "day": "YYYY-MM-DD", "sessions": Session[] }[]  // exactly 10, sessions must be non-empty
=======
  "next_10_days": { "day": "YYYY-MM-DD", "sessions": Session[] }[],  // EXACTLY 10 items
  "_meta"?: any
>>>>>>> 65b4aa8034d0e42994e31c235ac18bf050c14854
}
Where Session = {
  "title": string,
  "duration_min": number,
  "intensity"?: string | null,
  "notes"?: string | null,
  "target_pace_min_per_km"?: string | null,
  "target_hr_bpm_range"?: [number, number] | null,
  "target_power_watts"?: number | null,
  "zone"?: string | null,
  "structure"?: {
    "warmup"?: { "minutes"?: number, "notes"?: string, "target"?: { "hr"?: [number,number], "pace"?: string, "power"?: number } },
    "main"?:   ({ "reps"?: number, "work_min"?: number, "recover_min"?: number, "target"?: { "hr"?: [number,number], "pace"?: string, "power"?: number } }[]),
    "cooldown"?: { "minutes"?: number, "notes"?: string, "target"?: { "hr"?: [number,number], "pace"?: string, "power"?: number } }
  },
  "exercises"?: { "name": string, "sets": number, "reps"?: number, "seconds"?: number, "rest_sec"?: number }[]
}
""".strip()

    system_txt, user_txt = _build_prompts(context_payload, schema_text)
    print(f"[AI] compose prompts | system_len={len(system_txt)} user_len={len(user_txt)}")

    trace = {"system_prompt": system_txt, "user_prompt": user_txt, "models_tried": models, "attempts": []}
    last_err: Optional[str] = None
    last_raw: Optional[str] = None

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt-1, len(token_budgets)-1)]
            print(f"[AI] call start | model={m} attempt={attempt} budget={budget}")
            try:
                raw = _call_openai(client, m, system_txt, user_txt, budget)
                last_raw = raw
                dur_ms = int((time.time() - started) * 1000)
                print(f"[AI] call ok    | model={m} attempt={attempt} dur_ms={dur_ms} raw_len={len(raw)}")
                trace["attempts"].append({
                    "model": m, "attempt": attempt, "tokens_budget": budget,
                    "duration_ms": dur_ms, "ok": True,
                    "raw_preview": (raw[:800] + ("…[truncated]" if len(raw) > 800 else "")),
                })

                parsed_dict, _ = _parse_ai_json(raw) if raw else ({}, "")
                start_date = _extract_start_date(context_payload)
                parsed = normalize_plan_json(parsed_dict, plan_start_iso=start_date)
                if debug_raw:
                    trace["last_raw"] = last_raw
                return parsed, (trace if debug_raw else None)

            except Exception as e:
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{type(e).__name__}: {e}"
                print(f"[AI] call fail  | model={m} attempt={attempt} dur_ms={dur_ms} err={last_err}")
                trace["attempts"].append({
                    "model": m, "attempt": attempt, "tokens_budget": budget,
                    "duration_ms": dur_ms, "ok": False, "error": last_err
                })
                time.sleep(0.6 * attempt)
                continue

    raise HTTPException(status_code=504, detail=f"AI generation failed: {last_err or 'Timeout/error'}")