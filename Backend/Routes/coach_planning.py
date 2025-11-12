from typing import Any, Dict, Optional, List, Tuple

from fastapi import APIRouter, Body, HTTPException, Request

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
        if g.get("polarized_model"):
            intensity_model = "polarized"
        elif g.get("pyramidal_model"):
            intensity_model = "pyramidal"

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


# ---- soft validácia (nikdy neháče HTTPException) ----
def _validate_next10_soft(parsed: Dict[str, Any], must_start: Optional[str], rules: Optional[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []

    # alias: ak chýba next_10_days, ale je first_10_days s presne 10 dňami, použijeme to na validáciu
    n10 = parsed.get("next_10_days")
    f10 = parsed.get("first_10_days")
    if not (isinstance(n10, list) and len(n10) == 10):
        if isinstance(f10, list) and len(f10) == 10:
            n10 = f10
        else:
            got_len = (len(n10) if isinstance(n10, list) else None)
            f10_len = (len(f10) if isinstance(f10, list) else None)
            errors.append(f"next_10_days must have 10 items (got={got_len}); first_10_days_len={f10_len}")
            return errors  # bez ďalšej validácie

    require_wu_cd = bool((rules or {}).get("wu_cd_detail"))

    for i, d in enumerate(n10):
        if not isinstance(d, dict) or not isinstance(d.get("day"), str):
            errors.append(f"Invalid or missing day at index {i}")
            continue
        if not isinstance(d.get("sessions"), list) or len(d["sessions"]) == 0:
            errors.append(f"Empty sessions at index {i}")
            continue

        for j, s in enumerate(d["sessions"]):
            if not isinstance(s, dict):
                errors.append(f"Invalid session at {i}:{j}")
                continue

            sport = (s.get("sport") or "").lower()
            title = (s.get("title") or "").lower()
            is_run = sport == "run" or "run" in title
            is_strength = sport == "strength" or "strength" in title or "weight" in title

            if is_run:
                hr = s.get("target_hr_bpm_range")
                ok_hr = isinstance(hr, list) and len(hr) == 2
                if not ok_hr:
                    struc = s.get("structure")
                    if isinstance(struc, dict) and isinstance(struc.get("main"), list):
                        for blk in struc["main"]:
                            thr = (blk or {}).get("target", {}).get("hr")
                            if isinstance(thr, list) and len(thr) == 2:
                                ok_hr = True
                                break
                if not ok_hr:
                    errors.append(f"Missing HR target in run session at {i}:{j}")

                if require_wu_cd:
                    struc = s.get("structure")
                    if not isinstance(struc, dict):
                        errors.append(f"Run session {i}:{j} must include structure")
                    else:
                        wu = struc.get("warmup")
                        cd = struc.get("cooldown")
                        main = struc.get("main")
                        if not (isinstance(wu, dict) and isinstance(cd, dict) and isinstance(main, list) and len(main) > 0):
                            errors.append(f"Run session {i}:{j} must include warmup/main/cooldown")
                        if isinstance(wu, dict) and "minutes" in wu and not isinstance(wu.get("minutes"), (int, float)):
                            errors.append(f"Warmup minutes invalid at {i}:{j}")
                        if isinstance(cd, dict) and "minutes" in cd and not isinstance(cd.get("minutes"), (int, float)):
                            errors.append(f"Cooldown minutes invalid at {i}:{j}")

            if is_strength:
                ex = s.get("exercises")
                if not (isinstance(ex, list) and len(ex) >= 3):
                    errors.append(f"Strength session {i}:{j} must include exercises[]")
                    continue
                for k, e in enumerate(ex):
                    if not isinstance(e, dict) or not e.get("name") or not isinstance(e.get("sets"), (int, float)):
                        errors.append(f"Exercise {i}:{j}:{k} must include name and sets")
                    if not (isinstance(e.get("reps"), (int, float)) or isinstance(e.get("seconds"), (int, float))):
                        errors.append(f"Exercise {i}:{j}:{k} must include reps or seconds")

    if must_start and isinstance(n10, list) and n10 and isinstance(n10[0], dict):
        if n10[0].get("day") != must_start:
            errors.append(f"next_10_days should start at plan_start_date {must_start} (got {n10[0].get('day')})")

    return errors


@router.post("/analyze/{user_id}")
def coach_analyze(user_id: int, request: Request, payload: dict = Body(...)):
    try:
        norm = _normalize_payload(payload)
        weeks = norm["weeks"]

        ctx = coach_context(user_id, weeks=weeks)
        if not ctx.get("success"):
            raise HTTPException(status_code=500, detail="Context build failed")

        llm_input = {
            "goal": norm["goal"],
            "schema_version": norm["schema_version"],
            "primary_sports": norm["primary_sports"],
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
            "hr_used": ctx["weekly"]["hr_used"],
            "weekly": ctx["weekly"]["weeks"][-weeks:],
            "recovery": ctx.get("recovery", [])[-21:],
            "notes": ctx.get("notes", [])[-50:],
            "thresholds": ctx.get("thresholds", []),
            "zones": ctx.get("zones", []),
            "prefs": ctx.get("prefs"),
            "bests": ctx.get("bests", {}),
        }

        # Modely v poradí; generate_plan_json neháče (okrem chýbajúceho API key)
        models = [DEFAULT_MODEL] + [m for m in FALLBACK_MODELS if m != DEFAULT_MODEL]
        parsed: Optional[Dict[str, Any]] = None
        debug_trace: Optional[Dict[str, Any]] = None

        for m in models:
            candidate, trace = generate_plan_json(llm_input, m, debug_raw=True, loose=False)
            parsed = candidate
            debug_trace = trace
            if parsed and (parsed.get("next_10_days") or parsed.get("first_10_days")):
                break

        if parsed is None:
            return {
                "success": False,
                "error": "AI generation failed (no parsed content).",
                "analysis": None,
                "ai_debug": debug_trace,
            }

        # soft validácia — nikdy nevracia HTTP chybu
        validation_errors = _validate_next10_soft(parsed, norm.get("plan_start_date"), norm.get("rules"))
        narr = build_progress_narrative(ctx, weeks)

        return {
            "success": len(validation_errors) == 0,
            "model": (debug_trace or {}).get("ok_model"),
            "analysis": parsed,
            "validation_errors": validation_errors,
            "context_used": llm_input,
            "narrative": narr,
            "ai_debug": debug_trace,  # obsahuje raw + cleaned keď debug_raw=True
        }

    except HTTPException:
        # zachovaj doterajšie správanie pre reálne serverové chyby (nie AI)
        raise
    except Exception as e:
        # nečakané chyby BE
        raise HTTPException(status_code=500, detail=str(e))