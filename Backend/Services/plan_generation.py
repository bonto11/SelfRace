# Services/plan_generation.py
import json, re
from typing import Any, Dict, List, cast
from fastapi import HTTPException
from openai import OpenAI
from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S  # timeout a kľúč ostávajú

def parse_json_lenient(text: str) -> dict:
    t = (text or "").strip()
    try:
        return json.loads(t)
    except Exception:
        pass
    start, end = t.find("{"), t.rfind("}")
    candidate = t[start:end + 1] if start != -1 and end != -1 and end > start else t
    safe = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', candidate)
    return json.loads(safe)

def normalize_plan_json(obj: dict) -> dict:
    if not isinstance(obj, dict):
        raise ValueError("AI output is not a JSON object")
    out: Dict[str, Any] = {
        "summary": obj.get("summary") or "No summary.",
        "insights": [],
        "red_flags": obj.get("red_flags") if isinstance(obj.get("red_flags"), list) else [],
        "next_week_plan": obj.get("next_week_plan"),
        "_meta": {"coerced": False, "plan_source": "ai"},
    }
    ins = obj.get("insights")
    if isinstance(ins, list):
        out["insights"] = [str(x) for x in ins]
    elif isinstance(ins, dict):
        bullets: List[str] = []
        def flat(p: str, v: Any):
            if isinstance(v, dict):
                for k, vv in v.items():
                    flat(f"{p}{k}:", vv)
            elif isinstance(v, list):
                for it in v:
                    flat(p, it)
            else:
                s = f"{p} {v}".strip()
                if s:
                    bullets.append(s)
        flat("", ins)
        out["insights"] = [b.replace("  ", " ").strip(" :") for b in bullets if b]

    nwp = obj.get("next_week_plan")
    if isinstance(nwp, list) and all(isinstance(x, str) for x in nwp):
        out["_meta"]["coerced"] = True
        out["_meta"]["plan_source"] = "coerced_from_guidelines"
        out["next_week_plan"] = None
        out["_guidelines"] = nwp
    elif isinstance(nwp, dict):
        out["next_week_plan"] = nwp
    else:
        out["_meta"]["coerced"] = True
        out["_meta"]["plan_source"] = "coerced_empty"
        out["next_week_plan"] = None
    return out

def ensure_minimum_week_plan(parsed: dict, context_in: dict, build_min_plan_fn) -> dict:
    if not isinstance(parsed, dict):
        raise ValueError("AI output not a dict")
    plan = parsed.get("next_week_plan")
    has_any = False
    if isinstance(plan, dict):
        for k in ("run", "ride", "strength"):
            s = plan.get(k)
            if s and isinstance(s, dict) and isinstance(s.get("sessions"), list) and s["sessions"]:
                has_any = True
                break
        if not has_any and any(
            d in plan for d in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
        ):
            has_any = True
    if not plan or not has_any:
        parsed.setdefault("summary", "Auto-filled plan based on recent context (guidelines detected).")
        parsed["next_week_plan"] = build_min_plan_fn(context_in)
        meta = parsed.setdefault("_meta", {})
        meta["plan_source"] = "coerced_from_guidelines" if meta.get("plan_source") == "coerced_from_guidelines" else "fallback_min"
    else:
        parsed.setdefault("_meta", {})["plan_source"] = parsed.get("_meta", {}).get("plan_source", "ai")
    return parsed

def generate_plan_json(context_payload: dict, model: str) -> dict:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")
    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=LLM_TIMEOUT_S)

    json_schema_text = """
JSON object with keys:
  summary: string
  insights: string[]
  red_flags: {type:string, details?:string, evidence?:string}[]
  outline_10w?: string[]
  first_10_days?: (Session | {day?: string, sessions?: Session[]})[]
  next_week_plan: {
    focus: "base" | "build" | "recovery",
    monday?: Session|Session[], tuesday?: Session|Session[], wednesday?: Session|Session[],
    thursday?: Session|Session[], friday?: Session|Session[], saturday?: Session|Session[], sunday?: Session|Session[],
    rest_days?: string[],
    run?: { weekly_km_target?: number|null, sessions?: Session[] },
    ride?: { weekly_time_target_min?: number|null, sessions?: Session[] },
    strength?: { sessions?: Session[] }
  }
where Session = {
  title: string, duration_min: number,
  intensity?: string|null, notes?: string|null,
  target_pace_min_per_km?: string|null,
  target_hr_bpm_range?: [number, number]|null,
  target_power_watts?: number|null, zone?: string|null,
  structure?: { warmup?: {minutes:number, notes?:string, target?:{pace?:string|null, hr?:[number,number]|null, zone?:string|null}},
                main?: {reps:number, work_min:number, recover_min:number, recovery_mode?:"walk"|"jog"|"stop"|null, target?:{pace?:string|null, hr?:[number,number]|null, power?:number|null, zone?:string|null}}[],
                cooldown?: {minutes:number, notes?:string} },
  exercises?: {name:string, sets:number, reps:number, rest_sec?:number, tempo?:string|null, focus?:string|null}[]
}
Constraints:
- Return ONLY JSON.
- Respect persona (voice/tone) if provided; concise, never toxic.
- Use thresholds/zones when present.
- Keep weekly progression ≤10%.
"""
    system_txt = "You are an endurance coaching assistant. Use the provided context to produce a concrete 7-day plan. Return ONLY JSON."
    user_txt = "Context JSON:\n" + json.dumps(context_payload, ensure_ascii=False) + "\n\nSchema (instructional):\n" + json_schema_text

    cc = client.chat.completions.create(
        model=model,
        messages=cast(Any, [{"role": "system", "content": system_txt}, {"role": "user", "content": user_txt}]),
        response_format={"type": "json_object"},
        temperature=0.35,
        max_tokens=1200,
    )
    raw = (getattr(getattr(cc.choices[0], "message", {}), "content", None) or getattr(cc.choices[0], "text", None) or "").strip()
    if not raw:
        raise RuntimeError("empty_response_chat_json_object")
    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = parse_json_lenient(raw)
    return normalize_plan_json(parsed)