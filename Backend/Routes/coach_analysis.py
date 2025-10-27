# Routes/coach_analysis.py
from fastapi import APIRouter, Body, HTTPException
from typing import Any, Dict, List, cast
from Services.db import DEFAULT_MODEL, FALLBACK_MODELS, LLM_RETRIES
from Services.llm import try_llm_call, enforce_minimum_plan
from Services.narrative import build_narrative
from Routes.context import coach_context

router = APIRouter(prefix="/coach", tags=["coach"])

def _recent_run_km_avg(weekly: list[dict]) -> float:
    vals = [float(w.get("km_run") or 0.0) for w in (weekly[-3:] if weekly else [])]
    return (sum(vals) / len(vals)) if vals else 30.0

def _build_min_plan_from_context(ctx_in: Dict[str, Any]) -> Dict[str, Any]:
    sports: List[str] = cast(List[str], ctx_in.get("primary_sports") or ["run","strength"])
    run_s = [
        {"title":"Intervals 6×800m @ 5k pace","duration_min":60,"intensity":"high","notes":"RPE 8; pauzy 2–3 min"},
        {"title":"Tempo 20–25 min @ LT","duration_min":55,"intensity":"med-high","notes":"RPE 7"},
        {"title":"Long run easy","duration_min":80,"intensity":"easy","notes":"RPE 4"},
    ]
    ride_s = [{"title":"Endurance Z2","duration_min":45},{"title":"Endurance Z2","duration_min":45}]
    str_s  = [{"title":"Full-body","duration_min":45},{"title":"Core+Mobility","duration_min":25}]
    plan: Dict[str, Any] = {
        "focus":"build",
        "monday":{"title":"Rest","duration_min":0,"notes":"Hydration, sleep"},
        "tuesday":   run_s[0] if "run" in sports else (ride_s[0] if "ride" in sports else str_s[0]),
        "wednesday": str_s[0] if "strength" in sports else {"title":"Easy cross","duration_min":30},
        "thursday":  run_s[1] if "run" in sports else (ride_s[1] if "ride" in sports else str_s[-1]),
        "friday":{"title":"Rest","duration_min":0,"notes":"Light mobility"},
        "saturday":  run_s[2] if "run" in sports else (ride_s[0] if "ride" in sports else {"title":"Hike","duration_min":60}),
        "sunday":    (ride_s[1] if "ride" in sports else str_s[-1]) if "run" not in sports else {"title":"Easy jog","duration_min":40},
        "rest_days":["Mon","Fri"],
        "run":{"weekly_km_target":30,"sessions":run_s},
        "ride":{"weekly_time_target_min":90,"sessions":ride_s},
        "strength":{"sessions":str_s},
    }
    return plan

@router.post("/analyze/{user_id}")
def coach_analyze(user_id: int, payload: dict = Body(...)):
    try:
        weeks = int(payload.get("weeks", 6))
        goal = payload.get("goal", "")
        primary_sports = payload.get("primary_sports", ["run","ride","strength"])
        goal_structured = payload.get("goal_structured")

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
            "goal": goal, "goal_structured": goal_structured,
            "primary_sports": primary_sports,
            "hr_used": hr_used, "weekly": weekly, "recovery": recovery, "notes": notes,
            "thresholds": thresholds, "zones": zones, "prefs": prefs, "bests": bests,
        }
        narr = build_narrative(ctx, weeks)

        models = [DEFAULT_MODEL] + [m for m in FALLBACK_MODELS if m != DEFAULT_MODEL]
        parsed = None; used_model = DEFAULT_MODEL; last_err = None

        for m in models:
            for _ in range(LLM_RETRIES + 1):
                try:
                    p = try_llm_call(llm_input, m)
                    parsed = enforce_minimum_plan(p, llm_input, _build_min_plan_from_context)
                    used_model = m
                    break
                except Exception as e:
                    last_err = str(e); continue
            if parsed is not None: break

        if parsed is None:
            raise HTTPException(status_code=500, detail=f"LLM failed: {last_err}")

        return {"success": True, "model": used_model, "analysis": parsed, "context_used": llm_input, "narrative": narr}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))