# Services/plan_generation.py

import json, re, datetime as dt
from typing import Any, Dict, List, Tuple, Optional, cast
from fastapi import HTTPException
from openai import OpenAI
from datetime import date, timedelta
from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S

CODEFENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)

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
    s = re.sub(r",\s*([}\]])", r"\1", s)                  # trailing commas
    s = re.sub(r'\\(?!["\\/bfnrtu])', r'\\\\', s)         # bad backslashes
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

def _iso(d: dt.date) -> str:
    return d.isoformat()

def _parse_date(s: Optional[str]) -> Optional[dt.date]:
    if not s: return None
    try:
        y,m,d = map(int, s.split("-"))
        return dt.date(y,m,d)
    except Exception:
        return None

def _coerce_run_structure(sess: Dict[str,Any]) -> None:
    """Ak run nemá detail, doplň WU/Main/CD rozumne podľa duration."""
    if sess.get("title","").lower().find("run") == -1:
        return
    if isinstance(sess.get("structure"), dict) and sess["structure"].get("main"):
        return
    dur = int(sess.get("duration_min") or 0)
    wu  = min(10, max(5, round(dur*0.15))) if dur >= 20 else 5
    cd  = min(10, max(5, round(dur*0.1)))  if dur >= 20 else 5
    main = max(10, dur - (wu+cd)) if dur else 20
    sess.setdefault("structure", {})
    sess["structure"]["warmup"]   = {"minutes": wu, "notes":"Easy jog", "target":{"hr":[120,140]}}
    sess["structure"]["main"]     = [{"reps":1, "work_min": main, "recover_min":0,
                                      "target":{"pace": sess.get("target_pace_min_per_km") or None,
                                                "hr": [145,165]}}]
    sess["structure"]["cooldown"] = {"minutes": cd, "notes":"Easy walk or jog"}

def _coerce_strength_exercises(sess: Dict[str,Any], gear: List[str]) -> None:
    """Ak chýbajú cviky, doplň základ podľa dostupnej výbavy. Plank = seconds."""
    title = (sess.get("title") or "").lower()
    if "strength" not in title:
        return
    if sess.get("exercises"):
        # oprav plank reps -> seconds
        xs = []
        for e in sess["exercises"]:
            en = (e.get("name") or "").lower()
            if "plank" in en:
                sec = e.get("seconds") or e.get("reps") or 30
                xs.append({"name": e.get("name","Plank"), "sets": e.get("sets",3), "reps": None, "seconds": int(sec), "rest_sec": e.get("rest_sec",30)})
            else:
                xs.append({"name": e.get("name","Exercise"), "sets": e.get("sets",3), "reps": e.get("reps",10), "rest_sec": e.get("rest_sec",60)})
        sess["exercises"] = xs
        return
    # fallback podľa gear
    bank_minimal = [
        {"name":"Goblet Squat" if "dumbbells" in gear or "kettlebell" in gear else "Air Squat", "sets":3, "reps":12, "rest_sec":60},
        {"name":"Push-up", "sets":3, "reps":10, "rest_sec":60},
        {"name":"Bent-over Row (band/TRX/pull-up)" if any(g in gear for g in ["trx","resistance_bands","pullup_bar"]) else "Door-row (towel)", "sets":3, "reps":12, "rest_sec":60},
        {"name":"Plank", "sets":3, "seconds":30, "rest_sec":30},
        {"name":"Lunge", "sets":3, "reps":10, "rest_sec":45},
    ]
    sess["exercises"] = bank_minimal

