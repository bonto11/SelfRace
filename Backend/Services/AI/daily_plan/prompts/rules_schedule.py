# Services/AI/daily_plan/prompts/rules_schedule.py
"""
Pravidlá pre rozvrhnutie týždňa naprieč športmi: rest days, two-a-day,
back-to-back hard, ktoré športy sú povolené a týždenný objem. Hovoria
len o tom KOĽKO a KEDY - obsah jednotlivej session rieši
rules_endurance.py / rules_strength.py.
"""

from __future__ import annotations

from typing import Any, List, Optional


def build_rest_days_rule(days_off: List[str]) -> str:
    if days_off:
        return (
            f"- REST DAYS (CRITICAL): Explicit days off: {', '.join(days_off)}. "
            "Schedule ONLY complete rest (sport='other', kind='rest', duration_min=0). No exceptions.\n\n"
        )
    return (
        "- REST DAYS & SPACING (CRITICAL): No explicit days off. "
        "MUST keep AT LEAST 1 DAY completely free. "
        "On rest day: one session with sport='other', kind='rest', duration_min=0. "
        "DO NOT schedule more than 3 consecutive training days without a rest day.\n\n"
    )


def build_two_a_day_rule(two_enabled: bool, two_cap: int) -> str:
    if two_enabled and two_cap > 0:
        return (
            f"- TWO-A-DAY: Max {two_cap} days/week can have 2 sessions. "
            "Use to group (e.g. Run + Strength) to free up rest days.\n\n"
        )
    return (
        "- TWO-A-DAY (CRITICAL): Max 0 days/week can have 2 sessions. "
        "FORBIDDEN from scheduling 2 sessions on same day. "
        "If too many workouts — DROP some. NEVER train 7 days a week.\n\n"
    )


def build_back_to_back_rule(avoid_back_to_back: bool) -> str:
    if avoid_back_to_back:
        return "- AVOID BACK-TO-BACK HARD: YES (Strict).\n"
    return "- AVOID BACK-TO-BACK HARD: Soft preference.\n"


def build_multi_sport_rule(final_sports_list: List[str], main_sport: str) -> str:
    other_sports = [s for s in final_sports_list if s != main_sport and s != "strength"]
    if not other_sports:
        return ""
    return (
        f"- MULTI-SPORT: Sports: {', '.join(final_sports_list)}. "
        f"Schedule {', '.join(other_sports)} sessions too — UNLESS ATHLETE INSTRUCTIONS above "
        "exclude one of these sports, in which case skip it entirely.\n\n"
    )


def build_sports_restriction_rule(final_sports_list: List[str]) -> str:
    return (
        f"- ALLOWED SPORTS (default, before athlete instructions): {', '.join(final_sports_list)}. "
        "ONLY populate sessions for listed sports. IMPORTANT: if ATHLETE INSTRUCTIONS above "
        "restrict or exclude one of these sports (including the main sport), that exclusion "
        "takes full priority over this list — remove the excluded sport from consideration "
        "entirely, do not just reduce it.\n\n"
    )


def build_weekly_volume_line(
    *,
    planned_minutes: Any,
    volume_mode: Optional[str],
    volume_value: Any,
    ext_minutes_total: int,
) -> str:
    if isinstance(planned_minutes, (int, float)):
        return (
            f"- WEEKLY VOLUME: Plan target is {planned_minutes} min. "
            f"External events: {ext_minutes_total} min. "
            "CRITICAL: NEVER exceed `athlete_state.ai_state.volume_tolerance.weekly_minutes_max`. "
            "If ATHLETE INSTRUCTIONS above exclude a sport, this volume target no longer applies "
            "to that sport's minutes — do not try to 'make up' the excluded sport's volume with it.\n"
        )
    if isinstance(volume_value, (int, float)) and volume_mode == "weekly_hours":
        tgt = int(volume_value * 60)
        return (
            f"- WEEKLY VOLUME: Long-term goal is {tgt} min/week. "
            f"External events: {ext_minutes_total} min. "
            "CRITICAL: NEVER exceed `athlete_state.ai_state.volume_tolerance.weekly_minutes_max`. "
            "If ATHLETE INSTRUCTIONS above exclude a sport, this volume target no longer applies "
            "to that sport's minutes.\n"
        )
    return (
        "- WEEKLY VOLUME: Infer from recent_load. "
        "DO NOT exceed `athlete_state.ai_state.volume_tolerance.weekly_minutes_max`. "
        "If ATHLETE INSTRUCTIONS above exclude a sport, do not compensate its volume with another sport.\n"
    )
