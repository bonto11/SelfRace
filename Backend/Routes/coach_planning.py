# Services/plan_generation.py
import json, re
from typing import Any, Dict, List, cast
from fastapi import HTTPException
from openai import OpenAI
from datetime import date, timedelta
from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S  # timeout a kľúč ostávajú


def _monday_of(iso_str: str) -> str:
    """Vráti ISO dátum pondelka týždňa, do ktorého patrí iso_str."""
    d = date.fromisoformat(iso_str)
    monday = d - timedelta(days=d.weekday() % 7)  # 0 = Mon
    return monday.isoformat()


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


def _as_list(obj, key) -> list:
    v = obj.get(key)
    return v if isinstance(v, list) else []


def normalize_plan_json(obj: dict, plan_start_iso: str | None = None) -> dict:
    """
    Normalizuje AI JSON:
    - summary, insights, red_flags
    - week_overview (alias outline_10w)
    - next_10_days (alias first_10_days)
    - next_week_plan (+_meta.week_start & plan_source)
    """
    if not isinstance(obj, dict):
        raise ValueError("AI output is not a JSON object")

    out: Dict[str, Any] = {
        "summary": obj.get("summary") or "No summary.",
        "insights": [],
        "red_flags": _as_list(obj, "red_flags"),
        "week_overview": _as_list(obj, "week_overview") or _as_list(obj, "outline_10w"),
        "next_10_days": _as_list(obj, "next_10_days") or _as_list(obj, "first_10_days"),
        "next_week_plan": obj.get("next_week_plan"),
        "_meta": {"coerced": False, "plan_source": "ai"},
    }

    # insights – podpor aj dict → splošti
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

    # week_start meta (pondelok podľa plan_start_date, ak je k dispozícii)
    if plan_start_iso:
        out["_meta"]["week_start"] = _monday_of(plan_start_iso)

    # next_week_plan – robustná koercia
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
    """
    Vygeneruje:
      - summary, insights, red_flags
      - week_overview: 1–2 vety na každý týždeň od plan_start_date (počet týždňov = ctx.weeks)
      - next_10_days: detailné denné položky od plan_start_date (max 10)
      - next_week_plan: 7-dňový plán (kvôli existujúcemu UI)
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=LLM_TIMEOUT_S)

    # vstupy → defaulty
    start_iso = (context_payload.get("plan_start_date")
                 or (date.today() + timedelta(days=2)).isoformat())
    weeks = int(context_payload.get("weeks") or 6)

    # schéma – rozšírená o week_overview/next_10_days (+ aliasy pre spätnú komp.)
    json_schema_text = """
JSON object with keys:
  summary: string
  insights: string[]
  red_flags: {type:string, details?:string, evidence?:string}[]
  week_overview: {week_index:number, start:string, end:string, focus?:string, summary:string}[]
  next_10_days: (Session | {date?: string, day?: string, sessions?: Session[]})[]
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
  intensity?: "low"|"moderate"|"med-high"|"high"|null, notes?: string|null,
  target_pace_min_per_km?: string|null,
  target_hr_bpm_range?: [number, number]|null,
  target_power_watts?: number|null, zone?: string|null,
  structure?: {
    warmup?:   {minutes?:number, notes?:string, target?:{pace?:string|null, hr?:[number,number]|null, zone?:string|null}},
    main?:     {reps?:number, work_min?:number, recover_min?:number, recovery_mode?:"walk"|"jog"|"stop"|null,
                target?:{pace?:string|null, hr?:[number,number]|null, power?:number|null, zone?:string|null}} | (
                {reps?:number, work_min?:number, recover_min?:number, ...}[] ),
    cooldown?: {minutes?:number, notes?:string}
  },
  exercises?: {name:string, sets?:number, reps?:number, rest_sec?:number, tempo?:string|null, focus?:string|null}[]
}
Constraints:
- Start all schedules exactly at plan_start_date.
- Provide week_overview for all weeks (1–2 sentences per week).
- Provide next_10_days for the first 10 days starting at plan_start_date.
- Respect thresholds/zones, external activities, injuries, intensity model, and strength_settings (location/mode/gear).
- Return ONLY JSON.
- Keep weekly progression ≤10%.
Aliases accepted for backwards-compat:
- outline_10w -> week_overview
- first_10_days -> next_10_days
"""

    system_txt = (
        "You are an endurance coaching assistant. "
        "Using the provided context and preferences, produce a concrete plan starting from plan_start_date. "
        "Return ONLY JSON matching the schema."
    )

    # do promptu explicitne posielame relevantné časti
    user_payload = {
        **context_payload,
        "plan_start_date": start_iso,
        "weeks": weeks,
        "_hint_week_start": _monday_of(start_iso),
        "first_n_days": 10,
    }

    user_txt = "Context JSON:\n" + json.dumps(user_payload, ensure_ascii=False) + "\n\nSchema (instructional):\n" + json_schema_text

    cc = client.chat.completions.create(
        model=model,
        messages=cast(Any, [
            {"role": "system", "content": system_txt},
            {"role": "user", "content": user_txt},
        ]),
        response_format={"type": "json_object"},
        temperature=0.35,
        max_tokens=1600,
    )

    raw = (
        getattr(getattr(cc.choices[0], "message", {}), "content", None)
        or getattr(cc.choices[0], "text", None)
        or ""
    ).strip()
    if not raw:
        raise RuntimeError("empty_response_chat_json_object")

    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = parse_json_lenient(raw)

    normalized = normalize_plan_json(parsed, plan_start_iso=start_iso)
    return normalized