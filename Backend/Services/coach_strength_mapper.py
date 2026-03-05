# Services/coach_strength_mapper.py
from __future__ import annotations
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Set

from Modules.Supabase.auth import AuthCtx
from Routes_DB.coach_strength_history import (
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

    # Ak nie je explicitne definovane vybavenie, berieme zakladne home veci
    if not available_equipment:
        home_basic = {"none", "resistance_bands", "trx", "abwheel", "pullup_bar"}
        return any(e in home_basic for e in eqs)

    return any(e in available_equipment for e in eqs)


def prepare_strength_context_for_ai(
    user_id: int,
    *,
    available_equipment: List[str],
    equipment_mode: Optional[str],
    injuries: List[Dict[str, Any]],
    disliked_exercises: List[str],  # Zoznam neziaducich IDciek
    ctx: AuthCtx
) -> Dict[str, Any]:
    """
    Vygeneruje inteligentné "Menu" cvikov pre AI na základe vybavenia a histórie.
    Toto menu sa priloží k payloadu pre OpenAI.
    """
    
    # 1. Zisti históriu za posledné 4 týždne
    history = db_get_strength_history_for_user(
        user_id=user_id,
        weeks_back=4,
        ctx=ctx
    ) or []
    
    # Množina cvikov, ktoré cvičil v poslednej dobe
    recent_ex_ids = {h.get("exercise_id") for h in history if h.get("exercise_id")}
    
    # 2. Skontroluj, či existujú nejaké aktívne zranenia
    has_injury = len(injuries) > 0

    menu: Dict[str, List[Dict[str, Any]]] = {
        "core": [],
        "lower_quad": [],
        "lower_posterior": [],
        "lower_calves": [], 
        "upper_push": [],
        "upper_pull": []
    }

    # 3. Filtrovanie a budovanie menu
    for ex in STRENGTH_EXERCISE_CATALOG:
        ex_id = ex["id"]
        target = ex["target"]

        # Filter A: Znechutené/Nechcené cviky
        if ex_id in disliked_exercises:
            continue

        # Filter B: Dostupné vybavenie
        if not _is_equipment_available(ex, available_equipment, equipment_mode):
            continue

        # Pripravíme objekt, ktorý pošleme AI (čím menej balastu, tým lepšie pre tokeny)
        ex_payload = {
            "id": ex_id,
            "name": ex["name_en"]
        }

        # Ak má zranenie, posielame všetko vhodné z vybavenia, neriešime rotáciu
        if has_injury:
            menu[target].append(ex_payload)
            continue

        # Logika pre udržanie stability (Rotation Logic):
        # Ak cvik cvičil nedávno, odporučíme ho AI ako primárnu voľbu pre stabilitu.
        if ex_id in recent_ex_ids:
            ex_payload["suggestion"] = "recent_use_keep_for_stability"
            menu[target].insert(0, ex_payload) # Dáme ho na vrch zoznamu
        else:
            menu[target].append(ex_payload)

    # 4. Priložíme pokyny pre AI priamo do kontextu
    instructions = (
        "This is the allowed exercise catalog. You MUST ONLY use 'id' from this catalog in your JSON. "
        "If the user has NO injuries, prioritize exercises with 'suggestion': 'recent_use_keep_for_stability' "
        "to ensure progression. If the user HAS injuries, completely ignore stability suggestions and pick "
        "the absolute safest exercises from this list suitable for their condition."
    )

    return {
        "instructions": instructions,
        "available_catalog": menu
    }


def extract_and_save_ai_strength_history(
    user_id: int,
    plan_id: str,
    ai_daily_plan: Dict[str, Any],
    ctx: AuthCtx
) -> int:
    """
    Prejde vrátený vygenerovaný JSON od AI, vyextrahuje použité cviky 
    a uloží ich do databázy histórie, aby sme o nich vedeli o týždeň.
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
                
                # AI by mala vracať cviky v týchto troch poliach
                blocks_to_check = ["activation", "main_part", "add_ons"]
                
                for block_name in blocks_to_check:
                    exercises_in_block = structure.get(block_name, [])
                    
                    for ex in exercises_in_block:
                        ex_id = ex.get("exercise_id")
                        if not ex_id:
                            continue
                            
                        # Lookup cieľového svalu (target) z nášho lokálneho katalógu
                        target_slot = block_name  # fallback ak nenajde
                        for catalog_item in STRENGTH_EXERCISE_CATALOG:
                            if catalog_item["id"] == ex_id:
                                target_slot = catalog_item["target"]
                                break
                                
                        new_history_rows.append({
                            "user_id": user_id,
                            "plan_id": plan_id,
                            "session_date": day_date,
                            "session_index": session_idx,
                            "slot": target_slot,  # napr. 'lower_quad'
                            "exercise_id": ex_id
                        })
                        
    if new_history_rows:
        return db_insert_strength_history_rows(new_history_rows, ctx=ctx)
    return 0