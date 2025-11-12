from fastapi import APIRouter, Body, HTTPException, Request
from typing import Any, Dict

from Configs.config import DEFAULT_MODEL, FALLBACK_MODELS, LLM_RETRIES
from Services.plan_generation import generate_plan_json
from Services.progress_narrative import build_progress_narrative
from Routes.coach_context import coach_context

router = APIRouter(prefix="/coach", tags=["coach"])

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
    primary_sports = payload.get("primary_sports") or payload.get("goal_structured", {}).get("primary_sports") or ["run","ride","strength"]
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
        blocks = {"vo2max": bool(g.get("vo2max_training")), "ftp": bool(g.get("ftp_training")), "threshold": bool(g.get("threshold_focus"))}
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

<<<<<<< HEAD
def _validate_next10(parsed: Dict[str, Any]) -> None:
    n10 = parsed.get("next_10_days")
    if not (isinstance(n10, list) and len(n10) == 10):
        raise HTTPException(status_code=502, detail="AI must return next_10_days with 10 items")
    for i, d in enumerate(n10):
        if not isinstance(d, dict) or not isinstance(d.get("day"), str) or not isinstance(d.get("sessions"), list) or len(d["sessions"]) == 0:
            raise HTTPException(status_code=502, detail=f"AI returned empty or invalid sessions at index {i}")

=======
>>>>>>> 65b4aa8034d0e42994e31c235ac18bf050c14854
@router.post("/analyze/{user_id}")
def coach_analyze(user_id: int, request: Request, payload: dict = Body(...)):
    try:
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
            "strength_settings": norm["strength_settings"],
            "first_n_days": 10,
            "hr_used": hr_used, "weekly": weekly, "recovery": recovery, "notes": notes,
            "thresholds": thresholds, "zones": zones, "prefs": prefs, "bests": bests,
        }
        narr = build_progress_narrative(ctx, weeks)

        models = [DEFAULT_MODEL] + [m for m in FALLBACK_MODELS if m != DEFAULT_MODEL]
        parsed: Dict[str, Any] | None = None
        used_model = DEFAULT_MODEL
        last_err: str | None = None
        debug_trace = None

        for m in models:
            for _ in range(LLM_RETRIES + 1):
                try:
<<<<<<< HEAD
                    p, dbg = generate_plan_json(llm_input, m, debug_raw=True, loose=False)
                    parsed = p; used_model = m; debug_trace = dbg
=======
                    # STRICT JSON (loose=False – ignorujeme a ideme striktne v implementácii)
                    p, dbg = generate_plan_json(llm_input, m, debug_raw=True, loose=False)
                    parsed = p
                    used_model = m
                    debug_trace = dbg
>>>>>>> 65b4aa8034d0e42994e31c235ac18bf050c14854
                    break
                except Exception as e:
                    last_err = str(e); continue
            if parsed is not None: break

        if parsed is None:
            raise HTTPException(status_code=502, detail=f"AI generation failed: {last_err}")

<<<<<<< HEAD
        _validate_next10(parsed)  # <-- prázdne sessions = 502
=======
        # vyžaduj 10-dňovku
        f10 = parsed.get("first_10_days") or []
        n10 = parsed.get("next_10_days") or []
        if not (isinstance(f10, list) and f10) and not (isinstance(n10, list) and n10):
            raise HTTPException(status_code=502, detail="AI returned no 10-day plan")
>>>>>>> 65b4aa8034d0e42994e31c235ac18bf050c14854

        return {
            "success": True,
            "model": used_model,
            "analysis": parsed,
            "context_used": llm_input,
            "narrative": narr,
            "ai_debug": debug_trace,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))