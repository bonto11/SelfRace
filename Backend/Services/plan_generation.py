# Services/plan_generation.py
import json, re
from typing import Any, Dict, List, Tuple, cast
from fastapi import HTTPException
from openai import OpenAI
from datetime import date, timedelta
from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S  # timeout a kľúč ostávajú

CODEFENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)

def _strip_codefence(s: str) -> str:
    m = CODEFENCE_RE.search(s)
    return m.group(1).strip() if m else s.strip()

def _find_outer_json_block(s: str) -> str:
    """Nájde prvý vyvážený JSON objekt {...} aj keď je okolo text."""
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
                return s[start:i+1]
    # nenašlo sa uzavretie – skús poslednú zátvorku
    end = s.rfind("}")
    return s[start:end+1] if end > start else s

def _sanitize_json_guess(s: str) -> str:
    """
    Opraví najčastejšie chyby:
    - smart quotes -> standard "
    - trailing commas pred ] a }
    - neescapované spätné lomky
    - NaN/Infinity -> null
    """
    # smart quotes
    s = s.replace("“", "\"").replace("”", "\"").replace("’", "'")
    # vyrež JSON blok a odstripuj codefence
    s = _strip_codefence(s)
    s = _find_outer_json_block(s)
    # trailing commas
    s = re.sub(r",\s*([}\]])", r"\1", s)
    # neplatné unescaped backslashes
    s = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', s)
    # NaN/Infinity
    s = re.sub(r"\bNaN\b|\bInfinity\b|-Infinity", "null", s)
    return s.strip()

def _parse_ai_json(raw: str) -> Tuple[dict, str]:
    """
    Vráti (parsed, cleaned_text). Ak sa nedá parse-nuť, vyhodí ValueError s krátkym snippetom.
    """
    txt = (raw or "").strip()
    # 1) rýchly happy-path
    try:
        return json.loads(txt), txt
    except Exception:
        pass
    # 2) sanitize
    cleaned = _sanitize_json_guess(txt)
    try:
        return json.loads(cleaned), cleaned
    except Exception as e:
        snippet = cleaned[:400]
        raise ValueError(f"malformed_json_after_sanitize: {e}; snippet={snippet!r}")


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
  structure?: {
    warmup?: { minutes:number, notes?:string, target?:{ pace?:string|null, hr?:[number,number]|null, zone?:string|null } },
    main?: { reps:number, work_min:number, recover_min:number,
             recovery_mode?:"walk"|"jog"|"stop"|null,
             target?:{ pace?:string|null, hr?:[number,number]|null, power?:number|null, zone?:string|null } }[],
    cooldown?: { minutes:number, notes?:string }
  },
  exercises?: {name:string, sets:number, reps:number, rest_sec?:number, tempo?:string|null, focus?:string|null}[]
}
Hard constraints:
- Return ONLY a single JSON object. No prose, no code fences.
- Ensure valid JSON (no trailing commas, no comments).
- If content might be long, ALWAYS include both 'outline_10w' and 'first_10_days'; you may shorten wording, but keep valid JSON.
- 'structure.main' MUST be an array (even for 1 block).
- Prefer concise strings.
"""

    system_txt = (
        "You are an endurance coaching assistant. "
        "Always return a single valid JSON object matching the schema. No markdown/code fences."
    )
    user_txt = "Context JSON:\n" + json.dumps(context_payload, ensure_ascii=False) + "\n\nSchema (instructional):\n" + json_schema_text

    cc = client.chat.completions.create(
        model=model,
        messages=cast(Any, [
            {"role": "system", "content": system_txt},
            {"role": "user", "content": user_txt},
        ]),
        response_format={"type": "json_object"},
        temperature=0.2,
        max_tokens=1800,  # trocha viac priestoru kvôli outline + 10 dní
    )

    raw = (getattr(getattr(cc.choices[0], "message", {}), "content", None)
           or getattr(cc.choices[0], "text", None) or "").strip()
    if not raw:
        raise RuntimeError("empty_response_chat_json_object")

    try:
        parsed, cleaned = _parse_ai_json(raw)
    except ValueError as e:
        # vyhoď čitateľnú chybu – FE ju ukáže
        raise HTTPException(status_code=500, detail=f"AI generation failed: {e}")

    return normalize_plan_json(parsed)
