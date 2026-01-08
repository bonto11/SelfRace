# Services/AI_Athhlete_State/coach_plan_signals.py
from __future__ import annotations

from statistics import mean
from typing import Any, Dict, List, Optional


def compute_plan_adjustment_signals(
    analyze_input: Dict[str, Any],
    analysis: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Heuristika pre plan_adjustment.

    Vstup:
      - analyze_input: CoachAnalyzeInput (profil, recent_load, recovery, ...)
      - analysis: AI výstup z analyze_athlete_state (ai_state obsahuje tolerancie)
    """
    recent_load = analyze_input.get("recent_load") or {}
    recovery = analyze_input.get("recovery") or {}
    weeks = recent_load.get("weeks") or []

    soften_days: int = 0
    soften_reasons: List[str] = []
    should_replan_weekly: bool = False
    weekly_replan_reason: Optional[str] = None

    # --- 1) Weekly load: acute vs chronic (ACWR) ---
    acute_minutes: Optional[float] = None
    chronic_minutes: Optional[float] = None
    acwr: Optional[float] = None

    if isinstance(weeks, list) and len(weeks) >= 2:
        weeks_sorted = sorted(
            weeks,
            key=lambda w: str(w.get("week_start_iso") or ""),
        )
        last_week = weeks_sorted[-1]
        prev_weeks = weeks_sorted[:-1]

        acute_minutes = float(last_week.get("total_minutes") or 0.0)

        prev_tail = prev_weeks[-3:]
        prev_vals = [
            float(w.get("total_minutes") or 0.0)
            for w in prev_tail
            if isinstance(w.get("total_minutes"), (int, float))
        ]
        prev_vals = [v for v in prev_vals if v > 0]

        if prev_vals:
            chronic_minutes = mean(prev_vals)
            if chronic_minutes > 0:
                acwr = acute_minutes / chronic_minutes

    # --- 2) Recovery: HRV trend, RHR, spánok ---
    rhr = recovery.get("rhr_bpm")
    hrv_avg = recovery.get("hrv_avg")
    hrv_trend = recovery.get("hrv_trend")  # "up" | "down" | "stable" | None
    sleep_ok = recovery.get("sleep_ok")  # True/False/None

    if hrv_trend == "down" and isinstance(hrv_avg, (int, float)):
        soften_days = max(soften_days, 2)
        soften_reasons.append("HRV trend je smerom nadol")

    if sleep_ok is False:
        soften_days = max(soften_days, 1)
        soften_reasons.append("nedostatočný spánok")

    if isinstance(rhr, (int, float)) and rhr >= 70:
        soften_days = max(soften_days, 1)
        soften_reasons.append("zvýšený pokojový tep")

    # --- 3) Weekly load spike podľa ACWR ---
    if acwr is not None:
        if acwr >= 1.6:
            soften_days = max(soften_days, 3)
            soften_reasons.append(
                "prudký nárast týždennej záťaže (viac než ~60 % nad priemerom)"
            )
            should_replan_weekly = True
            weekly_replan_reason = (
                weekly_replan_reason
                or "prudký nárast týždennej záťaže, odporúčaná úprava týždenného plánu"
            )
        elif acwr >= 1.4:
            soften_days = max(soften_days, 2)
            soften_reasons.append(
                "výrazný nárast týždennej záťaže (okolo ~40 % nad priemerom)"
            )

    # --- 4) Hard sessions vs. AI tolerancia ---
    ai_state = analysis.get("ai_state") or {}
    intensity_tol = ai_state.get("intensity_tolerance") or {}
    hard_max = intensity_tol.get("hard_sessions_per_week_max")

    last_week_hard_sessions: Optional[int] = None
    if isinstance(weeks, list) and weeks:
        weeks_sorted2 = sorted(
            weeks, key=lambda w: str(w.get("week_start_iso") or "")
        )
        last_w = weeks_sorted2[-1]
        hs = last_w.get("hard_sessions")
        if isinstance(hs, int):
            last_week_hard_sessions = hs

    if isinstance(hard_max, (int, float)) and isinstance(last_week_hard_sessions, int):
        if last_week_hard_sessions > hard_max + 1:
            soften_days = max(soften_days, 2)
            soften_reasons.append(
                "bolo viac náročných tréningov, než odporúča intenzitná tolerancia"
            )
            if acwr is not None and acwr >= 1.3 and not should_replan_weekly:
                should_replan_weekly = True
                weekly_replan_reason = (
                    weekly_replan_reason
                    or "kombinácia príliš veľa ťažkých tréningov a zvýšenej záťaže"
                )

    # --- 5) Kombinácia: únavové signály + load spike ---
    if (
        (hrv_trend == "down" or sleep_ok is False)
        and acwr is not None
        and acwr >= 1.3
        and not should_replan_weekly
    ):
        should_replan_weekly = True
        weekly_replan_reason = (
            weekly_replan_reason
            or "zhoršená regenerácia a zvýšená záťaž, odporúčaná úprava týždenného plánu"
        )

    should_soften = soften_days > 0
    soften_reason_text = "; ".join(soften_reasons) if soften_reasons else None

    return {
        "soften_next_days": {
            "should_soften": should_soften,
            "days": soften_days if should_soften else None,
            "reason": soften_reason_text,
        },
        "should_replan_weekly": bool(should_replan_weekly),
        "weekly_replan_reason": weekly_replan_reason,
    }