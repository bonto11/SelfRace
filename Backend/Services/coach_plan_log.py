# Services/coach_plan_log.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from datetime import date, timedelta

from Routes_DB.coach_plan_daily import (
    db_insert_planned_sessions,
    db_fetch_plan_rows_in_range,
    db_get_planned_range_rows,
    db_get_planned_sessions_filtered,
    db_clear_range_for_user,
    db_delete_plan_for_user,
    db_link_session_to_activity,
    db_reorder_planned_sessions,
)

from Routes_DB.coach_plan_weekly import (
    db_insert_weekly_rows,
    db_clear_weekly_for_user_plan,
)

# ───────────────────────────── helpers ─────────────────────────────


def service_parse_iso_date(s: str) -> date:
    """Parsuje YYYY-MM-DD → datetime.date."""
    try:
        y, m, d = map(int, s.split("-"))
        return date(y, m, d)
    except Exception:
        raise ValueError(f"Invalid date: {s}")


def service_canonical_sport(sport: Any) -> str:
    s = str(sport or "").lower()
    if s in ("bike", "cycling"):
        return "ride"
    if s in ("gym",):
        return "strength"
    if s not in ("run", "ride", "strength", "swim", "other"):
        return "other"
    return s


def service_hr_zone_text(sess: Dict[str, Any]) -> Optional[str]:
    hr = sess.get("target_hr_bpm_range")
    if isinstance(hr, list) and len(hr) == 2:
        try:
            low, high = int(hr[0]), int(hr[1])
            return f"HR {low}–{high}"
        except Exception:
            return None
    return None


# ───────────────────────────── public service API – READ ─────────────────────────────


def service_get_planned_range_rows(
    user_id: int,
    start_iso: str,
    end_iso: str,
):
    """Pre FE endpoint /coach-plan/range – vracia všetky riadky."""
    return db_get_planned_range_rows(
        user_id=user_id,
        start_iso=start_iso,
        end_iso=end_iso,
    )


def service_get_planned_sessions_filtered(
    user_id: int,
    date_from: Optional[str],
    date_to: Optional[str],
    plan_id: Optional[str],
):
    """Pôvodný GET /coach-plan/{user_id} – filtre."""
    return db_get_planned_sessions_filtered(
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        plan_id=plan_id,
    )


def service_fetch_plan_rows_in_range(
    user_id: int,
    start_d: date,
    end_d: date,
    columns: Optional[str] = None,
):
    """Helper pre iné služby (napr. auto-mapovanie)."""
    return db_fetch_plan_rows_in_range(
        user_id=user_id,
        start_iso=start_d.isoformat(),
        end_iso=end_d.isoformat(),
        columns=columns,
    )


# ───────────────────────────── helpers – WEEKLY normalizácia ─────────────────────────────


