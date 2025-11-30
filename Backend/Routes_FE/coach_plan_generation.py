#Routes_FE.coach_plan_generation
from typing import Any, Dict, Optional, List, Sequence
from fastapi import APIRouter, Body, HTTPException, Request
from datetime import date as _date, timedelta
import os, json, time, urllib.request

from Configs.config import DEFAULT_MODEL
from Services.plan_generation import generate_plan_json
from Services.progress_narrative import build_progress_narrative
from Routes_FE.coach_context import coach_context

router = APIRouter(prefix="/coach", tags=["coach"])

DOW3 = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]

# --------- AI_DEBUG (Supabase REST insert) ---------
def _ai_debug_insert(row: Dict[str, Any]) -> None:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE")
    if not url or not key:
        return
    endpoint = f"{url}/rest/v1/ai_debug"
    data = json.dumps(row).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception:
        pass

# --------- helpers ---------
def _norm_goal(goal_in, fallback_kind: Optional[str] = None) -> str:
    if isinstance(goal_in, dict):
        kind = (goal_in.get("kind") or goal_in.get("goal_kind") or "").strip()
        rg = goal_in.get("race_goal")
        if kind == "race_time" and rg:
            return f"race_time:{rg}"
        return kind or (fallback_kind or "improve_overall")
    return goal_in or fallback_kind or "improve_overall"

def _coerce_rules(rules_in: Any) -> Dict[str, Any]:
    """
    Bezpečne znormalizuje rules na dict.
    - ak príde primitív (int/str/bool) alebo list -> {}
    - zmaže legacy kľúče (wu_cd_detail)
    - zaistí typy polí
    """
    out: Dict[str, Any] = {}
    if isinstance(rules_in, dict):
        out = dict(rules_in)
    # legacy cleanup
    out.pop("wu_cd_detail", None)  # definitívne vyhadzujeme
    # typové istoty
    days_off = out.get("days_off")
    if not isinstance(days_off, list):
        out["days_off"] = []
    else:
        out["days_off"] = [str(x) for x in days_off if x]

    long_run_days = out.get("long_run_days")
    if not isinstance(long_run_days, list):
        out["long_run_days"] = []
    else:
        out["long_run_days"] = [str(x) for x in long_run_days if x]

    # nové pravidlo – default True (radšej neplánuj 2 tréningy denne)
    avoid_two = out.get("avoid_two_a_day")
    out["avoid_two_a_day"] = bool(avoid_two) if isinstance(avoid_two, bool) else True

    # pre spätnú kompatibilitu
    avoid_b2b = out.get("avoid_back_to_back_hard")
    if not isinstance(avoid_b2b, bool):
        out["avoid_back_to_back_hard"] = False

    return out

