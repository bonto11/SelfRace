# Services/coach_strength_mapper.py
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Tuple, Optional, Set

from Schemas.coach_plan_daily import STRENGTH_EXERCISE_CATALOG
from Routes_DB.coach_strength_history import (
    db_get_strength_history_for_user,
    db_insert_strength_history_rows,
)
from Modules.Supabase.auth import AuthCtx


SLOT_TO_EXERCISES: Dict[str, List[str]] = {
    "lower_quad": [
        "bodyweight_squat",
        "split_squat",
        "box_stepup",
        "barbell_back_squat",
        "leg_press_machine",
        "dumbbell_lunge_walk",
    ],
    "lower_posterior": [
        "glute_bridge_bodyweight",
        "single_leg_deadlift_band",
        "romanian_deadlift_barbell",
        "hip_thrust_barbell",
        "hamstring_curl_machine",
    ],
    "core": [
        "plank",
        "side_plank",
        "abwheel_rollout",
        "cable_chop",
        "hanging_knee_raise",
    ],
    "upper_pull": [
        "bodyweight_row",
        "trx_row",
        "band_row",
        "lat_pulldown_machine",
        "seated_row_machine",
        "pullup_assisted",
    ],
    "upper_push": [
        "pushup",
        "bench_press_barbell",
        "incline_db_press",
        "shoulder_press_dumbbell",
        "chest_press_machine",
        "dip_assisted",
    ],
}


def _has_equipment(
    ex: Dict[str, Any],
    available_equipment: List[str],
    equipment_mode: Optional[str],
) -> bool:
    if equipment_mode == "full_gym":
        return True

    eqs = ex.get("equipment") or []
    if "none" in eqs:
        return True

    if not available_equipment:
        home_ok = {"none", "resistance_bands", "trx", "abwheel", "pullup_bar"}
        return any(e in home_ok for e in eqs)

    return any(e in available_equipment for e in eqs)


def _normalize_history_dates(history: List[Dict[str, Any]]) -> None:
    for h in history:
        sd = h.get("session_date")
        if isinstance(sd, date):
            continue
        if isinstance(sd, str):
            ds = sd[:10]
            try:
                h["session_date"] = date.fromisoformat(ds)
            except Exception:
                h["session_date"] = None
        else:
            h["session_date"] = None


def _pick_exercise_for_slot(
    user_id: int,
    slot: str,
    available_equipment: List[str],
    equipment_mode: Optional[str],
    history: List[Dict[str, Any]],
    today: date,
    used_exercise_ids: Optional[Set[str]] = None,
    lookback_days: int = 28,
    # --- NEW: stability knobs ---
    rotation_days: int = 28,   # v akom okne berieme "aktuálny blok"
    min_keep_days: int = 14,   # minimálna doba, kedy cvik držíme stabilne
    rotate_after_uses: int = 0 # 0 = nepoužívať tento trigger; napr 6 = po 6 použitiach sa môže meniť
) -> Dict[str, Any]:
    candidate_ids = SLOT_TO_EXERCISES.get(slot, [])
    all_candidates = [ex for ex in STRENGTH_EXERCISE_CATALOG if ex["id"] in candidate_ids]

    candidates = [
        ex for ex in all_candidates
        if _has_equipment(ex, available_equipment, equipment_mode)
    ]

    if not candidates:
        if all_candidates:
            return all_candidates[0]
        return STRENGTH_EXERCISE_CATALOG[0]

    used_exercise_ids = used_exercise_ids or set()

    # ----------------------------
    # 1) STICKY selection per slot
    # ----------------------------
    # Nájdeme posledný cvik pre tento slot v "rotation_days" okne.
    rot_cutoff = today - timedelta(days=rotation_days)
    slot_rows: List[Tuple[date, str]] = []

    for h in history:
        if h.get("slot") != slot:
            continue
        sd = h.get("session_date")
        ex_id = h.get("exercise_id")
        if not ex_id:
            continue
        if isinstance(sd, date) and sd is not None and sd >= rot_cutoff:
            slot_rows.append((sd, str(ex_id)))

    if slot_rows:
        slot_rows.sort(key=lambda x: x[0])  # oldest -> newest
        first_date, first_ex = slot_rows[0]
        last_date, last_ex = slot_rows[-1]

        days_in_block = (today - first_date).days
        uses_in_block = len(slot_rows)
        days_since_last = (today - last_date).days

        # Ak ešte sme v "min_keep_days" alebo slot bol použitý nedávno, drž rovnaký cvik.
        # (Toto je presne to, čo chce fyzio: opakovať tie isté patterny 2x týždenne.)
        can_rotate_by_days = days_in_block >= min_keep_days
        can_rotate_by_uses = (rotate_after_uses > 0 and uses_in_block >= rotate_after_uses)

        should_keep = (not can_rotate_by_days and not can_rotate_by_uses) or (days_since_last <= 7)

        if should_keep:
            # vráť last_ex ak je stále kandidát + nie je už použitý v tomto sessione
            if last_ex not in used_exercise_ids:
                for ex in candidates:
                    if ex["id"] == last_ex:
                        return ex
            # ak last_ex je už použitý v sessione (duplicitný), skúsi first_ex ako fallback
            if first_ex not in used_exercise_ids:
                for ex in candidates:
                    if ex["id"] == first_ex:
                        return ex

    # ----------------------------------------
    # 2) Fallback scoring (rotation mechanism)
    # ----------------------------------------
    cutoff = today - timedelta(days=lookback_days)

    scores: List[Tuple[float, Dict[str, Any]]] = []
    for ex in candidates:
        ex_id = ex["id"]

        uses_dates: List[date] = []
        for h in history:
            if h.get("exercise_id") != ex_id:
                continue
            sd = h.get("session_date")
            if isinstance(sd, date) and sd is not None and sd >= cutoff:
                uses_dates.append(sd)

        uses_count = len(uses_dates)
        last_date = max(uses_dates) if uses_dates else None

        eff = float(ex.get("effectiveness", 1.0))
        score = eff

        # dôležité: znížime penalizáciu, aby sa to "neprehadzovalo" stále
        score -= 0.10 * uses_count  # bolo 0.3 (príliš agresívne)

        if last_date is None:
            score += 0.8
        else:
            days_since = (today - last_date).days
            score += min((days_since / 7) * 0.15, 0.8)

        if ex_id in used_exercise_ids:
            score -= 5.0

        scores.append((score, ex))

    scores.sort(key=lambda x: x[0], reverse=True)
    return scores[0][1]

