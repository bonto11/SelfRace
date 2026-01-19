# Services/AI/athlete_state_signals.py
from __future__ import annotations

from statistics import mean
from typing import Any, Dict, List, Optional


def _to_float(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except Exception:
        return None


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

    def _week_sort_key(w: Dict[str, Any]) -> str:
        return str(w.get("week_start_iso") or w.get("week_start") or "")

    # Heuristika: skúsi zistiť, či je týždeň kompletný (ak máš také polia).
    def _is_week_complete(w: Dict[str, Any]) -> Optional[bool]:
        for k in ("is_complete", "is_complete_week", "complete_week"):
            v = w.get(k)
            if isinstance(v, bool):
                return v
        # niektoré implementácie majú "days_covered"
        dc = w.get("days_covered") or w.get("days_count")
        if isinstance(dc, (int, float)):
            return float(dc) >= 6
        return None

    if isinstance(weeks, list) and len(weeks) >= 2:
        weeks_sorted = sorted([w for w in weeks if isinstance(w, dict)], key=_week_sort_key)
        if len(weeks_sorted) >= 2:
            last_week = weeks_sorted[-1]
            prev_weeks = weeks_sorted[:-1]

            # ak vieme, že posledný týždeň je nekompletný, ber predposledný
            last_complete = _is_week_complete(last_week)
            if last_complete is False and len(weeks_sorted) >= 3:
                last_week = weeks_sorted[-2]
                prev_weeks = weeks_sorted[:-2]

            acute_minutes = _to_float(last_week.get("total_minutes")) or 0.0

            prev_tail = prev_weeks[-3:]
            prev_vals = [
                _to_float(w.get("total_minutes"))
                for w in prev_tail
                if isinstance(w, dict)
            ]
            prev_vals = [v for v in prev_vals if isinstance(v, (int, float)) and v > 0]

            if prev_vals:
                chronic_minutes = mean(prev_vals)
                if chronic_minutes and chronic_minutes > 0:
                    acwr = acute_minutes / chronic_minutes

            # extra guard: keď je "acute" extrémne malé (typicky rozbehnutý týždeň),
            # ACWR radšej ignoruj, aby to nerobilo false alarms.
            if chronic_minutes and chronic_minutes > 0 and acute_minutes < 0.5 * chronic_minutes:
                acwr = None

    # --- 2) Recovery: HRV trend, RHR, spánok ---
    rhr = recovery.get("rhr_bpm")
    hrv_trend = recovery.get("hrv_trend")  # "up" | "down" | "stable" | None
    sleep_ok = recovery.get("sleep_ok")  # True/False/None

    # HRV: reaguj na trend aj bez hrv_avg
    if hrv_trend == "down":
        soften_days = max(soften_days, 2)
        soften_reasons.append("HRV trend je smerom nadol")

    if sleep_ok is False:
        soften_days = max(soften_days, 1)
        soften_reasons.append("nedostatočný spánok")

    # RHR: preferuj relatívne voči baseline, fallback na rozumný absolútny prah
    rhr_f = _to_float(rhr)
    rhr_base = (
        _to_float(recovery.get("rhr_baseline"))
        or _to_float(recovery.get("rhr_baseline_bpm"))
        or _to_float(recovery.get("rhr_7d_avg"))
        or _to_float(recovery.get("rhr_14d_avg"))
        or _to_float(recovery.get("rhr_28d_avg"))
    )

    if isinstance(rhr_f, (int, float)) and rhr_f > 0:
        # relatívny prah: +8 bpm nad baseline (pri endurance športoch veľmi rozumné)
        if isinstance(rhr_base, (int, float)) and rhr_base > 0:
            delta = rhr_f - rhr_base
            if delta >= 12:
                soften_days = max(soften_days, 2)
                soften_reasons.append("pokojový tep je výrazne vyšší než tvoj baseline")
            elif delta >= 8:
                soften_days = max(soften_days, 1)
                soften_reasons.append("pokojový tep je vyšší než tvoj baseline")
        else:
            # fallback: konzervatívny absolútny prah (70 bolo príliš vysoko pre veľa runnerov)
            if rhr_f >= 65:
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
        weeks_sorted2 = sorted([w for w in weeks if isinstance(w, dict)], key=_week_sort_key)
        if weeks_sorted2:
            last_w = weeks_sorted2[-1]
            # ak je nekompletný týždeň a máme predposledný, zober predposledný
            last_complete2 = _is_week_complete(last_w)
            if last_complete2 is False and len(weeks_sorted2) >= 2:
                last_w = weeks_sorted2[-2]

            hs = last_w.get("hard_sessions")
            if isinstance(hs, int):
                last_week_hard_sessions = hs

    if isinstance(hard_max, (int, float)) and isinstance(last_week_hard_sessions, int):
        if last_week_hard_sessions > int(hard_max):
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