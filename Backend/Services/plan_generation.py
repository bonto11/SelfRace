# Services/plan_generation.py

import os, json, re, time, datetime as dt
from typing import Any, Dict, List, Tuple, Optional, cast
from fastapi import HTTPException
from openai import OpenAI
from datetime import date, timedelta
from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S  # čas z .env (Railway)

# ---------- helpers: dátumy / utility ----------
CODEFENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)
WEEKDAY_ORDER = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]

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

def _as_list(obj, key) -> list:
    v = obj.get(key)
    return v if isinstance(v, list) else []

def _weekday_name_of(d: dt.date) -> str:
    return WEEKDAY_ORDER[d.weekday()]

# ---------- normalizácia a fallbacky ----------
def normalize_plan_json(obj: dict, plan_start_iso: Optional[str] = None) -> dict:
    """
    Normalizuje AI JSON:
    - summary, insights, red_flags
    - week_overview (alias outline_10w)
    - first_10_days (alias next_10_days)
    - next_week_plan (+_meta.week_start & plan_source)
    - next_10_days (rolling 10 od start_date; ak chýbajú dátumy, mapuje sa z weekday plánu)
    """
    if not isinstance(obj, dict):
        raise ValueError("AI output is not a JSON object")

    out: Dict[str, Any] = {
        "summary": obj.get("summary") or "No summary.",
        "insights": [],
        "red_flags": _as_list(obj, "red_flags"),
        "week_overview": _as_list(obj, "week_overview") or _as_list(obj, "outline_10w"),
        "first_10_days": _as_list(obj, "first_10_days") or _as_list(obj, "next_10_days"),
        "next_week_plan": obj.get("next_week_plan"),
        "_meta": {"coerced": False, "plan_source": "ai"},
    }

    # insights — podpor aj dict → splošti na bullets
    ins = obj.get("insights")
    if isinstance(ins, list):
        out["insights"] = [str(x) for x in ins]
    elif isinstance(ins, dict):
        bullets: List[str] = []
        def flat(p: str, v: Any):
            if isinstance(v, dict):
                for k, vv in v.items(): flat(f"{p}{k}:", vv)
            elif isinstance(v, list):
                for it in v: flat(p, it)
            else:
                s = f"{p} {v}".strip()
                if s: bullets.append(s)
        flat("", ins)
        out["insights"] = [b.replace("  ", " ").strip(" :") for b in bullets if b]

    # meta.week_start = presne plan_start_iso (žiadne viazanie na pondelok)
    if plan_start_iso:
        out["_meta"]["week_start"] = plan_start_iso

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

    # rolling 10 dní od start_date
    out["next_10_days"] = _build_next_10_days(out, plan_start_iso)

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
                has_any = True; break
        if not has_any and any(d in plan for d in ("monday","tuesday","wednesday","thursday","friday","saturday","sunday")):
            has_any = True

    if not plan or not has_any:
        parsed.setdefault("summary", "Auto-filled plan based on recent context (guidelines detected).")
        parsed["next_week_plan"] = build_min_plan_fn(context_in)
        meta = parsed.setdefault("_meta", {})
        meta["plan_source"] = "coerced_from_guidelines" if meta.get("plan_source") == "coerced_from_guidelines" else "fallback_min"
    else:
        parsed.setdefault("_meta", {})["plan_source"] = parsed.get("_meta", {}).get("plan_source", "ai")
    return parsed

# ---------- koercie tréningov ----------
def _coerce_run_structure(sess: Dict[str,Any]) -> None:
    """Ak run nemá detail, doplň WU/Main/CD rozumne podľa duration."""
    title = (sess.get("title") or "").lower()
    if "run" not in title: return
    if isinstance(sess.get("structure"), dict) and sess["structure"].get("main"): return

    dur = int(sess.get("duration_min") or 0)
    wu  = min(10, max(5, round(dur*0.15))) if dur >= 20 else 5
    cd  = min(10, max(5, round(dur*0.10))) if dur >= 20 else 5
    main = max(10, dur - (wu+cd)) if dur else 20

    sess.setdefault("structure", {})
    sess["structure"]["warmup"]   = {"minutes": wu, "notes":"Easy jog", "target":{"hr":[120,140]}}
    sess["structure"]["main"]     = [{"reps":1, "work_min": main, "recover_min":0,
                                      "target":{"pace": sess.get("target_pace_min_per_km") or None,
                                                "hr":[145,165]}}]
    sess["structure"]["cooldown"] = {"minutes": cd, "notes":"Easy walk or jog"}