def _build_weekly_rows_for_plan(
    *,
    user_id: int,
    plan_id: str,
    plan_start: date,
    plan_end: date,
    weekly_raw: Any,
) -> List[Dict[str, Any]]:
    """
    Z `weekly_raw` (čo nám vráti AI) poskladá riadky pre coach_plan_weekly.

    Podporované tvary:

    1) dict s kľúčom "weeks": {"weeks": [ { ... }, ... ]}
       - každý item môže mať:
         week_index, week_start, week_end, goal, focus, load_phase,
         planned_km, planned_minutes, notes

    2) jednoduchý list stringov: ["Week 1: ...", "Week 2: ..."]
       - vtedy:
         goal = daný string
         week_index = poradie
         week_start/week_end dopočítame od plan_start
    """
    if weekly_raw is None:
        return []

    # normalizuj na list "weeks"
    weeks_list: List[Any]

    if isinstance(weekly_raw, dict) and isinstance(weekly_raw.get("weeks"), list):
        weeks_list = weekly_raw["weeks"]
    elif isinstance(weekly_raw, list):
        weeks_list = weekly_raw
    else:
        # neznámy formát → radšej nič
        print("[SERVICE-COACH-PLAN] _build_weekly_rows_for_plan unknown weekly_raw format")
        return []

    if not weeks_list:
        return []

    rows: List[Dict[str, Any]] = []

    for idx, item in enumerate(weeks_list):
        week_index = idx + 1

        # default week_start/week_end = z dátumu plánu
        week_start_d = plan_start + timedelta(days=7 * idx)
        week_end_d = week_start_d + timedelta(days=6)
        if week_end_d > plan_end:
            week_end_d = plan_end

        goal: Optional[str] = None
        focus: Optional[str] = None
        load_phase: Optional[str] = None
        planned_km: Optional[float] = None
        planned_minutes: Optional[int] = None
        notes: Optional[str] = None

        if isinstance(item, dict):
            # skúsiť prečítať z dictu
            if item.get("week_index") is not None:
                try:
                    week_index = int(item["week_index"])
                except Exception:
                    pass

            # week_start/week_end, ak sú k dispozícii
            if item.get("week_start"):
                try:
                    week_start_d = service_parse_iso_date(str(item["week_start"])[:10])
                except Exception:
                    pass
            if item.get("week_end"):
                try:
                    week_end_d = service_parse_iso_date(str(item["week_end"])[:10])
                except Exception:
                    pass

            goal = item.get("goal") or item.get("label") or item.get("summary")
            focus = item.get("focus")
            load_phase = item.get("load_phase") or item.get("phase")

            # objemy sú voliteľné – ak tam nie sú, necháme NULL
            try:
                if item.get("planned_km") is not None:
                    planned_km = float(item["planned_km"])
            except Exception:
                planned_km = None

            try:
                if item.get("planned_minutes") is not None:
                    planned_minutes = int(item["planned_minutes"])
            except Exception:
                planned_minutes = None

            notes = item.get("notes")
        else:
            # jednoduchý string → goal = celý text
            goal = str(item)

        row = {
            "user_id": user_id,
            "plan_id": plan_id,
            "week_index": week_index,
            "week_start": week_start_d.isoformat(),
            "week_end": week_end_d.isoformat(),
            "goal": goal,
            "focus": focus,
            "load_phase": load_phase,
            "planned_km": planned_km,
            "planned_minutes": planned_minutes,
            "completed_km": None,
            "completed_minutes": None,
            "notes": notes,
        }
        rows.append(row)

    print(
        f"[SERVICE-COACH-PLAN] _build_weekly_rows_for_plan "
        f"user={user_id} plan_id={plan_id} weeks={len(rows)}"
    )
    return rows


# ───────────────────────────── AI UPSERT (tvorba plánu) ─────────────────────────────


