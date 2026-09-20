# Services/AI/daily_plan/prompts/rules_special.py
"""Špeciálne inštrukcie podľa dôvodu generovania (generate_reason)."""

from __future__ import annotations

from typing import Optional


def build_special_reason_rule(reason: Optional[str]) -> str:
    """Vráti špeciálnu inštrukciu pre AI podľa dôvodu generovania."""
    if reason == "health_mild_restriction":
        return (
            "\n--- CRITICAL HEALTH RESTRICTION (MILD INJURY / ILLNESS) ---\n"
            "- Athlete reported a mild health issue or is recovering.\n"
            "- SIGNIFICANTLY REDUCE INTENSITY AND VOLUME.\n"
            "- NO VO2Max, Threshold, or heavy Sprint intervals.\n"
            "- ALL sessions MUST be easy (Z1/Z2 or RPE 2-4/10) or active recovery.\n"
            "- Cap ALL session durations to max 40-50 minutes. NO long runs.\n"
        )
    if reason == "manual_review":
        return (
            "\n--- ATHLETE REQUESTED ADJUSTMENT ---\n"
            "- Athlete requested manual plan evaluation via Activity Review.\n"
            "- Check latest Activity Review in 'athlete_state' and adjust upcoming sessions accordingly.\n"
        )
    if reason == "soften":
        return (
            "\n--- FATIGUE / SOFTEN REQUEST ---\n"
            "- Athlete's recent load is too high.\n"
            "- Replace hard intervals with easy endurance or active recovery.\n"
        )
    if reason in ("health_resolved", "health_resolved_return", "return_to_training"):
        return (
            "\n--- ⚠️ RETURN TO TRAINING (RECOVERED) ⚠️ ---\n"
            "- Athlete JUST RECOVERED from significant illness or injury.\n"
            "- CRITICAL: NO high intensity. ONLY Z1/Z2 for the ENTIRE week.\n"
            "- EXTRA REST DAYS (3 rest days instead of 1).\n"
            "- Reduce Strength goals if needed to keep load very light.\n"
            "- External events: include them but add strong warning to train at Z1/Z2 only.\n"
        )
    if reason == "refill_auto_extend":
        return (
            "\n--- ⚠️ PARTIAL WEEK REFILL (CRITICAL) ⚠️ ---\n"
            "- Week is ALREADY PARTIALLY COMPLETED.\n"
            "- Check 'recent_load' to see what was done THIS week.\n"
            "- Generate ONLY workouts for REMAINING days to reach weekly 'planned_minutes'.\n"
            "- Do NOT repeat session types already done this week.\n"
        )
    return ""
