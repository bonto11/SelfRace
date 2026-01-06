from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Tuple, Optional

from fastapi import HTTPException

from Schemas.coach_plan_daily import STRENGTH_EXERCISE_CATALOG
from Routes_DB.coach_strength_history import (
    db_get_strength_history_for_user,   # -> List[Dict]
    db_insert_strength_history_rows,    # -> int
)


# Slot -> kandidátne exercise_id z katalógu
SLOT_TO_EXERCISES: Dict[str, List[str]] = {
    "lower_quad": ["bodyweight_squat", "split_squat", "box_stepup"],
    "lower_posterior": ["single_leg_deadlift_band"],
    "core": ["plank", "side_plank", "abwheel_rollout"],
    "upper_pull": ["trx_row", "band_row"],
    "upper_push": ["pushup"],
}


def _require_jwt(user_jwt: Optional[str]) -> str:
    if not user_jwt:
        raise HTTPException(status_code=401, detail="Missing Authorization JWT")
    return user_jwt


def _has_equipment(ex: Dict[str, Any], available_equipment: List[str]) -> bool:
    eqs = ex.get("equipment") or []
    if "none" in eqs:
        return True
    return any(eq in available_equipment for eq in eqs)


def _normalize_history_dates(history: List[Dict[str, Any]]) -> None:
    """
    Upraví history in-place tak, aby session_date bol vždy date objekt.
    """
    for h in history:
        sd = h.get("session_date")
        if isinstance(sd, date):
            continue
        if isinstance(sd, str):
            # vezmi len prvých 10 znakov (YYYY-MM-DD) – keby tam bol timestamp
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
    history: List[Dict[str, Any]],
    today: date,
    lookback_days: int = 28,
) -> Dict[str, Any]:
    """
    Vyberie konkrétny cvik pre daný slot na základe:
      - kandidátov zo SLOT_TO_EXERCISES
      - dostupného vybavenia
      - histórie za posledných lookback_days (default 4 týždne)
    """

    candidate_ids = SLOT_TO_EXERCISES.get(slot, [])
    candidates = [ex for ex in STRENGTH_EXERCISE_CATALOG if ex["id"] in candidate_ids]

    # filter podľa vybavenia
    candidates = [ex for ex in candidates if _has_equipment(ex, available_equipment)]

    if not candidates:
        # fallback – ak nič nesedí, vráť prvý z katalógu (radšej niečo, než nič)
        return STRENGTH_EXERCISE_CATALOG[0]

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

        # base score
        score = 1.0

        # penalizácia za časté použitie (každý výskyt -0.4)
        score -= 0.4 * uses_count

        # bonus za to, že dlho nebol použitý
        if last_date is None:
            score += 1.0  # ešte nepoužitý za lookback
        else:
            days_since = (today - last_date).days
            score += min(days_since / 7 * 0.2, 1.0)  # +0.2 za týždeň, max +1.0

        scores.append((score, ex))

    scores.sort(key=lambda x: x[0], reverse=True)
    best_ex = scores[0][1]
    return best_ex


def enrich_daily_plan_with_strength_exercises(
    user_id: int,
    daily_plan: Dict[str, Any],
    *,
    available_equipment: List[str],
    today: date,
    weeks_back: int = 8,
    user_jwt: str,
) -> Dict[str, Any]:
    """
    Vezme AI daily_plan so strength_exercises slotmi a:
      - doplní ku každému slotu konkrétny exercise_id + exercise_name,
      - pripraví históriu na INSERT do DB,
      - vráti upravený daily_plan.

    RLS:
      - čítanie aj zápis coach_strength_history ide cez user_jwt.
    """
    jwt = _require_jwt(user_jwt)

    # 1) vytiahneme históriu cez RLS
    history = db_get_strength_history_for_user(
        user_id=user_id,
        weeks_back=weeks_back,
        user_jwt=jwt,
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
            for slot_item in slots:
                if not isinstance(slot_item, dict):
                    continue

                slot = slot_item.get("slot")
                if not slot:
                    continue

                sets = slot_item.get("sets")
                reps = slot_item.get("reps")
                rest_s = slot_item.get("rest_s")
                notes = slot_item.get("notes")

                ex = _pick_exercise_for_slot(
                    user_id=user_id,
                    slot=slot,
                    available_equipment=available_equipment,
                    history=history,
                    today=session_date,
                )

                enriched = {
                    "slot": slot,
                    "sets": sets,
                    "reps": reps,
                    "rest_s": rest_s,
                    "notes": notes,
                    "exercise_id": ex["id"],
                    "exercise_name": ex["name"],
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
        )

    return daily_plan