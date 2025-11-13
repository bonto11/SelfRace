from typing import Any, Dict, Optional, List

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
    """
    Normalizuje payload z FE na interný tvar pre coach_context + AI.

    Podporuje:
      - nový kontrakt (schema_version >= 2):
          {
            schema_version: 2,
            goal: { goal_kind, weeks, start_date },
            sports: { main_sport, secondary_mix },
            targets, rules, externals, injuries, focus, intensity_model, blocks,
            plan_start_date, strength_settings, ...
          }
      - starý kontrakt s goal_structured.*
    """
    schema_version = int(payload.get("schema_version") or 1)

    goal_block = payload.get("goal") or {}
    sports_block = payload.get("sports") or {}

    # --- weeks ---
    weeks = int(
        payload.get("weeks")
        or goal_block.get("weeks")
        or 6
    )

    # --- goal string ---
    raw_goal = payload.get("goal")
    if isinstance(raw_goal, dict) and (
        "goal_kind" in raw_goal or "weeks" in raw_goal or "start_date" in raw_goal
    ):
        goal_str = (raw_goal.get("goal_kind") or "improve_overall")
    else:
        goal_str = _norm_goal(raw_goal)

    # --- primary_sports / main_sport / secondary_mix ---
    primary_sports = (
        payload.get("primary_sports")
        or None
    )

    main_sport = (
        payload.get("main_sport")
        or sports_block.get("main_sport")
    )

    secondary_mix = (
        payload.get("secondary_mix")
        or sports_block.get("secondary_mix")
    )

    if not primary_sports:
        ps: List[str] = []
        if main_sport:
            ps.append(main_sport)
        if isinstance(secondary_mix, list):
            for item in secondary_mix:
                s = (item or {}).get("sport")
                if s and s not in ps:
                    ps.append(s)
        primary_sports = ps or ["run", "ride", "strength"]

    persona = payload.get("persona")

    # --- targets / rules / externals / injuries / focus ---
    targets = payload.get("targets")
    rules = payload.get("rules")
    externals = payload.get("externals") or []
    injuries = payload.get("injuries") or []

    if "focus" in payload and isinstance(payload.get("focus"), dict):
        focus_in = payload["focus"]
        focus = {
            "areas": focus_in.get("areas") or [],
            "avoid_zones": focus_in.get("avoid_zones") or [],
            "rehab": focus_in.get("rehab"),
        }


    # --- plan_start_date / strength_settings ---
    plan_start_date = (
        payload.get("plan_start_date")
        or goal_block.get("start_date")
    )

    strength_settings = payload.get("strength_settings")

    # --- intensity model / blocks ---
    intensity_model = payload.get("intensity_model")
    if intensity_model is None:
        intensity_model = "polarized"


    blocks = payload.get("blocks")
    if blocks is None:
        blocks = {
            "vo2max": True,
            "ftp": True,
            "threshold": True,
        }

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

        models = [DEFAULT_MODEL] + [m for m in FALLBACK_MODELS if m != DEFAULT_MODEL]
        parsed: Optional[Dict[str, Any]] = None
        debug_trace: Optional[Dict[str, Any]] = None
        used_model: Optional[str] = None

        # generate_plan_json už sám robí fallbacky, tu stačí prvý model (alebo cyklus, ak chceš)
        for m in models:
            candidate, trace = generate_plan_json(llm_input, m, debug_raw=True, loose=False)
            parsed = candidate
            debug_trace = trace
            used_model = (trace or {}).get("ok_model") or m
            break

        if parsed is None:
            # Teoreticky by sa nemalo stať, ale nech je to kryté
            return {
                "success": False,
                "error": "AI generation failed (no parsed content).",
                "analysis_raw": (debug_trace or {}).get("raw"),
                "cleaned": (debug_trace or {}).get("cleaned"),
            }

        # validácia next_10_days – keď failne, NEháčeme HTTP error, ale vrátime raw
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

        # pri úspechu pošleme LEN malý debug (bez contextu, bez promptov, bez raw)
        slim_debug = None
        if isinstance(debug_trace, dict):
            slim_debug = {
                "models_tried": debug_trace.get("models_tried"),
                "attempts": debug_trace.get("attempts"),
                "ok_model": debug_trace.get("ok_model"),
            }

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
        raise HTTPException(status_code=500, detail=str(e))