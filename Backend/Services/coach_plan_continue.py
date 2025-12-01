# Services/coach_plan_continue.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import date as _date, timedelta

from Configs.config import DEFAULT_MODEL

from Routes_DB.coach_plan_log import (
    db_insert_planned_sessions,
)

from Routes_FE.coach_context import coach_context
from Services.plan_generation import generate_plan_json
from Services.coach_plan_log import (
    service_canonical_sport,
    service_hr_zone_text,
)
from Services.coach_plan_extend import (
    _detect_active_plan_horizon,
    _compute_no_sessions_on,
    _fix_offdays_and_per_day_limit,
)

def service_continue_active_plan(
    user_id: int,
    min_horizon_days: int = 10,
) -> Dict[str, Any]:
    """
    Pokračovanie v aktívnom pláne (AI doplní ďalšie dni tak, aby
    bol horizon aspoň `min_horizon_days` dní dopredu).

    - nájde aktívny plan_id
    - zistí dokedy je plán
    - ak horizon >= min_horizon_days → nič nerobí
    - inak zavolá AI a doplní nové dni do toho istého plan_id
    """
    if min_horizon_days < 1:
        min_horizon_days = 1

    # 1) zisti aktívny plán
    plan_id, start_iso, end_iso, horizon_days = _detect_active_plan_horizon(user_id)

    today = _date.today()

    if horizon_days >= min_horizon_days:
        print(
            f"[SERVICE-PLAN-CONTINUE] already sufficient "
            f"user={user_id} plan_id={plan_id} horizon={horizon_days}"
        )
        return {
            "plan_id": plan_id,
            "extended_days": 0,
            "inserted_sessions": 0,
            "old_end": end_iso,
            "new_end": end_iso,
            "horizon_days": horizon_days,
            "need_days": 0,
            "note": "already_sufficient",
        }

    # koľko dní reálne potrebujeme doplniť
    need_days = max(1, min_horizon_days - horizon_days)

    try:
        old_end_d = _date.fromisoformat(end_iso)
    except Exception:
        old_end_d = today

    # začiatok continue bloku – od nasledujúceho dňa po konci plánu, ale min. od dnes
    start_extend_d = max(today, old_end_d + timedelta(days=1))
    new_start_iso = start_extend_d.isoformat()

    # originálny začiatok cyklu (pre info o tom, v ktorom týždni sme)
    plan_start_iso = start_iso

    print(
        f"[SERVICE-PLAN-CONTINUE] continue user={user_id} plan_id={plan_id} "
        f"need_days={need_days} new_start={new_start_iso}"
    )

    # 2) načítaj context (rovnaký engine ako pri /coach/analyze)
    ctx = coach_context(user_id, weeks=12)
    if not ctx.get("success", False):
        raise ValueError("coach_context failed for continue_active_plan.")

    prefs = ctx.get("prefs") or {}
    if not isinstance(prefs, dict):
        prefs = {}

    weeks = int(prefs.get("weeks") or 6)
    if weeks < 1:
        weeks = 6

    rules = prefs.get("rules") or {}
    if not isinstance(rules, dict):
        rules = {}

    days_off = rules.get("days_off") or []
    externals = prefs.get("externals") or []

    avoid_two_a_day = bool(rules.get("avoid_two_a_day", True))

    weekly = ctx.get("weekly") or {}
    weekly_weeks = weekly.get("weeks") or []
    hr_used = weekly.get("hr_used") or {}

    zones_payload = ctx.get("zones") or prefs.get("zones") or {}

    # OFF dni pre continue blok (počítaj od new_start_iso, horizon = weeks*7)
    no_sessions_on = _compute_no_sessions_on(
        plan_start_iso=new_start_iso,
        weeks=weeks,
        days_off=days_off,
        externals=externals,
    )

    # --- v ktorom týždni cyklu sme? (podľa pôvodného start_iso) ---
    cycle_week_index: Optional[int] = None
    try:
        start_d = _date.fromisoformat(plan_start_iso[:10])
        delta_days = (today - start_d).days
        if delta_days >= 0:
            cycle_week_index = (delta_days // 7) + 1
    except Exception:
        cycle_week_index = None
    # --------------------------------------------------------------

    # 3) vstup pre LLM – podobné ako coach_analyze, ale s info o "cycle"
    first_n_days = max(7, min(10, need_days))

    llm_input = {
        "goal": prefs.get("goal_kind") or prefs.get("goal") or "improve_overall",
        "schema_version": 1,
        "primary_sports": prefs.get("primary_sports") or ["run", "ride", "strength"],
        "persona": prefs.get("persona"),
        "main_sport": prefs.get("main_sport"),
        "secondary_mix": prefs.get("secondary_mix") or [],
        "targets": prefs.get("targets"),
        "rules": rules,
        "externals": externals,
        "injuries": prefs.get("injuries") or [],
        "focus": prefs.get("focus") or {},
        "intensity_model": prefs.get("intensity_model"),
        "blocks": prefs.get("blocks"),
        # DÔLEŽITÉ: generuj od new_start_iso, nie od pôvodného začiatku
        "plan_start_date": new_start_iso,
        "strength_settings": prefs.get("strength_settings"),
        "first_n_days": first_n_days,
        "weeks": weeks,
        "hr_used": hr_used,
        "weekly": (
            weekly_weeks[-weeks:] if weeks <= len(weekly_weeks) else weekly_weeks
        ),
        "recovery": (ctx.get("recovery") or [])[-21:],
        "notes": (ctx.get("notes") or [])[-50:],
        "thresholds": ctx.get("thresholds") or [],
        "zones": zones_payload,
        "prefs": prefs,
        "bests": ctx.get("bests") or {},
        "voice": prefs.get("voice") or None,
        "hard_constraints": {
            "no_sessions_on": no_sessions_on,
            "max_one_session_per_day": avoid_two_a_day,
        },
        "cycle": {
            "start_date": plan_start_iso,
            "weeks_planned": weeks,
            "current_week_index": cycle_week_index,
        },
    }

    print(
        f"[SERVICE-PLAN-CONTINUE] calling LLM user={user_id} "
        f"model={DEFAULT_MODEL} first_n_days={first_n_days} "
        f"cycle_week_index={cycle_week_index}"
    )

    parsed, debug_trace = generate_plan_json(
        llm_input,
        DEFAULT_MODEL,
        debug_raw=False,
        loose=False,
    )

    if not isinstance(parsed, dict):
        raise ValueError("AI generation failed (parsed is not dict).")

    raw_next10 = parsed.get("next_10_days") or []
    if not isinstance(raw_next10, list) or not raw_next10:
        raise ValueError("AI continue returned empty next_10_days.")

    # HARD constraints post-fix (off days, max one session)
    fixed_next10 = _fix_offdays_and_per_day_limit(
        raw_next10,
        banned_dates=no_sessions_on,
        max_one_session_per_day=avoid_two_a_day,
    )

    # vezmi iba dni od new_start_iso a len toľko, koľko reálne potrebujeme
    filtered_days: List[Dict[str, Any]] = []
    for d in fixed_next10:
        if not isinstance(d, dict):
            continue
        day_iso = str(d.get("day") or "")[:10]
        if not day_iso:
            continue
        if day_iso < new_start_iso:
            continue
        filtered_days.append({"day": day_iso, "sessions": d.get("sessions") or []})

    if not filtered_days:
        print(
            "[SERVICE-PLAN-CONTINUE] no continue days after filtering, nothing inserted."
        )
        return {
            "plan_id": plan_id,
            "extended_days": 0,
            "inserted_sessions": 0,
            "old_end": end_iso,
            "new_end": end_iso,
            "horizon_days": horizon_days,
            "need_days": need_days,
            "note": "no_new_days_from_ai",
        }

    # orez na reálne potrebné dni
    filtered_days = filtered_days[:need_days]

    # 4) priprav rows pre DB insert (do existujúceho plan_id)
    new_rows: List[Dict[str, Any]] = []

    for d in filtered_days:
        day_iso = d["day"]
        sessions = d.get("sessions") or []
        if not isinstance(sessions, list):
            continue

        for idx, sess in enumerate(sessions):
            if not isinstance(sess, dict):
                continue

            sport = service_canonical_sport(sess.get("sport"))
            title = sess.get("title") or None
            duration = sess.get("duration_min")
            intensity = sess.get("intensity")
            session_type = sess.get("session_type") or None
            notes = sess.get("notes") or None
            zone_txt = service_hr_zone_text(sess)

            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": day_iso,
                "sport": sport,
                "title": title,
                "duration_min": duration,
                "intensity": intensity,
                "zone_text": zone_txt,
                "structure": sess.get("structure"),
                "notes": notes,
                "source": "ai_continue",
                "plan_id": plan_id,
                "session_type": session_type,
                "session_index": idx,
                "payload": sess,
                "activity_id": None,
            }
            new_rows.append(row)

    if not new_rows:
        print(
            "[SERVICE-PLAN-CONTINUE] new_rows empty after mapping, nothing inserted."
        )
        return {
            "plan_id": plan_id,
            "extended_days": 0,
            "inserted_sessions": 0,
            "old_end": end_iso,
            "new_end": end_iso,
            "horizon_days": horizon_days,
            "need_days": need_days,
            "note": "no_sessions_after_mapping",
        }

    inserted = db_insert_planned_sessions(new_rows)

    # nový end = max pôvodný end + najnovší z nových dní
    unique_days = sorted({r["plan_date"] for r in new_rows})
    new_end_iso = max([end_iso] + unique_days)

    try:
        new_end_d = _date.fromisoformat(new_end_iso)
    except Exception:
        new_end_d = old_end_d

    new_horizon = max(0, (new_end_d - today).days)

    print(
        f"[SERVICE-PLAN-CONTINUE] done user={user_id} plan_id={plan_id} "
        f"inserted_rows={inserted} unique_days={len(unique_days)} "
        f"old_end={end_iso} new_end={new_end_iso} new_horizon={new_horizon}"
    )

    return {
        "plan_id": plan_id,
        "extended_days": len(unique_days),
        "inserted_sessions": inserted,
        "old_end": end_iso,
        "new_end": new_end_iso,
        "horizon_days": new_horizon,
        "need_days": need_days,
        "note": "continued",
    }