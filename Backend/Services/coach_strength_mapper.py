from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Tuple, Optional, Set

from Schemas.coach_plan_daily import STRENGTH_EXERCISE_CATALOG
from Routes_DB.coach_strength_history import (
    db_get_strength_history_for_user,  # -> List[Dict]
    db_insert_strength_history_rows,   # -> int
)
from Services.users import require_jwt


# Slot -> kandidátne exercise_id z katalógu
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
    """
    Filtruje kandidátov podľa vybavenia.

    - equipment_mode == "full_gym"  -> všetko povolené (ignorujeme zoznam).
    - inak:
        - ak cvik obsahuje "none", je vždy povolený,
        - ak available_equipment je prázdny, pustíme len home-friendly veci
          (none, resistance_bands, trx, abwheel, pullup_bar),
        - inak vyžadujeme intersect s available_equipment.
    """
    if equipment_mode == "full_gym":
        return True

    eqs = ex.get("equipment") or []
    if "none" in eqs:
        return True

    if not available_equipment:
        home_ok = {
            "none",
            "resistance_bands",
            "trx",
            "abwheel",
            "pullup_bar",
        }
        return any(e in home_ok for e in eqs)

    return any(e in available_equipment for e in eqs)


def _normalize_history_dates(history: List[Dict[str, Any]]) -> None:
    """
    Upraví history in-place tak, aby session_date bol vždy date objekt.
    """
    for h in history:
        sd = h.get("session_date")
        if isinstance(sd, date):
            continue
        if isinstance(sd, str):
            ds = sd[:10]
            try:
                h["session_date"] = date.fromisoformat(ds)
            except Exception:  # noqa: BLE001
                h["session_date"] = None
        else:
            h["session_date"] = None


def _pick_exercise_for_slot(
    user_id: int,  # zatiaľ nevyužité, nechávam pre budúce rozšírenia
    slot: str,
    available_equipment: List[str],
    equipment_mode: Optional[str],
    history: List[Dict[str, Any]],
    today: date,
    used_exercise_ids: Optional[Set[str]] = None,
    lookback_days: int = 28,
) -> Dict[str, Any]:
    """
    Vyberie konkrétny cvik pre daný slot na základe:
      - kandidátov zo SLOT_TO_EXERCISES
      - dostupného vybavenia + equipment_mode
      - histórie za posledných lookback_days
      - už použitých cvikov v danej session (used_exercise_ids)
    """

    candidate_ids = SLOT_TO_EXERCISES.get(slot, [])
    all_candidates = [ex for ex in STRENGTH_EXERCISE_CATALOG if ex["id"] in candidate_ids]

    # filter podľa vybavenia / režimu
    candidates = [
        ex
        for ex in all_candidates
        if _has_equipment(ex, available_equipment, equipment_mode)
    ]

    if not candidates:
        # fallback – ak nič nesedí, radšej prvý z all_candidates,
        # a ak ani tie nie sú, potom prvý z celého katalógu
        if all_candidates:
            return all_candidates[0]
        return STRENGTH_EXERCISE_CATALOG[0]

    cutoff = today - timedelta(days=lookback_days)
    used_exercise_ids = used_exercise_ids or set()

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

        # base score = effectiveness
        eff = float(ex.get("effectiveness", 1.0))
        score = eff

        # penalizácia za časté použitie v posledných týždňoch
        score -= 0.3 * uses_count

        # bonus za to, že dlho nebol použitý
        if last_date is None:
            score += 0.8
        else:
            days_since = (today - last_date).days
            score += min(days_since / 7 * 0.15, 0.8)

        # silná penalizácia ak už je v tej istej session
        if ex_id in used_exercise_ids:
            score -= 5.0

        scores.append((score, ex))

    scores.sort(key=lambda x: x[0], reverse=True)
    best_ex = scores[0][1]
    return best_ex


def enrich_daily_plan_with_strength_exercises(
    user_id: int,
    daily_plan: Dict[str, Any],
    *,
    available_equipment: List[str],
    equipment_mode: Optional[str] = None,
    today: date,
    weeks_back: int = 8,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Vezme AI daily_plan so strength_exercises slotmi a:
      - doplní ku každému slotu konkrétny exercise_id + exercise_name,
      - pripraví históriu na INSERT do DB,
      - vráti upravený daily_plan.

    equipment_mode:
      - "full_gym"    -> ignorujeme available_equipment, uprednostníme gym cviky.
      - "auto"/None   -> filtrujeme podľa available_equipment + home-friendly fallback.
      - ďalšie stringy môžeš použiť neskôr (napr. "home_only").
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    # 1) vytiahneme históriu
    history = db_get_strength_history_for_user(
        user_id=user_id,
        weeks_back=weeks_back,
        user_jwt=jwt,
        service=service,
    )
    _normalize_history_dates(history)

    new_history_rows: List[Dict[str, Any]] = []

    days = daily_plan.get("days") or []
    for day in days:
        date_str = day.get("date")
        try:
            session_date = date.fromisoformat(date_str[:10]) if date_str else today
        except Exception:  # noqa: BLE001
            session_date = today

        for idx, session in enumerate(day.get("sessions") or []):
            if session.get("sport") != "strength":
                continue

            struct = session.get("structure") or {}

            # 1) primárne z structure.strength_exercises
            slots = struct.get("strength_exercises")
            # 2) fallback: top-level strength_exercises z AI
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

                sets_val = slot_item.get("sets")
                reps_val = slot_item.get("reps")
                rest_s_val = slot_item.get("rest_s")
                notes_val = slot_item.get("notes")

                ex = _pick_exercise_for_slot(
                    user_id=user_id,
                    slot=slot,
                    available_equipment=available_equipment,
                    equipment_mode=equipment_mode,
                    history=history,
                    today=session_date,
                    used_exercise_ids=used_ids,
                )

                used_ids.add(ex["id"])

                enriched = {
                    "slot": slot,
                    "sets": sets_val,
                    "reps": reps_val,
                    "rest_s": rest_s_val,
                    "notes": notes_val,
                    "exercise_id": ex["id"],
                    "exercise_name": ex["name"],
                    # priestor do budúcna – napr. alternatívy
                }
                enriched_slots.append(enriched)

                history.append(
                    {
                        "user_id": user_id,
                        "session_date": session_date,
                        "slot": slot,
                        "exercise_id": ex["id"],
                    }
                )
                new_history_rows.append(
                    {
                        "user_id": user_id,
                        "session_date": session_date,
                        "plan_id": daily_plan.get("plan_id"),
                        "session_index": idx,
                        "slot": slot,
                        "exercise_id": ex["id"],
                    }
                )

            # zapíš späť do structure + voliteľne top-level
            session.setdefault("structure", {})["strength_exercises"] = enriched_slots
            session["strength_exercises"] = enriched_slots

    if new_history_rows:
        db_insert_strength_history_rows(
            new_history_rows,
            user_jwt=jwt,
            service=service,
        )

    return daily_plan