def _coerce_strength_exercises(sess: Dict[str,Any], gear: List[str]) -> None:
    """Ak chýbajú cviky, doplň základ podľa dostupnej výbavy. Plank → seconds."""
    if "strength" not in (sess.get("title","").lower()): return

    if sess.get("exercises"):
        xs = []
        for e in sess["exercises"]:
            en = (e.get("name") or "").lower()
            if "plank" in en:
                sec = int(e.get("seconds") or e.get("reps") or 30)
                xs.append({"name": e.get("name","Plank"), "sets": e.get("sets",3), "seconds": sec, "rest_sec": e.get("rest_sec",30)})
            else:
                xs.append({"name": e.get("name","Exercise"), "sets": e.get("sets",3), "reps": int(e.get("reps",10)), "rest_sec": e.get("rest_sec",60)})
        sess["exercises"] = xs
        return

    bank_minimal = [
        {"name":"Goblet Squat" if ("dumbbells" in gear or "kettlebell" in gear) else "Air Squat", "sets":3, "reps":12, "rest_sec":60},
        {"name":"Push-up", "sets":3, "reps":10, "rest_sec":60},
        {"name":"Bent-over Row (band/TRX/pull-up)" if any(g in gear for g in ["trx","resistance_bands","pullup_bar"]) else "Door-row (towel)", "sets":3, "reps":12, "rest_sec":60},
        {"name":"Plank", "sets":3, "seconds":30, "rest_sec":30},
        {"name":"Lunge", "sets":3, "reps":10, "rest_sec":45},
    ]
    sess["exercises"] = bank_minimal

def _coerce_weekday_plan_sessions(nwp: Dict[str, Any], gear: List[str]) -> None:
    """Doplň štruktúry aj do weekday plánu (ak nie sú)."""
    for k, v in list(nwp.items()):
        if k.lower() not in WEEKDAY_ORDER: 
            continue
        if isinstance(v, dict):
            sessions = v.get("sessions")
            if isinstance(sessions, list):
                for s in sessions:
                    if isinstance(s, dict):
                        _coerce_run_structure(s)
                        _coerce_strength_exercises(s, gear)
            else:
                _coerce_run_structure(v)
                _coerce_strength_exercises(v, gear)

def _build_next_10_days(parsed: Dict[str,Any], start_date_iso: Optional[str]) -> List[Dict[str,Any]]:
    """
    Rolling 10 dní od start_date:
      1) Ak máme 'first_10_days' s dátumami → normalizuj a doplň štruktúry.
      2) Inak namapuj 'next_week_plan' podľa dni v týždni na konkrétne dátumy.
      3) Ak nič, doplň rozumné defaults.
    """
    out: List[Dict[str,Any]] = []
    if not start_date_iso:
        return out

    start = _parse_date(start_date_iso)
    if not start:
        return out

    want_dates = [_iso(start + dt.timedelta(days=i)) for i in range(10)]
    strength_gear = (parsed.get("strength_settings") or {}).get("available") or []

    # (1) skúsiť existujúcu 'first_10_days'
    raw = parsed.get("first_10_days")
    if isinstance(raw, list) and raw:
        # normalizuj + koercie
        norm_map: Dict[str, Dict[str,Any]] = {}
        for entry in raw:
            if not isinstance(entry, dict): 
                continue
            day = entry.get("day") or entry.get("date")
            ses = entry.get("sessions") or ([entry] if entry.get("title") else [])
            if isinstance(ses, dict): 
                ses = [ses]
            if isinstance(ses, list):
                clean = []
                for s in ses:
                    if isinstance(s, dict):
                        _coerce_run_structure(s)
                        _coerce_strength_exercises(s, strength_gear)
                        clean.append(s)
                norm_map[str(day)] = {"day": str(day), "sessions": clean}

        for d in want_dates:
            if d in norm_map:
                out.append({"day": d, "sessions": norm_map[d]["sessions"]})
            else:
                # fallback deň
                sess = {"title": "Rest Day", "duration_min": 0} if len(out) in (2,5) else {"title":"Easy Run","duration_min":30,"intensity":"easy"}
                if "Run" in sess["title"]:
                    _coerce_run_structure(sess)  # type: ignore[arg-type]
                out.append({"day": d, "sessions": [sess]})
        return out

    # (2) mapovanie z weekday plánu
    nwp = parsed.get("next_week_plan")
    if isinstance(nwp, dict) and nwp:
        _coerce_weekday_plan_sessions(nwp, strength_gear)  # doplň štruktúry
        nwp_lc = { (k or "").lower(): v for k,v in nwp.items() if isinstance(k, str) }

        for i in range(10):
            day = start + dt.timedelta(days=i)
            wd = _weekday_name_of(day)
            cand = nwp_lc.get(wd)
            if isinstance(cand, dict):
                sessions = cand.get("sessions")
                if isinstance(sessions, list):
                    out.append({"day": _iso(day), "sessions": sessions})
                else:
                    out.append({"day": _iso(day), "sessions": [{ **{k:v for k,v in cand.items() if k != "sessions"} }]})
            elif isinstance(cand, list):
                out.append({"day": _iso(day), "sessions": cand})
            else:
                # fallback, ak v pláne nie je daný deň
                sess = {"title":"Rest Day","duration_min":0} if i in (2,5) else {"title":"Easy Run","duration_min":30,"intensity":"easy"}
                if "Run" in sess["title"]:
                    _coerce_run_structure(sess)  # type: ignore[arg-type]
                out.append({"day": _iso(day), "sessions":[sess]})
        return out

    # (3) úplný default
    for i in range(10):
        sess = {"title":"Rest Day","duration_min":0} if i in (2,5) else {"title":"Easy Run","duration_min":30,"intensity":"easy"}
        if "Run" in sess["title"]:
            _coerce_run_structure(sess)  # type: ignore[arg-type]
        out.append({"day": _iso(start + dt.timedelta(days=i)), "sessions":[sess]})
    return out