def _coerce_next_10_days(parsed: Dict[str,Any], start_date_str: Optional[str], strength_gear: List[str]) -> None:
    """Zabezpeč presne 10 dní od start_date; doplň štruktúru behu a cviky s plank seconds."""
    if not start_date_str:
        return
    start = _parse_date(start_date_str)
    if not start:
        return
    want_dates = [_iso(start + dt.timedelta(days=i)) for i in range(10)]

    got = parsed.get("first_10_days") or parsed.get("next_10_days")
    # normalizuj na [{day, sessions:[...]}]
    norm: Dict[str, Dict[str,Any]] = {}
    if isinstance(got, list):
        for entry in got:
            if isinstance(entry, dict):
                day = entry.get("day") or entry.get("date")
                ses = entry.get("sessions") or ([entry] if entry.get("title") else [])
                if isinstance(ses, dict): ses = [ses]
                if isinstance(ses, list):
                    norm[str(day)] = {"day": str(day), "sessions": [s for s in ses if isinstance(s, dict)]}

    out_list: List[Dict[str,Any]] = []
    for i, d in enumerate(want_dates):
        cur = norm.get(d)
        if not cur:
            # ak nič, daj jednoduchý deň (rest v strede týždňa)
            sess = {"title": "Rest Day" if i in (2,5) else "Easy Run", "duration_min": 0 if i in (2,5) else 30, "intensity": "easy" if i not in (2,5) else None}
            if sess["title"].lower().find("run") != -1:
                _coerce_run_structure(sess)
            elif "strength" in (sess["title"] or "").lower():
                _coerce_strength_exercises(sess, strength_gear)
            out_list.append({"day": d, "sessions":[sess]})
        else:
            # doplň detaily
            for s in cur["sessions"]:
                _coerce_run_structure(s)
                _coerce_strength_exercises(s, strength_gear)
            out_list.append({"day": d, "sessions": cur["sessions"]})

    # zapíš ako first_10_days (preferovaný kľúč)
    parsed["first_10_days"] = out_list
    parsed["_meta"] = {**parsed.get("_meta", {}), "next10_start": start_date_str}

def generate_plan_json(context_payload: dict, model: str) -> dict:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")
    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=LLM_TIMEOUT_S)

    json_schema_text = """
JSON object with keys:
  summary: string
  insights: string[]
  red_flags: {type:string, details?:string, evidence?:string}[]
  week_overview?: string[]             # short 10-week preview (1 line per week)
  first_10_days?: { day: string(YYYY-MM-DD), sessions: Session[] }[]
  next_week_plan: { ... }              # 7-day plan (Mon-Sun), same Session schema
where Session = {
  title: string,
  duration_min: number,                # total block duration
  intensity?: "easy"|"moderate"|"hard"|string|null,
  notes?: string|null,
  target_pace_min_per_km?: string|null,
  target_hr_bpm_range?: [number, number]|null,
  target_power_watts?: number|null, zone?: string|null,
  structure?: {
    warmup?:  { minutes:number, notes?:string, target?:{ pace?:string|null, hr?:[number,number]|null, zone?:string|null } },
    main?:    { reps:number, work_min:number, recover_min:number, recovery_mode?:"walk"|"jog"|"stop"|null,
                target?:{ pace?:string|null, hr?:[number,number]|null, power?:number|null, zone?:string|null } }[],
    cooldown?:{ minutes:number, notes?:string }
  },
  # strength details – MUST include exercises; plank = seconds (not reps)
  exercises?: { name:string, sets:number, reps?:number, seconds?:number, rest_sec?:number, tempo?:string|null, focus?:string|null }[]
}
Hard constraints:
- Return ONLY a single valid JSON object (no markdown, no code fences).
- 'first_10_days' MUST contain exactly 10 entries starting from goal.start_date (YYYY-MM-DD).
- Every running session must include 'structure' with warmup/main(array)/cooldown; long run still needs WU and CD.
- Every strength session must include 'exercises' (with sets/reps or seconds and rest_sec). For any plank, use 'seconds' instead of 'reps'.
- Keep strings concise. No comments. No trailing commas.
"""

    system_txt = (
        "You are an endurance coaching assistant. "
        "Always return a single valid JSON object matching the schema. No prose. No code fences."
    )
    user_txt = "Context JSON:\n" + json.dumps(context_payload, ensure_ascii=False) + "\n\nSchema (instructional):\n" + json_schema_text

    cc = client.chat.completions.create(
        model=model,
        messages=cast(Any, [{"role": "system", "content": system_txt},
                            {"role": "user",   "content": user_txt}]),
        response_format={"type": "json_object"},
        temperature=0.25,
        max_tokens=2200,
    )
    raw = (getattr(getattr(cc.choices[0], "message", {}), "content", None)
           or getattr(cc.choices[0], "text", None) or "").strip()
    if not raw:
        raise RuntimeError("empty_response_chat_json_object")

    try:
        parsed, _ = _parse_ai_json(raw)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {e}")

    # normalizuj + fallbacky
    parsed = normalize_plan_json(parsed)

    # --- KOERCIE: presne 10 dní od start_date, štruktúra behu, silové cviky + plank seconds
    start_date = (context_payload.get("goal") or {}).get("start_date")
    strength_gear = (context_payload.get("strength_settings") or {}).get("available") or []
    _coerce_next_10_days(parsed, start_date, strength_gear)

    return parsed