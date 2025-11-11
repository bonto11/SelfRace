# Routes/coach_planning.py
from fastapi import APIRouter, Body, HTTPException, Request
from typing import Any, Dict, List, cast

from Configs.config import DEFAULT_MODEL, FALLBACK_MODELS, LLM_RETRIES
from Services.plan_generation import generate_plan_json, ensure_minimum_week_plan
from Services.progress_narrative import build_progress_narrative
from Routes.coach_context import coach_context

router = APIRouter(prefix="/coach", tags=["coach"])

def _recent_run_km_avg(weekly: list[dict]) -> float:
    vals = [float(w.get("km_run") or 0.0) for w in (weekly[-3:] if weekly else [])]
    return (sum(vals) / len(vals)) if vals else 30.0

def _build_min_plan_from_context(ctx_in: Dict[str, Any]) -> Dict[str, Any]:
    sports: List[str] = cast(List[str], ctx_in.get("primary_sports") or ["run", "strength"])
    run_s = [
        {"title": "Intervals 6×800m @ 5k pace", "duration_min": 60, "intensity": "high", "notes": "RPE 8; pauzy 2–3 min"},
        {"title": "Tempo 20–25 min @ LT", "duration_min": 55, "intensity": "med-high", "notes": "RPE 7"},
        {"title": "Long run easy", "duration_min": 80, "intensity": "easy", "notes": "RPE 4"},
    ]
    ride_s = [{"title": "Endurance Z2", "duration_min": 45}, {"title": "Endurance Z2", "duration_min": 45}]
    str_s = [{"title": "Full-body", "duration_min": 45}, {"title": "Core+Mobility", "duration_min": 25}]
    plan: Dict[str, Any] = {
        "focus": "build",
        "monday": {"title": "Rest", "duration_min": 0, "notes": "Hydration, sleep"},
        "tuesday": run_s[0] if "run" in sports else (ride_s[0] if "ride" in sports else str_s[0]),
        "wednesday": str_s[0] if "strength" in sports else {"title": "Easy cross", "duration_min": 30},
        "thursday": run_s[1] if "run" in sports else (ride_s[1] if "ride" in sports else str_s[-1]),
        "friday": {"title": "Rest", "duration_min": 0, "notes": "Light mobility"},
        "saturday": run_s[2] if "run" in sports else (ride_s[0] if "ride" in sports else {"title": "Hike", "duration_min": 60}),
        "sunday": (ride_s[1] if "ride" in sports else str_s[-1]) if "run" not in sports else {"title": "Easy jog", "duration_min": 40},
        "rest_days": ["Mon", "Fri"],
        "run": {"weekly_km_target": 30, "sessions": run_s},
        "ride": {"weekly_time_target_min": 90, "sessions": ride_s},
        "strength": {"sessions": str_s},
    }
    return plan

def _norm_goal(goal_in) -> str:
    if isinstance(goal_in, dict):
        kind = (goal_in.get("kind") or "").strip()
        rg = goal_in.get("race_goal")
        if kind == "race_time" and rg:
            return f"race_time:{rg}"
        return kind or "improve_overall"
    return (goal_in or "improve_overall")