def _coerce_next_10_days(parsed: Dict[str,Any], start_date_str: Optional[str], strength_gear: List[str]) -> None:
    """
    (ZACHOVANÉ API PRE EXISTUJÚCI KÓD)
    Koercia zostáva kvôli kompatibilite: pre ‘first_10_days’ dorobíme presne 10 dní
    od start_date (a doplníme štruktúry). ‘next_10_days’ však FE môže preferovať.
    """
    if not start_date_str:
        parsed["first_10_days"] = []
        parsed.setdefault("_meta", {})["next10_start"] = None
        return

    start = _parse_date(start_date_str)
    if not start:
        parsed["first_10_days"] = []
        parsed.setdefault("_meta", {})["next10_start"] = None
        return

    want_dates = [_iso(start + dt.timedelta(days=i)) for i in range(10)]
    raw = parsed.get("first_10_days") or parsed.get("next_10_days")
    norm: Dict[str, Dict[str,Any]] = {}

    if isinstance(raw, list):
        for entry in raw:
            if isinstance(entry, dict):
                day = entry.get("day") or entry.get("date")
                ses = entry.get("sessions") or ([entry] if entry.get("title") else [])
                if isinstance(ses, dict): ses = [ses]
                cleaned = []
                for s in (ses or []):
                    if isinstance(s, dict):
                        _coerce_run_structure(s)
                        _coerce_strength_exercises(s, strength_gear)
                        cleaned.append(s)
                norm[str(day)] = {"day": str(day), "sessions": cleaned}

    out_list: List[Dict[str,Any]] = []
    for i, d in enumerate(want_dates):
        cur = norm.get(d)
        if not cur:
            sess = {"title": "Rest Day" if i in (2,5) else "Easy Run", "duration_min": 0 if i in (2,5) else 30, "intensity": "easy" if i not in (2,5) else None}
            if "run" in (sess.get("title","").lower()):
                _coerce_run_structure(sess)
            elif "strength" in (sess.get("title","").lower()):
                _coerce_strength_exercises(sess, strength_gear)
            out_list.append({"day": d, "sessions":[sess]})
        else:
            out_list.append({"day": d, "sessions": cur["sessions"]})

    parsed["first_10_days"] = out_list
    parsed.setdefault("_meta", {})["next10_start"] = start_date_str

