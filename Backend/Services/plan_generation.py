# Services/plan_generation.py
import os
import json
import re
import time
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
  if start < 0:
    return s
  depth = 0
  for i in range(start, len(s)):
    ch = s[i]
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
  s = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', s)  # bad backslashes
  s = re.sub(r"\bNaN\b|\bInfinity\b|-Infinity", "null", s)
  return s.strip()


def _parse_ai_json(raw: str) -> Tuple[Optional[dict], str, str]:
  """
  Return (parsed_dict or None, cleaned_text, raw_text).
  Nikdy neháče – pri chybe sa parsed=None, ale vrátime cleaned aj raw.
  """
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


# ---------- normalize ----------
def normalize_plan_json(obj: dict, plan_start_iso: Optional[str] = None) -> dict:
  if not isinstance(obj, dict):
    # toto je interná chyba, nie AI validácia
    raise ValueError("AI output is not a JSON object")
  return {
    "summary": obj.get("summary") or "No summary.",
    "insights": obj.get("insights") or [],
    "red_flags": obj.get("red_flags") or [],
    "week_overview": obj.get("week_overview") or obj.get("outline_10w") or [],
    # first_10_days necháme len ako alias pre spätnú kompatibilitu
    "first_10_days": obj.get("first_10_days") or obj.get("next_10_days") or [],
    "next_10_days": obj.get("next_10_days") or None,
    "next_week_plan": obj.get("next_week_plan") if obj.get("next_week_plan") not in ([], {}) else None,
    "_meta": {
      "plan_source": "ai",
      "week_start": plan_start_iso or None,
      "next10_start": plan_start_iso or None,
    },
  }


# ---------- LLM call ----------
def _llm_models_priority(explicit_model: Optional[str]) -> List[str]:
  env_list = os.getenv("OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini")
  env_models = [m.strip() for m in env_list.split(",") if m.strip()]
  if explicit_model and explicit_model not in env_models:
    return [explicit_model] + env_models
  return env_models if not explicit_model else [explicit_model] + env_models


def _build_prompts(context_payload: dict, schema_text: str) -> Tuple[str, str]:
  # koľko týždňov rieši plán – použijeme na počet riadkov v week_overview
  weeks = int(context_payload.get("weeks") or 6)

  wu_cd_required = bool(context_payload.get("rules", {}).get("wu_cd_detail", False))
  hard = [
    "Produce `next_10_days` for EXACTLY 10 consecutive dates starting from `plan_start_date`.",
    "Each day MUST include non-empty `sessions`.",
    "If a day is rest: include one session {\"title\":\"Rest Day\",\"sport\":\"other\",\"duration_min\":0}.",
    "Include `sport` for every session (run/ride/strength/other).",
    "For RUN sessions provide `target_hr_bpm_range:[low,high]` (bpm).",
    "Derive HR ranges from thresholds/zones provided in context (do NOT invent physiology).",
    "Pace as string `min/km`; power in watts.",
    "`next_week_plan` is optional and may be null.",
    "Output JSON only.",
    "Strength sessions MUST include `exercises` array (3–8 items). Each exercise: {name, sets, reps OR seconds, rest_sec}. Use only available equipment.",
    # nový blok pre week_overview
    f"Include `week_overview` as an array with EXACTLY {min(weeks, 12)} short items.",
    "Each `week_overview` item must summarize one training week (e.g. 'Week 1: 3 runs, 1 strength, focus on Z2 volume').",
    "Keep every `week_overview` item <= 120 characters and very concise.",
  ]
  if wu_cd_required:
    hard += [
      "For RUN sessions include `structure` with warmup (5–15 min), at least one `main` block, and cooldown (5–10 min).",
      "HR targets can be top-level or inside structure.*.target.hr.",
    ]

  system_txt = "You are an endurance coaching assistant. Return one valid JSON object only. No prose, no code fences."
  user_txt = (
    "Context JSON:\n"
    + json.dumps(context_payload, ensure_ascii=False)
    + "\n\nSchema (instructional):\n"
    + schema_text
    + "\n\nHard requirements (all must be satisfied):\n- "
    + "\n- ".join(hard)
  )
  return system_txt, user_txt