def enrich_daily_plan_with_strength_exercises(
    user_id: int,
    daily_plan: Dict[str, Any],
    *,
    available_equipment: List[str],
    equipment_mode: Optional[str] = None,
    today: date,
    weeks_back: int = 8,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    # normalize equipment
    if not isinstance(available_equipment, list):
        available_equipment = []
    available_equipment = [str(x) for x in available_equipment if x]

    history = db_get_strength_history_for_user(
        user_id=user_id,
        weeks_back=weeks_back,
        ctx=ctx,
    ) or []
    _normalize_history_dates(history)

    new_history_rows: List[Dict[str, Any]] = []

    days = daily_plan.get("days") or []
    for day in days:
        date_str = day.get("date")
        try:
            session_date = date.fromisoformat(str(date_str)[:10]) if date_str else today
        except Exception:
            session_date = today

        sessions = day.get("sessions") or []
        for idx, session in enumerate(sessions):
            if session.get("sport") != "strength":
                continue

            struct = session.get("structure") or {}
            slots = struct.get("strength_exercises")

            if not isinstance(slots, list) or not slots:
                slots = session.get("strength_exercises") or []

            if not isinstance(slots, list) or not slots:
                continue

            enriched_slots: List[Dict[str, Any]] = []
            used_ids: Set[str] = set()

            for slot_item in slots:
                if not isinstance(slot_item, dict):
                    continue

                slot = slot_item.get("slot")
                if not slot:
                    continue

                ex = _pick_exercise_for_slot(
                    user_id=user_id,
                    slot=str(slot),
                    available_equipment=available_equipment,
                    equipment_mode=equipment_mode,
                    history=history,
                    today=session_date,
                    used_exercise_ids=used_ids,
                )
                used_ids.add(ex["id"])

                enriched = {
                    "slot": slot_item.get("slot"),
                    "sets": slot_item.get("sets"),
                    "reps": slot_item.get("reps"),
                    "rest_s": slot_item.get("rest_s"),
                    "notes": slot_item.get("notes"),
                    "exercise_id": ex["id"],
                    "exercise_name": ex["name"],
                }
                enriched_slots.append(enriched)

                # update in-memory history so next picks avoid repeats
                history.append(
                    {
                        "user_id": user_id,
                        "session_date": session_date,
                        "slot": slot,
                        "exercise_id": ex["id"],
                    }
                )

                row = {
                    "user_id": user_id,
                    "session_date": session_date,
                    "session_index": idx,
                    "slot": slot,
                    "exercise_id": ex["id"],
                }
                plan_id = daily_plan.get("plan_id")
                if plan_id:
                    row["plan_id"] = plan_id
                new_history_rows.append(row)

            session.setdefault("structure", {})["strength_exercises"] = enriched_slots
            session["strength_exercises"] = enriched_slots

    if new_history_rows:
        db_insert_strength_history_rows(
            new_history_rows,
            ctx=ctx,
        )

    return daily_plan