def _normalize_payload(payload: dict) -> dict:
    goal_block = payload.get("goal") or {}
    goal_struct = payload.get("goal_structured") or {}

    weeks = int(
        (goal_block.get("weeks"))
        or payload.get("weeks")
        or goal_struct.get("weeks")
        or 6
    )

    fallback_kind = (
        goal_block.get("goal_kind")
        or goal_struct.get("goal_kind")
        or payload.get("goal_kind")
        or "improve_overall"
    )
    goal_str = _norm_goal(goal_block, fallback_kind=fallback_kind)

    voice = payload.get("voice") or goal_struct.get("voice") or None

    sports_block = payload.get("sports") or {}
    primary_sports = (
        payload.get("primary_sports")
        or goal_struct.get("primary_sports")
        or ["run", "ride", "strength"]
    )
    persona = payload.get("persona") or goal_struct.get("persona")

    main_sport = (
        payload.get("main_sport")
        or sports_block.get("main_sport")
        or goal_struct.get("main_sport")
    )
    secondary_mix = (
        payload.get("secondary_mix")
        or sports_block.get("secondary_mix")
        or goal_struct.get("secondary_mix")
    )

    targets = payload.get("targets") or goal_struct.get("targets")

    # rules – bezpečná normalizácia + odstránenie legacy kľúčov
    rules_raw = payload.get("rules") or goal_struct.get("preferences") or {}
    rules = _coerce_rules(rules_raw)

    externals = payload.get("externals") or goal_struct.get("external_activities") or []
    injuries = payload.get("injuries") or goal_struct.get("injuries") or []

    focus = payload.get("focus")
    if not focus:
        focus = {
            "areas": goal_struct.get("focus_areas") or [],
            "avoid_zones": goal_struct.get("avoid_zones") or [],
            "rehab": goal_struct.get("rehab_focus") or None,
        }

    plan_start_date = (
        payload.get("plan_start_date")
        or goal_block.get("start_date")
        or goal_struct.get("plan_start_date")
        or goal_struct.get("start_date")
    )

    strength_settings = payload.get("strength_settings") or goal_struct.get("strength_settings")

    intensity_model = payload.get("intensity_model")
    if intensity_model is None:
        if goal_struct.get("polarized_model"):
            intensity_model = "polarized"
        elif goal_struct.get("pyramidal_model"):
            intensity_model = "pyramidal"

    blocks = payload.get("blocks")
    if blocks is None:
        blocks = {
            "vo2max": bool(goal_struct.get("vo2max_training")),
            "ftp": bool(goal_struct.get("ftp_training")),
            "threshold": bool(goal_struct.get("threshold_focus")),
        }

    schema_version = int(payload.get("schema_version") or 1)

    return {
        "schema_version": schema_version,
        "weeks": weeks,
        "goal": goal_str,
        "voice": voice,
        "primary_sports": primary_sports,
        "persona": persona,
        "main_sport": main_sport,
        "secondary_mix": secondary_mix,
        "targets": targets,
        "rules": rules,
        "externals": externals,
        "injuries": injuries,
        "focus": focus,
        "intensity_model": intensity_model,
        "blocks": blocks,
        "plan_start_date": plan_start_date,
        "strength_settings": strength_settings,
        "_raw": payload,
    }

# --------- zones source resolution ---------
def _best_zones_for_context(norm: dict, ctx: dict) -> dict:
    z = ctx.get("zones")
    if isinstance(z, dict) and z:
        return z
    raw = norm.get("_raw") or {}
    if isinstance(raw, dict):
        z2 = raw.get("zones")
        if isinstance(z2, dict) and z2:
            return z2
        prefs = raw.get("prefs") or {}
        if isinstance(prefs, dict):
            val = prefs.get("value") or {}
            if isinstance(val, dict):
                z3 = val.get("zones")
                if isinstance(z3, dict) and z3:
                    return z3
    return {}

# --------- HARD CONSTRAINTS helpers ---------
def _iso(d) -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(d))

def _compute_no_sessions_on(
    plan_start_iso: Optional[str],
    weeks: int,
    days_off: Sequence[str] | None,
    externals: Sequence[dict] | None,
) -> List[str]:
    if not plan_start_iso or weeks <= 0:
        return []
    try:
        start = _date.fromisoformat(plan_start_iso[:10])
    except ValueError:
        return []

    horizon = weeks * 7
    off = set()

    want = { (d or "").strip()[:3].title() for d in (days_off or []) if d }
    for i in range(horizon):
        d = start + timedelta(days=i)
        if DOW3[d.weekday()] in want:
            off.add(d.isoformat())

    for ex in (externals or []):
        if not isinstance(ex, dict):
            continue
        inten = str(ex.get("intensity") or "").lower().strip()
        if ex.get("date"):
            if inten != "low":
                off.add(str(ex["date"])[:10])
            continue
        if ex.get("day"):
            day3 = str(ex["day"]).strip()[:3].title()
            if inten == "low":
                continue
            if day3 in DOW3:
                for i in range(horizon):
                    d = start + timedelta(days=i)
                    if DOW3[d.weekday()] == day3:
                        off.add(d.isoformat())
    return sorted(off)