def _call_openai(client: OpenAI, model: str, system_txt: str, user_txt: str, max_tokens: int) -> str:
  kwargs: Dict[str, Any] = {
    "model": model,
    "messages": [
      {"role": "system", "content": system_txt},
      {"role": "user", "content": user_txt},
    ],
    "temperature": 0.2,
    "max_tokens": max_tokens,
    "response_format": {"type": "json_object"},
  }
  cc = client.chat.completions.create(**kwargs)
  return getattr(cc.choices[0].message, "content", "").strip()


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


def generate_plan_json(
  context_payload: dict,
  model: str,
  *,
  debug_raw: bool = False,
  loose: bool = False,  # len kvôli spätnej kompatibilite (ignorované)
) -> Tuple[dict, Optional[dict]]:
  """
  Vždy vráti (parsed_or_fallback, debug_trace). Nikdy neháče HTTPException (okrem chýbajúceho API key).
  Keď AI zlyhá, parsed bude minimálny fallback + debug obsahuje raw/cleaned/trace.
  """
  if not OPENAI_API_KEY:
    raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

  retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
  timeout_s = max(int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25))), 45)

  client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
  models = _llm_models_priority(model)
  token_budgets = [3000, 2500, 2000]

  schema_text = """
{
  "summary": string,
  "insights": string[],
  "red_flags": { "type": string, "details"?: string, "evidence"?: string }[],
  "week_overview"?: string[],
  "next_week_plan"?: { ... } | null,
  "first_10_days"?: { "day": "YYYY-MM-DD", "sessions": Session[] }[],
  "next_10_days": { "day": "YYYY-MM-DD", "sessions": Session[] }[]
}
Where Session = {
  "title": string,
  "sport": "run" | "ride" | "strength" | "other",
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

  trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
  last_raw: Optional[str] = None
  last_cleaned: Optional[str] = None
  last_err: Optional[str] = None

  for m in models:
    for attempt in range(1, retries + 1):
      started = time.time()
      budget = token_budgets[min(attempt - 1, len(token_budgets) - 1)]
      try:
        raw = _call_openai(client, m, system_txt, user_txt, budget)
        dur_ms = int((time.time() - started) * 1000)
        parsed_dict, cleaned, raw_keep = _parse_ai_json(raw)
        last_raw, last_cleaned = raw_keep, cleaned

        trace["attempts"].append({
          "model": m,
          "attempt": attempt,
          "ok": parsed_dict is not None,
          "duration_ms": dur_ms,
          "raw_preview": (raw[:800] + ("…[truncated]" if len(raw) > 800 else "")),
        })

        if not parsed_dict:
          last_err = "AI returned invalid JSON"
          continue

        start_date = _extract_start_date(context_payload)
        parsed = normalize_plan_json(parsed_dict, plan_start_iso=start_date)

        if debug_raw:
          trace["raw"] = raw_keep
          trace["cleaned"] = cleaned
          trace["ok_model"] = m
        return parsed, trace

      except Exception as e:
        dur_ms = int((time.time() - started) * 1000)
        err_name = e.__class__.__name__
        last_err = f"{err_name}: {e}"
        trace["attempts"].append({
          "model": m,
          "attempt": attempt,
          "ok": False,
          "duration_ms": dur_ms,
          "error": last_err,
        })
        time.sleep(0.5 * attempt)
        continue

  # fallback – AI sa nepodarilo
  fallback = {
    "summary": "AI generation failed.",
    "insights": [],
    "red_flags": [{"type": "error", "details": last_err or "unknown"}],
    "week_overview": [],
    "first_10_days": [],
    "next_10_days": [],
    "next_week_plan": None,
    "_meta": {"plan_source": "ai", "ok": False},
  }
  if debug_raw:
    trace["raw"] = last_raw
    trace["cleaned"] = last_cleaned
  return fallback, trace