def service_upsert_ai_plan_for_user(
    user_id: int,
    next_10_days: List[Dict[str, Any]],
    overwrite: bool = True,
    weekly: Any | None = None,
):
    """
    Vytvorí ÚPLNE NOVÝ plán (nové plan_id).
    Toto používame iba pri /coach/generate.

    Okrem daily (coach_plan_daily) teraz voliteľne zapisuje aj
    weekly prehľad do coach_plan_weekly.
    """
    if not isinstance(next_10_days, list) or not next_10_days:
        raise ValueError("next_10_days is required and must be non-empty")

    from uuid import uuid4

    # --- rozsah plánu podľa dní ---
    all_dates: List[date] = []
    for d in next_10_days:
        if not isinstance(d, dict) or "day" not in d:
            raise ValueError("Invalid entry in next_10_days (missing 'day')")
        all_dates.append(service_parse_iso_date(str(d["day"])[:10]))

    start_d = min(all_dates)
    end_d = max(all_dates)

    plan_id = str(uuid4())

    # --- prípadné čistenie starého rozsahu (daily) ---
    if overwrite:
        db_clear_range_for_user(
            user_id=user_id,
            start_iso=start_d.isoformat(),
            end_iso=end_d.isoformat(),
        )

    # --- DAILY rows ---
    rows_daily: List[Dict[str, Any]] = []

    for d in next_10_days:
        day_str = str(d["day"])[:10]
        sessions = d.get("sessions") or []
        if not isinstance(sessions, list):
            raise ValueError(f"Invalid 'sessions' for day {day_str}")

        for idx, sess in enumerate(sessions):
            if not isinstance(sess, dict):
                continue

            sport = service_canonical_sport(sess.get("sport"))
            row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": day_str,
                "sport": sport,
                "title": sess.get("title"),
                "duration_min": sess.get("duration_min"),
                "intensity": sess.get("intensity"),
                "zone_text": service_hr_zone_text(sess),
                "structure": sess.get("structure"),
                "notes": sess.get("notes"),
                "source": "ai",
                "plan_id": plan_id,
                "session_type": sess.get("session_type"),
                "session_index": idx,
                "payload": sess,
                "activity_id": None,
            }
            rows_daily.append(row)

    if not rows_daily:
        raise ValueError("No sessions to save")

    inserted_daily = db_insert_planned_sessions(rows_daily)

    # --- WEEKLY rows (voliteľné) ---
    weekly_rows: List[Dict[str, Any]] = []
    if weekly is not None:
        weekly_rows = _build_weekly_rows_for_plan(
            user_id=user_id,
            plan_id=plan_id,
            plan_start=start_d,
            plan_end=end_d,
            weekly_raw=weekly,
        )
        if weekly_rows:
            # ak by tam náhodou niečo bolo pre rovnaký plan_id, vyčisti
            db_clear_weekly_for_user_plan(user_id=user_id, plan_id=plan_id)
            db_insert_weekly_rows(weekly_rows)

    print(
        f"[SERVICE-COACH-PLAN] upsert_ai_plan_for_user user={user_id} "
        f"plan_id={plan_id} inserted_daily={inserted_daily} "
        f"weekly_rows={len(weekly_rows)} "
        f"range={start_d}..{end_d}"
    )

    return {
        "plan_id": plan_id,
        "inserted": inserted_daily,
        "start": start_d,
        "end": end_d,
    }


# ───────────────────────────── CANCEL, LINK, REORDER ─────────────────────────────


def service_cancel_plan_for_user(user_id: int, plan_id: Optional[str]):
    """
    Zruší aktívny plán:
      - ak plan_id → zmaže len daný plán (daily + weekly)
      - inak všetky AI planned sessions od dneška (vrátane) – weekly necháme,
        lebo nemáme istotu, ktoré plány to sú (tu používame plan_id).
    """
    from_iso = None if plan_id else date.today().isoformat()

    deleted_daily = db_delete_plan_for_user(
        user_id=user_id,
        plan_id=plan_id,
        from_iso=from_iso,
    )

    # weekly maže len pre konkrétny plan_id (ak je známy)
    deleted_weekly = 0
    if plan_id:
        deleted_weekly = db_clear_weekly_for_user_plan(
            user_id=user_id,
            plan_id=plan_id,
        )

    print(
        f"[SERVICE-COACH-PLAN] cancel_plan_for_user user={user_id} "
        f"plan_id={plan_id} from={from_iso} "
        f"deleted_daily={deleted_daily} deleted_weekly={deleted_weekly}"
    )
    return deleted_daily


def service_link_session_to_activity(session_id: int, activity_id: Optional[int]):
    """
    Manuálne / programové mapovanie planned session ↔️ aktivita.
    activity_id=None → odmapovanie.
    """
    updated = db_link_session_to_activity(
        session_id=session_id,
        activity_id=activity_id,
    )
    print(
        f"[SERVICE-COACH-PLAN] link_session_to_activity session_id={session_id} "
        f"activity_id={activity_id} updated={updated}"
    )
    return updated


