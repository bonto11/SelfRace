# Services/coach_strength_mapper.py
from __future__ import annotations
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Set

from Modules.Supabase.auth import AuthCtx
from DB.coach_strength_history import (
    db_get_strength_history_for_user,
    db_insert_strength_history_rows
)
from Configs.strength_catalog import STRENGTH_EXERCISE_CATALOG


def _is_equipment_available(
    exercise: Dict[str, Any],
    available_equipment: List[str],
    equipment_mode: Optional[str]
) -> bool:
    if equipment_mode == "full_gym":
        return True

    eqs = exercise.get("equipment") or []
    if "none" in eqs:
        return True

    if not available_equipment:
        home_basic = {"none", "resistance_bands", "trx", "abwheel", "pullup_bar"}
        return any(e in home_basic for e in eqs)

    return any(e in available_equipment for e in eqs)


def _is_loaded_exercise(exercise: Dict[str, Any]) -> bool:
    """
    🌟 NOVÉ: True ak cvik VIE byť vykonaný so záťažou (nie je čisto
    bodyweight-only). Rieši root cause problému, keď full_gym user
    dostával takmer výhradne bodyweight/prehab cviky - katalóg aj
    inštrukcie doteraz vôbec nerozlišovali "loaded" vs "bodyweight-only",
    takže AI nemala žiadny signál uprednostniť záťažové zložené cviky
    v hlavnej časti tréningu, keď má user full gym k dispozícii.
    """
    eqs = exercise.get("equipment") or []
    return eqs != ["none"]


def prepare_strength_context_for_ai(
    user_id: int,
    *,
    available_equipment: List[str],
    equipment_mode: Optional[str],
    injuries: List[Dict[str, Any]],
    disliked_exercises: List[str],
    ctx: AuthCtx
) -> Dict[str, Any]:
    """
    Vygeneruje inteligentné "Menu" cvikov pre AI na základe vybavenia a histórie.
    Toto menu sa priloží k payloadu pre OpenAI.
    """

    history = db_get_strength_history_for_user(
        user_id=user_id,
        weeks_back=4,
        ctx=ctx
    ) or []

    recent_ex_ids = {h.get("exercise_id") for h in history if h.get("exercise_id")}

    has_injury = len(injuries) > 0

    # 🌟 NOVÉ: pridaná kategória "functional" (Hyrox/OCR/triatlon)
    menu: Dict[str, List[Dict[str, Any]]] = {
        "core": [],
        "lower_quad": [],
        "lower_posterior": [],
        "lower_calves": [],
        "upper_push": [],
        "upper_pull": [],
        "functional": [],
    }

    for ex in STRENGTH_EXERCISE_CATALOG:
        ex_id = ex["id"]
        target = ex["target"]

        if ex_id in disliked_exercises:
            continue

        if not _is_equipment_available(ex, available_equipment, equipment_mode):
            continue

        ex_payload = {
            "id": ex_id,
            "name": ex["name_en"],
            # 🌟 NOVÉ: explicitný signál pre AI, či ide o záťažový cvik
            "loaded": _is_loaded_exercise(ex),
        }

        if has_injury:
            menu[target].append(ex_payload)
            continue

        if ex_id in recent_ex_ids:
            ex_payload["suggestion"] = "recent_use_keep_for_stability"
            menu[target].insert(0, ex_payload)
        else:
            menu[target].append(ex_payload)

    # 🌟 NOVÉ: equipment_mode ide priamo do inštrukcií aj ako dáta, a
    # inštrukcie teraz explicitne hovoria AI, aby pri full_gym/minimal
    # uprednostnila záťažové zložené cviky v hlavnej časti tréningu.
    equipment_mode_safe = equipment_mode or "unknown"

    if has_injury:
        priority_instructions = (
            "The athlete has an active injury. Completely ignore load/progression "
            "preferences below - pick the absolute safest exercises from this list "
            "suitable for their condition, regardless of 'loaded' status."
        )
    elif equipment_mode_safe in ("full_gym", "minimal"):
        priority_instructions = (
            f"Equipment mode is '{equipment_mode_safe}'. The athlete has access to external "
            "load (barbell/dumbbell/kettlebell/machine/cable). For 'strength_main_part', you "
            "MUST primarily select exercises with 'loaded': true - prioritize compound "
            "barbell/dumbbell lifts (squat, deadlift, press, row family) to build real strength "
            "via progressive overload. Reserve exercises with 'loaded': false (bodyweight-only, "
            "e.g. plank, bird-dog, glute bridge) mainly for 'activation' and light 'add_ons' "
            "blocks, NOT as the main content of the session - a strength session dominated by "
            "bodyweight-only exercises when full gym equipment is available is a planning error. "
            "If the athlete has NOT trained an exercise marked 'suggestion': "
            "'recent_use_keep_for_stability' recently, still prefer 'loaded': true options over "
            "bodyweight ones of similar target."
        )
    else:
        priority_instructions = (
            f"Equipment mode is '{equipment_mode_safe}' (limited/no equipment). Build the "
            "session from what is available in this catalog - bodyweight and minimal-equipment "
            "exercises are the correct, expected choice here, not a compromise."
        )

    instructions = (
        "This is the allowed exercise catalog. You MUST ONLY use 'id' from this catalog in your JSON. "
        "If the user has NO injuries, prioritize exercises with 'suggestion': 'recent_use_keep_for_stability' "
        "to ensure progression, but this ranking is secondary to the load-priority rule below. "
        + priority_instructions
    )

    return {
        "instructions": instructions,
        "equipment_mode": equipment_mode_safe,
        "available_catalog": menu
    }

def extract_and_save_ai_strength_history(
    user_id: int,
    ai_daily_plan: Dict[str, Any],
    ctx: AuthCtx
) -> int:
    """
    Prejde vrátený vygenerovaný JSON od AI, vyextrahuje použité cviky 
    a uloží ich do databázy histórie.
    """
    new_history_rows = []
    
    days = ai_daily_plan.get("days", [])
    for day in days:
        day_date = day.get("date")
        sessions = day.get("sessions", [])
        
        for session_idx, session in enumerate(sessions):
            # Zaujímajú nás iba silové tréningy
            if session.get("sport") == "strength":
                structure = session.get("structure", {})
                
                # Skontrolujeme všetky možné bloky, kde môžu byť cviky
                blocks_to_check = ["activation", "strength_main_part", "main_part", "add_ons"]
                
                for block_name in blocks_to_check:
                    exercises_in_block = structure.get(block_name, [])
                    
                    if not exercises_in_block or not isinstance(exercises_in_block, list):
                        continue
                        
                    for ex in exercises_in_block:
                        ex_id = ex.get("exercise_id")
                        if not ex_id:
                            continue
                            
                        target_slot = block_name  # fallback
                        
                        # Prechádzame plochý list katalógu priamo, bez .values()
                        for item in STRENGTH_EXERCISE_CATALOG:
                            if item.get("id") == ex_id:
                                target_slot = item.get("target", block_name)
                                break
                                
                        new_history_rows.append({
                            "user_id": user_id,
                            "session_date": day_date,
                            "session_index": session_idx,
                            "slot": target_slot,
                            "exercise_id": ex_id
                        })
                        
    if new_history_rows:
        return db_insert_strength_history_rows(new_history_rows, ctx=ctx)
    return 0