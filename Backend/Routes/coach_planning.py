# Routes/coach_planning.py
from typing import Any, Dict, Optional, List

from fastapi import APIRouter, Body, HTTPException, Request

from Configs.config import DEFAULT_MODEL, FALLBACK_MODELS
from Services.plan_generation import generate_plan_json
from Services.progress_narrative import build_progress_narrative
from Routes.coach_context import coach_context

router = APIRouter(prefix="/coach", tags=["coach"])


def _norm_goal(goal_in) -> str:
    """
    Normalizuje cieľ na jednoduchý string.
    Podporuje staré aj nové polia: kind / goal_kind.
    """
    if isinstance(goal_in, dict):
        kind = (goal_in.get("kind") or goal_in.get("goal_kind") or "").strip()
        rg = goal_in.get("race_goal")
        if kind == "race_time" and rg:
            return f"race_time:{rg}"
        return kind or "improve_overall"
    return (goal_in or "improve_overall")


def _normalize_payload(payload: dict) -> dict:
    """
    Zoberie payload z FE (nový kontrakt) + prípadné legacy `goal_structured`
    a vráti plochú štruktúru, ktorú používame ďalej v BE.
    """
    goal_struct = payload.get("goal_structured") or {}  # legacy
    goal_block = payload.get("goal") or {}

    # --- weeks -----------------------------------------------------------------
    weeks = int(
        payload.get("weeks")
        or goal_block.get("weeks")
        or goal_struct.get("weeks")
        or 6
    )

    # --- goal string -----------------------------------------------------------
    goal_str = _norm_goal(
        goal_block
        or payload.get("goal")
        or goal_struct.get("goal")
        or {"goal_kind": goal_struct.get("goal_kind")}
    )

    # --- sports ----------------------------------------------------------------
    sports_block = payload.get("sports") or {}
    main_sport = (
        payload.get("main_sport")
        or sports_block.get("main_sport")
        or goal_struct.get("main_sport")
    )

    secondary_mix = (
        payload.get("secondary_mix")
        or sports_block.get("secondary_mix")
        or goal_struct.get("secondary_mix")
        or []
    )

    # primárne športy – nový kontrakt ich neposiela, tak si ich zložíme
    primary_sports = payload.get("primary_sports") or goal_struct.get("primary_sports")
    if not primary_sports:
        primary = []
        if main_sport:
            primary.append(main_sport)
        for it in secondary_mix or []:
            s = (it or {}).get("sport")
            if s and s not in primary:
                primary.append(s)
        if not primary:
            primary = ["run", "ride", "strength"]
        primary_sports = primary

    # --- persona / hlas --------------------------------------------------------
    persona = (
        payload.get("persona")
        or goal_struct.get("persona")
        or (payload.get("voice") or {}).get("coach_voice")
    )

    # --- targets / rules / externals / injuries / focus ------------------------
    targets = payload.get("targets") or goal_struct.get("targets")

    rules = payload.get("rules") or goal_struct.get("preferences")

    externals = payload.get("externals") or goal_struct.get("external_activities") or []

    injuries = payload.get("injuries") or goal_struct.get("injuries") or []

    if isinstance(payload.get("focus"), dict):
        f_in = payload["focus"]
        focus = {
            "areas": f_in.get("areas") or [],
            "avoid_zones": f_in.get("avoid_zones") or [],
            "rehab": f_in.get("rehab") or None,
        }
    else:
        focus = {
            "areas": goal_struct.get("focus_areas") or [],
            "avoid_zones": goal_struct.get("avoid_zones") or [],
            "rehab": goal_struct.get("rehab_focus") or None,
        }

    # --- dátum začiatku – JEDEN kanonický kľúč -------------------------------
    plan_start_date = (
        payload.get("plan_start_date")
        or goal_block.get("start_date")
        or goal_struct.get("plan_start_date")
        or goal_struct.get("start_date")
    )

    # --- strength --------------------------------------------------------------
    strength_settings = (
        payload.get("strength_settings")
        or goal_struct.get("strength_settings")
    )

    # --- intenzitný model / blocks --------------------------------------------
    intensity_model = payload.get("intensity_model")
    if intensity_model is None:
        g = goal_struct
        if g.get("polarized_model"):
            intensity_model = "polarized"
        elif g.get("pyramidal_model"):
            intensity_model = "pyramidal"

    blocks = payload.get("blocks")
    if blocks is None:
        g = goal_struct
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