def service_reorder_planned_sessions(
    user_id: int,
    updates: List[Dict[str, Any]],
):
    """
    Batch presun tréningov (plan_date + session_index).
    """
    if not updates:
        return 0

    norm: List[Dict[str, Any]] = []
    for u in updates:
        if not isinstance(u, dict):
            continue
        sid = u.get("id")
        plan_date_raw = u.get("plan_date")
        if sid is None or plan_date_raw is None:
            continue

        date_iso = str(plan_date_raw)
        # ak failne → ValueError (400 v routeri)
        _ = service_parse_iso_date(date_iso)

        try:
            sid_int = int(sid)
        except Exception:
            raise ValueError(f"Invalid id in updates: {sid!r}")

        try:
            idx_int = int(u.get("session_index", 0))
        except Exception:
            raise ValueError(
                f"Invalid session_index in updates: {u.get('session_index')!r}"
            )

        norm.append(
            {
                "id": sid_int,
                "plan_date": date_iso,
                "session_index": idx_int,
            }
        )

    if not norm:
        return 0

    updated = db_reorder_planned_sessions(user_id=user_id, updates=norm)
    print(
        f"[SERVICE-COACH-PLAN] reorder_planned_sessions user={user_id} "
        f"updates={len(norm)} updated={updated}"
    )
    return updated


# ───────────────────────────── EXTEND (pattern copy) ─────────────────────────────

PlanHorizon = Tuple[str, str, int]  # (start_iso, end_iso, horizon_days)


def _detect_active_plan_horizon(user_id: int) -> PlanHorizon:
    """
    Nájde aktívny plán a vráti:
      - earliest plan_date (start_iso)
      - latest plan_date (end_iso)
      - horizon_days = (end_iso - today)
    Vyberá posledný plan_id podľa max(plan_date).
    """
    rows = db_get_planned_sessions_filtered(
        user_id=user_id,
        date_from=None,
        date_to=None,
        plan_id=None,
    )
    if not rows:
        raise ValueError("User has no planned sessions")

    by_plan: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        pid = r.get("plan_id")
        if pid:
            by_plan.setdefault(str(pid), []).append(r)

    if not by_plan:
        raise ValueError("No plan_id found")

    # vyber najnovší plán podľa max(plan_date)
    best_pid: Optional[str] = None
    best_last: Optional[str] = None

    for pid, lst in by_plan.items():
        dates = sorted(str(x["plan_date"])[:10] for x in lst if x.get("plan_date"))
        if not dates:
            continue
        last = dates[-1]
        if best_last is None or last > best_last:
            best_last = last
            best_pid = pid

    if not best_pid or not best_last:
        raise ValueError("Cannot determine active plan")

    act_rows = [r for r in by_plan[best_pid]]
    if not act_rows:
        raise ValueError("Active plan has no rows")

    dates = sorted(str(x["plan_date"])[:10] for x in act_rows if x.get("plan_date"))
    start_iso, end_iso = dates[0], dates[-1]

    end_d = service_parse_iso_date(end_iso)
    horizon = (end_d - date.today()).days

    print(
        f"[SERVICE-COACH-PLAN] _detect_active_plan_horizon "
        f"user={user_id} plan_id={best_pid} start={start_iso} end={end_iso} "
        f"horizon={horizon}"
    )

    return (start_iso, end_iso, horizon)


