import os, json, re, time, datetime as dt
from typing import Any, Dict, List, Tuple, Optional
from fastapi import HTTPException
from openai import OpenAI
from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S

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

def _parse_ai_json(raw: str) -> Tuple[Optional[dict], str, str]:
    if not raw:
        return None, "", ""
    try:
        return json.loads(raw.strip()), raw.strip(), raw.strip()
    except Exception:
        cleaned = _sanitize_json_guess(raw)
        try:
            return json.loads(cleaned), cleaned, raw
        except Exception as e:
            return None, cleaned, raw  # ← vrátime aj pokazené JSON

def normalize_plan_json(obj: dict, plan_start_iso: Optional[str] = None) -> dict:
    if not isinstance(obj, dict):
        raise ValueError("AI output is not a JSON object")
    return {
        "summary": obj.get("summary") or "No summary.",
        "insights": obj.get("insights") or [],
        "red_flags": obj.get("red_flags") or [],
        "week_overview": obj.get("week_overview") or obj.get("outline_10w") or [],
        "first_10_days": obj.get("first_10_days") or obj.get("next_10_days") or [],
        "next_10_days": obj.get("next_10_days") or None,
        "next_week_plan": obj.get("next_week_plan") if obj.get("next_week_plan") not in ([], {}) else None,
        "_meta": {
            "plan_source": "ai",
            "week_start": plan_start_iso or None,
            "next10_start": plan_start_iso or None,
        },
    }

def _llm_models_priority(explicit_model: Optional[str]) -> List[str]:
    env_list = os.getenv("OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini")
    env_models = [m.strip() for m in env_list.split(",") if m.strip()]
    if explicit_model and explicit_model not in env_models:
        return [explicit_model] + env_models
    return env_models if not explicit_model else [explicit_model] + env_models

def _build_prompts(context_payload: dict, schema_text: str):
    wu_cd_required = bool(context_payload.get("rules", {}).get("wu_cd_detail", False))
    hard = [
        "Produce `next_10_days` for EXACTLY 10 consecutive dates starting from `plan_start_date`.",
        "Each day MUST include non-empty `sessions`.",
        "If rest: include one session with sport:'other' and duration_min:0.",
        "Include sport for every session.",
        "For RUN sessions you MUST provide target_hr_bpm_range:[low,high].",
        "For STRENGTH sessions include exercises array (3–8 items)."
    ]
    if wu_cd_required:
        hard.append("Include warmup/main/cooldown with HR targets for runs.")

    system_txt = "You are an endurance coach. Return one valid JSON object only."
    user_txt = (
        "Context JSON:\n" + json.dumps(context_payload, ensure_ascii=False) +
        "\n\nSchema (instructional):\n" + schema_text +
        "\n\nHard requirements:\n- " + "\n- ".join(hard)
    )
    return system_txt, user_txt

def _call_openai(client: OpenAI, model: str, system_txt: str, user_txt: str, max_tokens: int) -> str:
    cc = client.chat.completions.create(
        model=model,
        messages=[{"role":"system","content":system_txt},{"role":"user","content":user_txt}],
        temperature=0.2,
        max_tokens=max_tokens,
        response_format={"type":"json_object"},
    )
    return getattr(cc.choices[0].message, "content", "").strip()

def _extract_start_date(ctx: dict) -> Optional[str]:
    sd = ctx.get("plan_start_date") or ctx.get("start_date")
    if isinstance(sd, str): return sd
    g = ctx.get("goal")
    if isinstance(g, dict) and isinstance(g.get("start_date"), str):
        return g["start_date"]
    return None

def generate_plan_json(context_payload: dict, model: str, *, debug_raw: bool=False, loose: bool=False):
    client = OpenAI(api_key=OPENAI_API_KEY)
    models = _llm_models_priority(model)
    schema_text = """{ "summary":string, "insights":string[], "red_flags":[], "next_10_days":[{ "day":"YYYY-MM-DD","sessions":[]}]}"""
    system_txt, user_txt = _build_prompts(context_payload, schema_text)

    trace = {"models_tried": models, "attempts": []}
    last_raw, last_clean, last_err = None, None, None

    for m in models:
        try:
            raw = _call_openai(client, m, system_txt, user_txt, 2000)
            last_raw = raw
            parsed, cleaned, raw2 = _parse_ai_json(raw)
            if not parsed:
                raise ValueError("AI returned invalid JSON")
            start_date = _extract_start_date(context_payload)
            normalized = normalize_plan_json(parsed, start_date)
            trace["ok_model"] = m
            if debug_raw:
                trace["raw"] = raw2
                trace["cleaned"] = cleaned
            return normalized, trace
        except Exception as e:
            last_err = str(e)
            trace["attempts"].append({"model": m, "error": last_err})
            continue

    return {
        "summary": "AI generation failed.",
        "insights": [],
        "red_flags": [{"type": "error", "details": last_err}],
        "next_10_days": [],
        "_meta": {"plan_source": "ai", "ok": False},
    }, {"error": last_err, "raw": last_raw, "cleaned": last_clean, "trace": trace}