# ---- strict BE validácia bez dopĺňania ----
def _validate_next10(parsed: Dict[str, Any], must_start: Optional[str], rules: Optional[Dict[str, Any]]) -> None:
    n10 = parsed.get("next_10_days")
    if not (isinstance(n10, list) and len(n10) == 10):
        raise HTTPException(status_code=502, detail="AI must return next_10_days with 10 items")

    require_wu_cd = bool((rules or {}).get("wu_cd_detail"))

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
                    raise HTTPException(status_code=502, detail=f"Missing HR target in run session at {i}:{j}")

                if require_wu_cd:
                    struc = s.get("structure")
                    if not isinstance(struc, dict):
                        raise HTTPException(status_code=502, detail=f"Run session {i}:{j} must include structure")
                    wu = struc.get("warmup")
                    cd = struc.get("cooldown")
                    main = struc.get("main")
                    if not (isinstance(wu, dict) and isinstance(cd, dict) and isinstance(main, list) and len(main) > 0):
                        raise HTTPException(status_code=502, detail=f"Run session {i}:{j} must include warmup/main/cooldown")
                    if "minutes" in (wu or {}) and not isinstance(wu.get("minutes"), (int, float)):
                        raise HTTPException(status_code=502, detail=f"Warmup minutes invalid at {i}:{j}")
                    if "minutes" in (cd or {}) and not isinstance(cd.get("minutes"), (int, float)):
                        raise HTTPException(status_code=502, detail=f"Cooldown minutes invalid at {i}:{j}")

            if is_strength:
                ex = s.get("exercises")
                if not (isinstance(ex, list) and len(ex) >= 3):
                    raise HTTPException(status_code=502, detail=f"Strength session {i}:{j} must include exercises[]")
                for k, e in enumerate(ex):
                    if not isinstance(e, dict) or not e.get("name") or not isinstance(e.get("sets"), (int, float)):
                        raise HTTPException(status_code=502, detail=f"Exercise {i}:{j}:{k} must include name and sets")
                    if not (isinstance(e.get("reps"), (int, float)) or isinstance(e.get("seconds"), (int, float))):
                        raise HTTPException(status_code=502, detail=f"Exercise {i}:{j}:{k} must include reps or seconds")

    if must_start and n10[0]["day"] != must_start:
        raise HTTPException(status_code=502, detail=f"next_10_days must start at plan_start_date {must_start}")


@router.post("/analyze/{user_id}")
def coach_analyze(user_id: int, request: Request, payload: dict = Body(...)):
    try:
        norm = _normalize_payload(payload)
        weeks = norm["weeks"]

        ctx = coach_context(user_id, weeks=weeks)
        if not ctx.get("success"):
            raise HTTPException(status_code=500, detail="Context build failed")

        llm_input = {
            "schema_version": norm["schema_version"],
            "weeks": weeks,  # ← dôležité pre week_overview v AI
            "goal": norm["goal"],
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

        models = [DEFAULT_MODEL] + [m for m in FALLBACK_MODELS if m != DEFAULT_MODEL]
        parsed: Optional[Dict[str, Any]] = None
        debug_trace: Optional[Dict[str, Any]] = None

        # generate_plan_json už robí vlastné fallbacky naprieč modelmi
        parsed, debug_trace = generate_plan_json(llm_input, models[0], debug_raw=True, loose=False)

        if parsed is None:
            return {
                "success": False,
                "error": "AI generation failed (no parsed content).",
                "analysis_raw": (debug_trace or {}).get("raw"),
                "cleaned": (debug_trace or {}).get("cleaned"),
            }

        # validácia next_10_days – keď failne, neskončíme 5xx ale vrátime raw
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
            return {
                "success": False,
                "error": str(e),
                "analysis_raw": (debug_trace or {}).get("raw"),
                "cleaned": (debug_trace or {}).get("cleaned"),
                "ai_debug": slim_debug,
            }

        narr = build_progress_narrative(ctx, weeks)

        slim_debug = None
        if isinstance(debug_trace, dict):
            slim_debug = {
                "models_tried": debug_trace.get("models_tried"),
                "attempts": debug_trace.get("attempts"),
                "ok_model": debug_trace.get("ok_model"),
            }

        return {
            "success": True,
            "model": (slim_debug or {}).get("ok_model"),
            "analysis": parsed,
            "narrative": narr,
            "ai_debug": slim_debug,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))