def service_extend_active_plan(
    user_id: int,
    min_horizon_days: int = 10,
) -> Dict[str, Any]:
    """
    Udrží aktívny plán tak, aby mal min. `min_horizon_days` dopredu.

    V1 (bez AI):
      - nájde aktívny plán (najnovší plan_id)
      - ak už máš horizon >= min_horizon_days → nič nerobí
      - inak vezme posledných max 7 dní ako pattern
      - tento pattern skopíruje ďalej do budúcnosti (plan_date),
        activity_id = None, source = 'ai_extend'
    """
    if min_horizon_days < 1:
        min_horizon_days = 1

    start_iso, end_iso, horizon = _detect_active_plan_horizon(user_id)

    today_d = date.today()
    end_d = service_parse_iso_date(end_iso)

    if horizon >= min_horizon_days:
        return {
            "extended_days": 0,
            "plan_start": start_iso,
            "plan_end": end_iso,
            "horizon_days": horizon,
            "note": "already_sufficient",
        }

    need_days = min_horizon_days - horizon
    if need_days <= 0:
        return {
            "extended_days": 0,
            "plan_start": start_iso,
            "plan_end": end_iso,
            "horizon_days": horizon,
            "note": "unexpected_no_extend",
        }

    # 1) načítaj všetky riadky aktívneho plánu v rozsahu
    active_rows = db_get_planned_range_rows(
        user_id=user_id,
        start_iso=start_iso,
        end_iso=end_iso,
    )
    if not active_rows:
        raise ValueError("Active plan has no rows")

    plan_id = str(active_rows[0].get("plan_id") or "")

    if not plan_id:
        raise ValueError("Active plan rows have no plan_id")

    # 2) poskladaj pattern podľa dní (posledných max 7 dní)
    by_date: Dict[str, List[Dict[str, Any]]] = {}
    for r in active_rows:
        d_iso = str(r.get("plan_date") or "")[:10]
        if not d_iso:
            continue
        by_date.setdefault(d_iso, []).append(r)

    all_dates_sorted = sorted(by_date.keys())
    if not all_dates_sorted:
        raise ValueError("Active plan has no valid dates")

    # pattern = posledných max 7 dní plánu
    pattern_dates = all_dates_sorted[-7:]
    pattern_len = len(pattern_dates)

    print(
        f"[SERVICE-COACH-PLAN] extend_active_plan user={user_id} "
        f"plan_id={plan_id} pattern_dates={pattern_dates} "
        f"need_days={need_days}"
    )

    new_rows: List[Dict[str, Any]] = []
    # začíname deň po aktuálnom end_d
    cur = end_d

    # ensure myDays = need_days ale nech nerobíme niečo úplne šialené
    max_days_safe = max(need_days, 0)
    if max_days_safe > 60:  # bezpečnostná brzda
        max_days_safe = 60

    for offset in range(1, max_days_safe + 1):
        new_d = cur + timedelta(days=offset)
        new_iso = new_d.isoformat()

        # vyber pattern deň – “cyklovanie” cez pattern_dates
        pattern_idx = (offset - 1) % pattern_len
        src_day_iso = pattern_dates[pattern_idx]
        src_rows = by_date.get(src_day_iso, [])

        # skopíruj všetky sessions z daného pattern dňa
        for sess in src_rows:
            new_row: Dict[str, Any] = {
                "user_id": user_id,
                "plan_date": new_iso,
                "sport": sess.get("sport"),
                "title": sess.get("title"),
                "duration_min": sess.get("duration_min"),
                "intensity": sess.get("intensity"),
                "zone_text": sess.get("zone_text"),
                "structure": sess.get("structure"),
                "notes": sess.get("notes"),
                "source": "ai_extend",
                "plan_id": plan_id,
                "session_type": sess.get("session_type"),
                "session_index": sess.get("session_index") or 0,
                "payload": sess.get("payload"),
                "activity_id": None,
            }
            new_rows.append(new_row)

    if not new_rows:
        return {
            "extended_days": 0,
            "plan_start": start_iso,
            "plan_end": end_iso,
            "horizon_days": horizon,
            "note": "no_rows_generated",
        }

    inserted = db_insert_planned_sessions(new_rows)

    # nový end = posledný dátum, ktorý sme pridali
    new_dates = {r["plan_date"] for r in new_rows if r.get("plan_date")}
    if new_dates:
        new_end_iso = max(new_dates)
    else:
        new_end_iso = end_iso

    new_end_d = service_parse_iso_date(new_end_iso)
    new_horizon = (new_end_d - today_d).days

    print(
        f"[SERVICE-COACH-PLAN] extend_active_plan user={user_id} "
        f"plan_id={plan_id} inserted_rows={inserted} "
        f"old_end={end_iso} new_end={new_end_iso} new_horizon={new_horizon}"
    )

    # extended_days = počet nových unikátnych dní (nie počet riadkov)
    extended_days = len(new_dates)

    return {
        "extended_days": extended_days,
        "plan_start": start_iso,
        "plan_end": new_end_iso,
        "horizon_days": new_horizon,
        "inserted_rows": inserted,
        "note": "extended_pattern_copy",
    }