# ---------------- LLM volanie + RAW DEBUG ----------------
def _llm_models_priority(explicit_model: Optional[str]) -> List[str]:
    env_list = os.getenv("OPENAI_MODEL_FALLBACKS", "gpt-4o-mini,gpt-4o,gpt-4.1-mini")
    env_models = [m.strip() for m in env_list.split(",") if m.strip()]
    if explicit_model and explicit_model not in env_models:
        return [explicit_model] + env_models
    return env_models if not explicit_model else [explicit_model] + env_models

def _build_prompts(context_payload: dict, schema_text: str, loose: bool):
    if loose:
        system_txt = "You are an endurance coaching assistant. Reply helpfully."
        user_txt = "Context JSON:\n" + json.dumps(context_payload, ensure_ascii=False) + "\n\n" + \
                   "Return a plan and the next 10 days. JSON is preferred but free-form text is OK."
    else:
        system_txt = (
            "You are an endurance coaching assistant. "
            "Always return a single valid JSON object matching the schema. No prose. No code fences."
        )
        user_txt = "Context JSON:\n" + json.dumps(context_payload, ensure_ascii=False) + "\n\nSchema (instructional):\n" + schema_text
    return system_txt, user_txt

def _call_openai(client: OpenAI, model: str, system_txt: str, user_txt: str, max_tokens: int, loose: bool) -> str:
    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_txt},
            {"role": "user",   "content": user_txt},
        ],
        "temperature": 0.25,
        "max_tokens": max_tokens,
    }
    if not loose:
        kwargs["response_format"] = {"type": "json_object"}  # type: ignore[assignment]
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
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")
    timeout_s = int(os.getenv("OPENAI_TIMEOUT_S", str(LLM_TIMEOUT_S or 25)))
    timeout_s = max(timeout_s, 45)

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = _llm_models_priority(model)
    token_budgets = [2200, 1800, 1400]

    schema_text = """
JSON object with keys:
  summary: string
  insights: string[]
  red_flags: {type:string, details?:string, evidence?:string}[]
  week_overview?: string[]
  first_10_days?: { day: string(YYYY-MM-DD), sessions: Session[] }[]
  next_week_plan: { ... }
where Session = {
  title: string, duration_min: number,
  intensity?: string|null, notes?: string|null,
  target_pace_min_per_km?: string|null,
  target_hr_bpm_range?: [number, number]|null,
  target_power_watts?: number|null, zone?: string|null,
  structure?: { warmup?: {...}, main?: [...], cooldown?: {...} },
  exercises?: { name:string, sets:number, reps?:number, seconds?:number, rest_sec?:number }[]
}
Hard constraints:
- Return ONLY JSON (strict mode). For loose mode this is advisory.
""".strip()

    # prompts
    system_txt, user_txt = _build_prompts(context_payload, schema_text, loose)
    print(f"[AI] compose prompts | system_len={len(system_txt)} user_len={len(user_txt)}")

    trace = {
        "system_prompt": system_txt,
        "user_prompt": user_txt,
        "models_tried": models,
        "attempts": []
    }

    last_err: Optional[str] = None
    last_raw: Optional[str] = None

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt-1, len(token_budgets)-1)]
            print(f"[AI] call start | model={m} attempt={attempt} budget={budget}")
            try:
                raw = _call_openai(client, m, system_txt, user_txt, budget, loose)
                last_raw = raw
                dur_ms = int((time.time() - started) * 1000)
                print(f"[AI] call ok    | model={m} attempt={attempt} dur_ms={dur_ms} raw_len={len(raw)}")

                trace["attempts"].append({
                    "model": m, "attempt": attempt, "tokens_budget": budget,
                    "duration_ms": dur_ms, "ok": True,
                    "raw_preview": (raw[:800] + ("…[truncated]" if len(raw) > 800 else "")),
                })

                # parse (loose: tolerantne)
                if loose:
                    try:
                        parsed_dict, _ = _parse_ai_json(raw)
                    except Exception:
                        parsed_dict = {"raw_text": raw}
                else:
                    if not raw:
                        raise RuntimeError("empty_response_chat_json_object")
                    parsed_dict, _ = _parse_ai_json(raw)

                start_date = _extract_start_date(context_payload)

                # Normalizácia + doplnenie rolling 10 dní
                parsed = normalize_plan_json(parsed_dict, plan_start_iso=start_date)

                # Zachovanie kompatibility s existujúcou 10-dňovkou (first_10_days)
                strength_gear = (context_payload.get("strength_settings") or {}).get("available") or []
                _coerce_next_10_days(parsed, start_date, strength_gear)

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