def _validate_next10(
    parsed: Dict[str, Any], must_start: Optional[str], rules: Optional[Dict[str, Any]]
) -> None:
    n10 = parsed.get("next_10_days")
    if not isinstance(n10, list) or len(n10) < 7:
        raise HTTPException(status_code=502, detail="AI must return next_10_days with at least 7 items")

    for i, d in enumerate(n10):
        if not isinstance(d, dict) or not isinstance(d.get("day"), str):
            raise HTTPException(status_code=502, detail=f"Invalid or missing day at index {i}")
        if not isinstance(d.get("sessions"), list) or len(d["sessions"]) == 0:
            raise HTTPException(status_code=502, detail=f"Empty sessions at index {i}")

        for j, s in enumerate(d["sessions"]):
            if not isinstance(s, dict):
                raise HTTPException(status_code=502, detail=f"Invalid session at {i}:{j}")

            sport = (s.get("sport") or "").lower()
            title = (s.get("title") or "").lower()
            is_run = sport == "run" or "run" in title
            is_strength = (sport == "strength" or "strength" in title or "weight" in title)

            if is_run:
                dur = s.get("duration_min")
                if not isinstance(dur, (int, float)) or dur <= 0:
                    raise HTTPException(status_code=502, detail=f"Run session {i}:{j} must have positive duration_min")

            if is_strength:
                ex = s.get("exercises")
                if not (isinstance(ex, list) and len(ex) >= 3):
                    raise HTTPException(status_code=502, detail=f"Strength session {i}:{j} must include exercises[]")
                for k, e in enumerate(ex):
                    if (not isinstance(e, dict) or not e.get("name") or not isinstance(e.get("sets"), (int, float))):
                        raise HTTPException(status_code=502, detail=f"Exercise {i}:{j}:{k} must include name and sets")
                    if not (isinstance(e.get("reps"), (int, float)) or isinstance(e.get("seconds"), (int, float))):
                        raise HTTPException(status_code=502, detail=f"Exercise {i}:{j}:{k} must include reps or seconds")

    if must_start and n10[0]["day"] != must_start:
        raise HTTPException(status_code=502, detail=f"next_10_days must start at plan_start_date {must_start}")

def _fix_plan_offdays_and_per_day_limit(
    parsed: Dict[str, Any],
    banned_dates: List[str],
    *,
    max_one_session_per_day: bool = True,
) -> Dict[str, Any]:
    if not isinstance(parsed, dict):
        return parsed
    next10 = parsed.get("next_10_days")
    if not isinstance(next10, list):
        return parsed

    banned = set(banned_dates or [])
    fixed_days = []
    for day in next10:
        if not isinstance(day, dict):
            continue
        d = str(day.get("day") or "")
        sessions = day.get("sessions") or []
        if not isinstance(sessions, list):
            continue

        keep: List[dict] = []

        if d in banned:
            keep = [{"title":"Rest Day","sport":"other","duration_min":0,"session_type":"rest_day"}]
        else:
            for s in sessions:
                if max_one_session_per_day and len(keep) >= 1:
                    break
                keep.append(s)

        fixed_days.append({"day": d, "sessions": keep})

    parsed["next_10_days"] = fixed_days
    return parsed

