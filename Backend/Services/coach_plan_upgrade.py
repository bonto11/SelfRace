# Services/coach_plan_upgrade.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from datetime import date as _date, timedelta

from Configs.config import DEFAULT_MODEL

from Routes_DB.coach_plan_log import (
    db_get_planned_sessions_filtered,
    db_insert_planned_sessions,
)

from Routes_FE.coach_context import coach_context  # reuse rovnaký context ako pri analyze
from Services.plan_generation import generate_plan_json
from Services.coach_plan_log import (
    service_canonical_sport,
    service_hr_zone_text,
)

PlanHorizon = Tuple[str, str, int]  # (start_iso, end_iso, horizon_days)


def _detect_active_plan_horizon(user_id: int) -> Tuple[str, str, int, str]:
    """
    Nájde aktívny plán a vráti:
      - plan_id
      - earliest plan_date (start_iso)
      - latest plan_date (end_iso)
      - horizon_days = (end_iso - today) v dňoch (min. 0)
    """
    rows = db_get_planned_sessions_filtered(
        user_id=user_id,
        date_from=None,
        date_to=None,
        plan_id=None,
    )
    if not rows:
        raise ValueError("User has no planned sessions.")

    by_plan: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        pid = r.get("plan_id")
        if not pid:
            continue
        by_plan.setdefault(str(pid), []).append(r)

    if not by_plan:
        raise ValueError("No AI plan_id found for user.")

    best_pid: Optional[str] = None
    best_last: Optional[str] = None

    for pid, lst in by_plan.items():
        dates = sorted(
            str(x.get("plan_date") or "")[:10]
            for x in lst
            if x.get("plan_date")
        )
        if not dates:
            continue
        last = dates[-1]
        if best_last is None or last > best_last:
            best_last = last
            best_pid = pid

    if not best_pid or not best_last:
        raise ValueError("Cannot determine active plan.")

    active_rows = by_plan[best_pid]
    dates = sorted(
        str(x.get("plan_date") or "")[:10]
        for x in active_rows
        if x.get("plan_date")
    )
    if not dates:
        raise ValueError("Active plan has no dated rows.")

    start_iso = dates[0]
    end_iso = dates[-1]

    today = _date.today()
    try:
        end_d = _date.fromisoformat(end_iso)
    except Exception:
        end_d = today

    horizon_days = max(0, (end_d - today).days)

    print(
        f"[SERVICE-PLAN-UPGRADE] active_plan user={user_id} "
        f"plan_id={best_pid} start={start_iso} end={end_iso} "
        f"horizon_days={horizon_days}"
    )

    return best_pid, start_iso, end_iso, horizon_days


def _compute_no_sessions_on(
    plan_start_iso: Optional[str],
    weeks: int,
    days_off: List[str] | None,
    externals: List[dict] | None,
) -> List[str]:
    """
    Rovnaká logika ako v coach_plan_generation – OFF dni podľa days_off + externals.
    """
    DOW3 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    if not plan_start_iso or weeks <= 0:
        return []

    try:
        start = _date.fromisoformat(plan_start_iso[:10])
    except Exception:
        return []

    horizon = weeks * 7
    off: set[str] = set()

    want = {
        (d or "").strip()[:3].title()
        for d in (days_off or [])
        if d
    }

    for i in range(horizon):
        d = start + timedelta(days=i)
        if DOW3[d.weekday()] in want:
            off.add(d.isoformat())

    for ex in externals or []:
        if not isinstance(ex, dict):
            continue
        inten = str(ex.get("intensity") or "").lower().strip()

        if ex.get("date"):
            if inten != "low":
                off.add(str(ex["date"])[:10])
            continue

        if ex.get("day"):
            day3 = str(ex["day"]).strip()[:3].title()
            if inten == "low":
                continue
            if day3 in DOW3:
                for i in range(horizon):
                    d = start + timedelta(days=i)
                    if DOW3[d.weekday()] == day3:
                        off.add(d.isoformat())

    return sorted(off)


def _fix_offdays_and_per_day_limit(
    next10: List[Dict[str, Any]],
    banned_dates: List[str],
    *,
    max_one_session_per_day: bool = True,
) -> List[Dict[str, Any]]:
    """
    Upraví next_10_days:
      - na zakázaných dňoch dá len Rest Day
      - v bežných dňoch orez na max_one_session_per_day
    """
    banned = set(banned_dates or [])
    fixed: List[Dict[str, Any]] = []

    for day in next10:
        if not isinstance(day, dict):
            continue
        d = str(day.get("day") or "")[:10]
        sessions = day.get("sessions") or []
        if not isinstance(sessions, list):
            sessions = []

        keep: List[dict] = []

        if d in banned:
            keep = [{
                "title": "Rest Day",
                "sport": "other",
                "duration_min": 0,
                "session_type": "rest_day",
            }]
        else:
            for s in sessions:
                if not isinstance(s, dict):
                    continue
                if max_one_session_per_day and len(keep) >= 1:
                    break
                keep.append(s)

        fixed.append({"day": d, "sessions": keep})

    return fixed


