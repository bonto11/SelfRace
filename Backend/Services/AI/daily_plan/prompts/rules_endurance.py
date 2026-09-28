# Services/AI/daily_plan/prompts/rules_endurance.py
"""
Pravidlá pre obsah endurance (run/ride) sessions: HR/pace formát podľa
toho, či má athlete zóny, LTHR pravidlo pre threshold, interval block
formát, long run a intensity model (polarized/pyramidal).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from Services.AI.daily_plan.prompts.common import _format_pace


def check_has_zones(zones_data: Dict[str, Any]) -> bool:
    """Kontroluje či má user nastavené HR zóny."""
    for key, val in zones_data.items():
        if isinstance(val, dict):
            if val.get("z1_min") is not None or val.get("z1_max") is not None:
                return True
            if isinstance(val.get("zones"), list) and len(val["zones"]) > 0:
                return True
        elif key in ("z1_min", "z1_max") and val is not None:
            return True
    return False


def build_intensity_format_rule(
    has_zones: bool,
    latest_paces: Dict[str, Any],
    lthr: Optional[float] = None,
) -> str:
    """Zostaví inštrukciu pre formát intenzity + LTHR pravidlo pre threshold sessions."""
    lthr_rule = (
        f"- THRESHOLD RULE: LTHR = {int(lthr)} bpm = Z4/Z5 boundary. "
        "Threshold/Prahový sessions target Z4. NEVER prescribe Z3 for threshold sessions.\n"
        if lthr else ""
    )

    if not has_zones:
        return (
            lthr_rule +
            "- INTENSITY FORMATTING (NO ZONES): "
            "In `notes` fields for `warmup`, `main_part`, and `cooldown`, ALWAYS include BOTH RPE AND Pace (min/km) or Power (W). "
            "Example Format: 'RPE 3/10 @ 6:00-6:30 min/km'. "
            "Keep paces conservative for easy runs, warmups, and cooldowns.\n\n"
        )

    pace_parts = []
    for i in range(1, 6):
        val = latest_paces.get(f"z{i}_pace_s")
        if val is not None:
            pace_parts.append(f"Z{i}: {_format_pace(val)}")

    pace_instructions = (
        f"CRITICAL: When prescribing Pace for running, use these references: "
        f"{', '.join(pace_parts)}. Do not deviate by more than 5-10 sec/km unless hilly or trail-based.\n"
        if pace_parts else
        "CRITICAL: No pace history found. ESTIMATE realistic paces from recent load and athlete state. Keep it conservative.\n"
    )

    return (
        lthr_rule +
        "- INTENSITY FORMATTING (HAS ZONES): "
        "In `notes` for `warmup`, `main_part`, and `cooldown`, ALWAYS include BOTH Target HR range (bpm) AND Pace (min/km) or Power (W). "
        "CRITICAL HR RULE: DO NOT output the full zone width (e.g. '0-154 bpm'). "
        "Prescribe a narrower 10-15 bpm target window strictly WITHIN the zone bounds (e.g. '135-150 bpm'). "
        "Example: 'Z2 (145-155 bpm) @ 6:15 min/km'. "
        f"{pace_instructions}\n"
    )


def build_endurance_structure_rule() -> str:
    return (
        "- ENDURANCE STRUCTURE (RUN & RIDE): Provide `structure` with `warmup`, `main_part`, `cooldown`.\n"
        "  - `main_part` is ALWAYS an array. Each element is EITHER a steady block OR an interval block "
        "(you may mix both in the same array for progressive sessions, e.g. steady → interval → steady).\n\n"
        "- STEADY BLOCK FORMAT (single continuous effort): "
        '{ "minutes": number, "notes": "..." }. Use this for warmup-style ramps, tempo holds, '
        "or any single-effort segment that does not repeat.\n\n"
        "- INTERVAL BLOCK FORMAT (repeated work/rest, e.g. VO2max, threshold repeats, fartlek): "
        "You MUST use EXACTLY this shape, with these EXACT field names — do not rename, nest, or "
        "restructure them:\n"
        '{ "kind": "interval_block", "rounds": number, '
        '"work": { "minutes": number, "notes": "..." }, '
        '"rest": { "minutes": number, "notes": "..." } }\n'
        "  - `rounds` = how many times work+rest repeats (e.g. 6 for '6x3min hard, 2min easy').\n"
        "  - `work` = the hard/target-intensity portion. `rest` = the recovery portion between reps.\n"
        "  - If the session has NO recovery between reps (e.g. straight repeats with no rest), "
        "omit `rest` entirely rather than inventing a zero-duration one.\n"
        "  - NEVER use alternate field names like `repeats`, `intervals`, `work_min`, or nested variants — "
        "the app parses ONLY `rounds`, `work`, and `rest` exactly as specified above.\n\n"
    )


def build_long_run_rule(long_run_days: List[str]) -> str:
    # Podmienené (viď FIX ROOT CAUSE #2 v pôvodnom monolitickom prompts.py)
    # - platí len ak ATHLETE INSTRUCTIONS beh nevylúčili.
    return (
        f"- LONG RUN: Unless ATHLETE INSTRUCTIONS above exclude or restrict running, and if run is "
        f"the main sport, include 1 long run "
        f"(pref: {', '.join(long_run_days) if long_run_days else 'none'}). "
        "If running is excluded by ATHLETE INSTRUCTIONS, skip this rule entirely — do NOT schedule "
        "any long run, or any run, this week.\n\n"
    )


def build_intensity_model_line(intensity_model: str, has_zones: bool) -> str:
    return f"- INTENSITY MODEL: {intensity_model}. Use Zones: {has_zones}\n\n"


def build_training_blocks_line(blocks: Dict[str, bool]) -> str:
    active = ", ".join(k for k, v in blocks.items() if v) or "none"
    return f"- TRAINING BLOCKS: {active}.\n\n"