# --------- ROUTE ---------
@router.post("/analyze/{user_id}")
def coach_analyze(user_id: int, request: Request, payload: dict = Body(...)):
    try:
        norm = _normalize_payload(payload)
        weeks = norm["weeks"]

        ctx = coach_context(user_id, weeks=weeks)
        if not ctx.get("success"):
            raise HTTPException(status_code=500, detail="Context build failed")

        # hard constraints – dátumy OFF podľa pravidiel + externals
        rules = norm.get("rules") or {}
        no_sessions_on = _compute_no_sessions_on(
            plan_start_iso=norm.get("plan_start_date"),
            weeks=weeks,
            days_off=rules.get("days_off") or [],
            externals=norm.get("externals") or []
        )
        avoid_two_a_day = bool(rules.get("avoid_two_a_day", False))

        zones_payload = _best_zones_for_context(norm, ctx)

        llm_input = {
            "goal": norm["goal"],
            "schema_version": norm["schema_version"],
            "primary_sports": norm["primary_sports"],
            "persona": norm["persona"],
            "main_sport": norm["main_sport"],
            "secondary_mix": norm["secondary_mix"],
            "targets": norm["targets"],
            "rules": rules,
            "externals": norm.get("externals") or [],
            "injuries": norm["injuries"],
            "focus": norm["focus"],
            "intensity_model": norm["intensity_model"],
            "blocks": norm["blocks"],
            "plan_start_date": norm["plan_start_date"],
            "strength_settings": norm["strength_settings"],
            "first_n_days": 10,
            "weeks": weeks,
            "hr_used": ctx["weekly"]["hr_used"],
            "weekly": ctx["weekly"]["weeks"][-weeks:],
            "recovery": ctx.get("recovery", [])[-21:],
            "notes": ctx.get("notes", [])[-50:],
            "thresholds": ctx.get("thresholds", []),
            "zones": zones_payload,
            "prefs": ctx.get("prefs"),
            "bests": ctx.get("bests", {}),
            "voice": norm.get("voice"),
            "hard_constraints": {
                "no_sessions_on": no_sessions_on,
                "max_one_session_per_day": avoid_two_a_day,
            },
        }

        _ai_debug_insert({
        "user_id": user_id,
        "route": "/api/coach/analyze",
        "model": DEFAULT_MODEL,
        "payload_json": {
            "types": {
                "rules": type(rules).__name__,
                "zones_payload": type(zones_payload).__name__,
            }
        },
        "response_json": None,
        "ok": True,
        "note": "ai_debug_v1: types before LLM",
        })

        parsed, debug_trace = generate_plan_json(
            llm_input,
            DEFAULT_MODEL,
            debug_raw=True,
            loose=False,
        )
        used_model = (debug_trace or {}).get("ok_model") or DEFAULT_MODEL

        if parsed is None:
            _ai_debug_insert({
                "user_id": user_id,
                "route": "/api/coach/analyze",
                "model": used_model,
                "payload_json": llm_input,
                "response_json": (debug_trace or {}).get("raw"),
                "ok": False,
                "note": "ai_debug_v1: parsed None",
            })
            return {
                "success": False,
                "error": "AI generation failed (no parsed content).",
                "analysis_raw": (debug_trace or {}).get("raw"),
                "cleaned": (debug_trace or {}).get("cleaned"),
            }

        # BE validácia
        try:
            _validate_next10(parsed, norm.get("plan_start_date"), norm.get("rules"))
        except Exception as e:
            slim_debug = None
            if isinstance(debug_trace, dict):
                slim_debug = {
                    "models_tried": debug_trace.get("models_tried"),
                    "attempts": debug_trace.get("attempts"),
                    "ok_model": debug_trace.get("ok_model"),
                }
            _ai_debug_insert({
                "user_id": user_id,
                "route": "/api/coach/analyze",
                "model": used_model,
                "payload_json": llm_input,
                "response_json": (debug_trace or {}).get("raw"),
                "ok": False,
                "note": f"ai_debug_v1: validate_error: {str(e)[:120]}",
            })
            return {
                "success": False,
                "error": str(e),
                "analysis_raw": (debug_trace or {}).get("raw"),
                "cleaned": (debug_trace or {}).get("cleaned"),
                "ai_debug": slim_debug,
            }

        # HARD CONSTRAINTS post-fix
        parsed = _fix_plan_offdays_and_per_day_limit(
            parsed,
            banned_dates=no_sessions_on,
            max_one_session_per_day=avoid_two_a_day,
        )

        narr = build_progress_narrative(ctx, weeks)

        slim_debug = None
        if isinstance(debug_trace, dict):
            slim_debug = {
                "models_tried": debug_trace.get("models_tried"),
                "attempts": debug_trace.get("attempts"),
                "ok_model": debug_trace.get("ok_model"),
            }

        _ai_debug_insert({
            "user_id": user_id,
            "route": "/api/coach/analyze",
            "model": used_model,
            "payload_json": llm_input,
            "response_json": parsed,
            "ok": True,
            "note": "ai_debug_v1: output",
        })

        return {
            "success": True,
            "model": used_model,
            "analysis": parsed,
            "narrative": narr,
            "ai_debug": slim_debug,
        }

    except HTTPException:
        raise
    except Exception as e:
        _ai_debug_insert({
            "user_id": user_id,
            "route": "/api/coach/analyze",
            "model": DEFAULT_MODEL,
            "payload_json": {"error_at": "exception", "payload": payload},
            "response_json": {"exception": str(e)},
            "ok": False,
            "note": "ai_debug_v1: exception",
        })
        raise HTTPException(status_code=500, detail=str(e))