def _normalize_payload(payload: dict) -> dict:
    weeks = int(payload.get("weeks") or payload.get("goal_structured", {}).get("weeks") or 6)
    goal_str = _norm_goal(payload.get("goal") or payload.get("goal_structured", {}).get("goal"))
    primary_sports = payload.get("primary_sports") or payload.get("goal_structured", {}).get("primary_sports") or ["run", "ride", "strength"]

    persona = payload.get("persona") or payload.get("goal_structured", {}).get("persona")
    main_sport = payload.get("main_sport") or payload.get("goal_structured", {}).get("main_sport")
    secondary_mix = payload.get("secondary_mix") or payload.get("goal_structured", {}).get("secondary_mix")

    targets = payload.get("targets") or payload.get("goal_structured", {}).get("targets")
    rules = payload.get("rules") or payload.get("goal_structured", {}).get("preferences")
    externals = payload.get("externals") or payload.get("goal_structured", {}).get("external_activities") or []
    injuries = payload.get("injuries") or payload.get("goal_structured", {}).get("injuries") or []
    focus = payload.get("focus") or {
        "areas": (payload.get("goal_structured", {}).get("focus_areas") or []),
        "avoid_zones": (payload.get("goal_structured", {}).get("avoid_zones") or []),
        "rehab": payload.get("goal_structured", {}).get("rehab_focus") or None,
    }

    plan_start_date = payload.get("plan_start_date") or payload.get("goal_structured", {}).get("plan_start_date")
    strength_settings = payload.get("strength_settings") or payload.get("goal_structured", {}).get("strength_settings")

    intensity_model = payload.get("intensity_model")
    if intensity_model is None:
        g = payload.get("goal_structured", {})
        if g.get("polarized_model"): intensity_model = "polarized"
        elif g.get("pyramidal_model"): intensity_model = "pyramidal"

    blocks = payload.get("blocks")
    if blocks is None:
        g = payload.get("goal_structured", {})
        blocks = {
            "vo2max": bool(g.get("vo2max_training")),
            "ftp": bool(g.get("ftp_training")),
            "threshold": bool(g.get("threshold_focus")),
        }

    schema_version = int(payload.get("schema_version") or 1)
    return {
        "schema_version": schema_version,
        "weeks": weeks,
        "goal": goal_str,
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

@router.post("/analyze/{user_id}")
def coach_analyze(user_id: int, request: Request, payload: dict = Body(...)):
    """
    DEBUG režimy cez query:
      ?debug_raw=1  -> vráti system/user prompt a raw odpoveď AI
      ?loose=1      -> pošli do AI voľnejší prompt (bez response_format)
    """
    try:
        q = request.query_params
        debug_raw = q.get("debug_raw") == "1"
        loose = q.get("loose") == "1"

        norm = _normalize_payload(payload)
        weeks = norm["weeks"]; goal = norm["goal"]; primary_sports = norm["primary_sports"]

        ctx = coach_context(user_id, weeks=weeks)
        if not ctx.get("success"):
            raise HTTPException(status_code=500, detail="Context build failed")

        weekly     = ctx["weekly"]["weeks"][-weeks:]
        hr_used    = ctx["weekly"]["hr_used"]
        recovery   = ctx.get("recovery", [])[-21:]
        notes      = ctx.get("notes", [])[-50:]
        thresholds = ctx.get("thresholds", [])
        zones      = ctx.get("zones", [])
        prefs      = ctx.get("prefs")
        bests      = ctx.get("bests", {})
        
        llm_input = {
            "goal": goal,
            "schema_version": norm["schema_version"],
            "primary_sports": primary_sports,
            "persona": norm["persona"],
            "main_sport": norm["main_sport"],
            "secondary_mix": norm["secondary_mix"],
            "targets": norm["targets"],
            "rules": norm["rules"],
            "externals": norm["externals"],
            "injuries": norm["injuries"],
            "focus": norm["focus"],
            "intensity_model": norm["intensity_model"],
            "blocks": norm["blocks"],
            "plan_start_date": norm["plan_start_date"],
            "strength_settings" :norm["strength_settings"],
            "first_n_days" : 10,
            "hr_used": hr_used, "weekly": weekly, "recovery": recovery, "notes": notes,
            "thresholds": thresholds, "zones": zones, "prefs": prefs, "bests": bests,
        }
        narr = build_progress_narrative(ctx, weeks)

        models = [DEFAULT_MODEL] + [m for m in FALLBACK_MODELS if m != DEFAULT_MODEL]
        parsed = None; used_model = DEFAULT_MODEL; last_err = None; debug_trace = None

        for m in models:
            for _ in range(LLM_RETRIES + 1):
                try:
                    p, dbg = generate_plan_json(llm_input, m, debug_raw=debug_raw, loose=loose)
                    parsed = ensure_minimum_week_plan(p, llm_input, _build_min_plan_from_context)
                    used_model = m
                    debug_trace = dbg  # obsahuje raw system/user/raw_output + časovanie
                    break
                except Exception as e:
                    last_err = str(e); continue
            if parsed is not None: break

        if parsed is None:
            raise HTTPException(status_code=500, detail=f"AI generation failed: {last_err}")

        resp = {
            "success": True,
            "model": used_model,
            "analysis": parsed,
            "context_used": llm_input,
            "narrative": narr,
        }
        if debug_raw and debug_trace:
            resp["ai_debug"] = debug_trace  # system_prompt, user_prompt, attempts[], last_raw
        return resp
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))