def service_extend_active_plan(
    user_id: int,
    min_horizon_days: int = 10,
) -> Dict[str, Any]:
    """
    Rozšíri aktívny plán tak, aby mal aspoň `min_horizon_days` dopredu.
    - nájde aktívny plan_id
    - zistí dokedy je plán
    - ak horizon >= min_horizon_days → nič nerobí
    - inak zavolá AI a doplní nové dni do toho istého plan_id
    """
    if min_horizon_days < 1:
        min_horizon_days = 1

    # 1) zisti aktívny plán
    plan_id, start_iso, end_iso, horizon_days = _detect_active_plan_horizon(user_id)

    if horizon_days >= min_horizon_days:
        print(
            f"[SERVICE-PLAN-UPGRADE] already sufficient "
            f"user={user_id} plan_id={plan_id} horizon={horizon_days}"
        )
        return {
            "plan_id": plan_id,
            "extended_days": 0,
            "inserted_sessions": 0,
            "old_end": end_iso,
            "new_end": end_iso,
            "horizon_days": horizon_days,
            "note": "already_sufficient",
        }

    # koľko dní reálne potrebujeme doplniť
    need_days = max(1, min_horizon_days - horizon_days)

    today = _date.today()
    try:
        old_end_d = _date.fromisoformat(end_iso)
    except Exception:
        old_end_d = today

    # začiatok extend bloku – od nasledujúceho dňa po konci plánu, ale min. od dnes
    start_extend_d = max(today, old_end_d + timedelta(days=1))
    new_start_iso = start_extend_d.isoformat()

    print(
        f"[SERVICE-PLAN-UPGRADE] extend user={user_id} plan_id={plan_id} "
        f"need_days={need_days} new_start={new_start_iso}"
    )

    # 2) načítaj context (rovnaký engine ako pri /coach/analyze)
    ctx = coach_context(user_id, weeks=12)
    if not ctx.get("success", False):
        raise ValueError("coach_context failed for extend_active_plan.")

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

    # OFF dni pre extend blok (počítaj od new_start_iso, horizon = weeks*7)
    no_sessions_on = _compute_no_sessions_on(
        plan_start_iso=new_start_iso,
        weeks=weeks,
        days_off=days_off,
        externals=externals,
    )

    # 3) pripraviť vstup pre LLM (veľmi podobné coach_analyze)
    # first_n_days – nech AI vygeneruje 7–10 dní; nepotrebujeme viac
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
        "plan_start_date": new_start_iso,  # dôležité: extend od tohto dňa
        "strength_settings": prefs.get("strength_settings"),
        "first_n_days": first_n_days,
        "weeks": weeks,
        "hr_used": hr_used,
        "weekly": weekly_weeks[-weeks:] if weeks <= len(weekly_weeks) else weekly_weeks,
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
    }

    print(
        f"[SERVICE-PLAN-UPGRADE] calling LLM user={user_id} "
        f"model={DEFAULT_MODEL} first_n_days={first_n_days}"
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
        raise ValueError("AI extend returned empty next_10_days.")

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
        print("[SERVICE-PLAN-UPGRADE] no extend days after filtering, nothing inserted.")
        return {
            "plan_id": plan_id,
            "extended_days": 0,
            "inserted_sessions": 0,
            "old_end": end_iso,
            "new_end": end_iso,
            "horizon_days": horizon_days,
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
                "source": "ai_extend",
                "plan_id": plan_id,
                "session_type": session_type,
                "session_index": idx,
                "payload": sess,
                "activity_id": None,
            }
            new_rows.append(row)

    if not new_rows:
        print("[SERVICE-PLAN-UPGRADE] new_rows empty after mapping, nothing inserted.")
        return {
            "plan_id": plan_id,
            "extended_days": 0,
            "inserted_sessions": 0,
            "old_end": end_iso,
            "new_end": end_iso,
            "horizon_days": horizon_days,
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
        f"[SERVICE-PLAN-UPGRADE] done user={user_id} plan_id={plan_id} "
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
        "note": "extended",
    }