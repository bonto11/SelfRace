# Services/plan_activity_match.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from datetime import date, timedelta

from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_ACTIVITIES_SUMMARY,
)

from Routes_DB.coach_plan_daily import (
  db_get_planned_range_rows,
  db_link_session_to_activity,
)

supabase = get_client()


# ───────────────────────────────────────── helpers: date / sport ─────────────────────────────────────────

def _date_from_ts(ts: Any) -> Optional[date]:
    """
    DB má v summary `date` ako timestamptz alebo string typu
    '2025-11-24 18:30:00+00' / '2025-11-24T18:30:00+00'.

    Zoberieme prvých 10 znakov a spravíme date().
    """
    if not ts:
        return None
    s = str(ts)[:10]
    try:
        y, m, d = map(int, s.split("-"))
        return date(y, m, d)
    except Exception:
        return None


def _sport_group_from_plan(s: Any) -> str:
    """
    Šport z plánovanej session (enum / text: run/ride/strength/swim/other).
    """
    if not s:
        return "other"
    v = str(s).lower()
    if v.startswith("run"):
        return "run"
    if v.startswith("ride") or v.startswith("bike") or v.startswith("velo"):
        return "ride"
    if v.startswith("str"):
        return "strength"
    if v.startswith("swim"):
        return "swim"
    return "other"


def _sport_group_from_activity(s: Any) -> str:
    """
    Šport z activities_summary.sport_type_fe (alebo fallback sport_type).
    """
    if not s:
        return "other"
    v = str(s).lower()
    if v.startswith("run") or "run" in v or v in ("trail", "trail_run"):
        return "run"
    if v.startswith("ride") or v.startswith("cycle") or v.startswith("bike"):
        return "ride"
    if v.startswith("str") or "strength" in v or "gym" in v:
        return "strength"
    if "swim" in v:
        return "swim"
    return "other"


def _sport_compat(plan_sport: str, act_sport: str) -> float:
    """
    1.0 = rovnaká skupina (run/run, ride/ride, ...),
    0.5 = trocha podobné (napr. run vs walk, ak by bol),
    0.0 = úplne mimo.
    """
    if plan_sport == act_sport:
        return 1.0
    if {plan_sport, act_sport} == {"run", "other"}:
        # napr. Strava to označí ako "Workout" → radšej nechať trochu šancu
        return 0.4
    return 0.0


# ───────────────────────────────────────── helpers: scoring ─────────────────────────────────────────

def _ratio_score(a: Optional[float], b: Optional[float]) -> float:
    """
    Vráti číslo 0..1 podľa pomeru (min/max) – ak jeden chýba → 0.
    """
    if a is None or b is None:
        return 0.0
    if a <= 0 or b <= 0:
        return 0.0
    lo = min(a, b)
    hi = max(a, b)
    return float(lo) / float(hi)


def _name_hint_score(plan_title: str, act_name: str) -> float:
    """
    Jednoduché keywordy v názve:
      - interval / repeats / VO2 / 400m / 1000m / hills / tempo / threshold / long / easy / recovery
    Čím viac zhod, tým vyššie.
    """
    if not plan_title and not act_name:
        return 0.0

    txt = f"{(plan_title or '')} || {(act_name or '')}".lower()

    # kľúčové slová (možnosť pridávať)
    groups = [
        ["interval", "repeats", "repeat", "interv"],
        ["vo2", "vO2"],
        ["hill", "hills", "climb"],
        ["tempo"],
        ["threshold", "thr"],
        ["easy", "recovery", "regen"],
        ["long run", "dlhy beh", "longrun"],
        ["fartlek"],
        ["strength", "posilka", "gym"],
    ]

    hits = 0
    for g in groups:
        if any(k in txt for k in g):
            hits += 1

    if hits == 0:
        return 0.0
    if hits == 1:
        return 0.3
    if hits == 2:
        return 0.6
    return 1.0


def _compute_match_score(
    act: Dict[str, Any],
    sess: Dict[str, Any],
    day_diff: int,
) -> Tuple[float, Dict[str, float]]:
    """
    Vypočíta finálne skóre + rozpis komponentov.
    Komponenty:
      - date_score: 1.0 (rovnaký deň), 0.7 (±1), 0.3 (±2), inak 0
      - sport_score: 0..1 podľa group
      - dur_score: pomer duration (moving_time vs duration_min)
      - name_score: 0..1 podľa názvu

    Finálne:
      score =
          0.35*date_score +
          0.25*sport_score +
          0.25*dur_score +
          0.15*name_score
    """
    # dátum
    if day_diff == 0:
        date_score = 1.0
    elif abs(day_diff) == 1:
        date_score = 0.7
    elif abs(day_diff) == 2:
        date_score = 0.3
    else:
        date_score = 0.0

    # šport
    plan_sg = _sport_group_from_plan(sess.get("sport"))
    act_sg = _sport_group_from_activity(act.get("sport_type_fe") or act.get("sport_type"))
    sport_score = _sport_compat(plan_sg, act_sg)

    # trvanie
    plan_dur_min = None
    if sess.get("duration_min") is not None:
        try:
            plan_dur_min = float(sess["duration_min"])
        except Exception:
            plan_dur_min = None

    act_dur_min = None
    if act.get("moving_time_s") is not None:
        try:
            act_dur_min = float(act["moving_time_s"]) / 60.0
        except Exception:
            act_dur_min = None

    dur_score = _ratio_score(plan_dur_min, act_dur_min)

    # názov
    name_score = _name_hint_score(
        str(sess.get("title") or sess.get("session_type") or ""),
        str(act.get("name") or ""),
    )

    score = (
        0.35 * date_score
        + 0.25 * sport_score
        + 0.25 * dur_score
        + 0.15 * name_score
    )

    detail = {
        "date_score": float(date_score),
        "sport_score": float(sport_score),
        "dur_score": float(dur_score),
        "name_score": float(name_score),
        "plan_dur_min": plan_dur_min or 0.0,
        "act_dur_min": act_dur_min or 0.0,
        "plan_sport_group": plan_sg,
        "act_sport_group": act_sg,
    }
    return float(score), detail


# ───────────────────────────────────────── DB helpers ─────────────────────────────────────────


def _load_activities_summary(user_id: int, activity_ids: List[int]) -> List[Dict[str, Any]]:
    if not activity_ids:
        return []

    rows = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id,date,sport_type,sport_type_fe,moving_time_s,"
            "distance_m,average_heartrate_bpm,name"
        )
        .eq("user_id", user_id)
        .in_("activity_id", activity_ids)
        .execute()
    )
    data = rows.data or []
    print(f"[PLAN-MATCH] loaded activities_summary rows={len(data)} for user={user_id}")
    return data

def auto_map_plans_for_activities(
    user_id: int,
    activity_ids: List[int],
    days_window: int = 1,
    score_threshold: float = 0.55,
) -> Dict[str, int]:
    """
    Automaticky namapuje aktivity (Strava) na plánované session.

    DB operácie (select/update) sú delegované do Services.coach_plan_log.
    """
    print(
        f"[PLAN-MATCH] start user={user_id} "
        f"activity_ids={activity_ids} days_window={days_window} "
        f"threshold={score_threshold}"
    )

    if not activity_ids:
        print("[PLAN-MATCH] no activity_ids -> nothing to do")
        return {"processed": 0, "candidates": 0, "mapped": 0, "skipped": 0}

    # 1) aktivity
    acts = _load_activities_summary(user_id, activity_ids)
    if not acts:
        print("[PLAN-MATCH] no activities_summary rows loaded")
        return {"processed": 0, "candidates": 0, "mapped": 0, "skipped": 0}

    # z aktivity zistíme min/max dátum
    act_dates: List[date] = []
    for a in acts:
        d = _date_from_ts(a.get("date"))
        if d:
            act_dates.append(d)
    if not act_dates:
        print("[PLAN-MATCH] no valid dates in activities")
        return {"processed": 0, "candidates": 0, "mapped": 0, "skipped": 0}

    min_d = str(min(act_dates) - timedelta(days=days_window))
    max_d = str(max(act_dates) + timedelta(days=days_window))

    # 2) plánované session v rozmedzí – cez nový service
    plan_rows = db_get_planned_range_rows(user_id, min_d, max_d)
    if not plan_rows:
        print("[PLAN-MATCH] no plan rows in range")
        return {"processed": len(acts), "candidates": 0, "mapped": 0, "skipped": 0}

    # index podľa dátumu (plan_date)
    plan_by_date: Dict[date, List[Dict[str, Any]]] = {}
    for r in plan_rows:
        pd_str = str(r.get("plan_date") or "")[:10]
        try:
            y, m, d = map(int, pd_str.split("-"))
            pd = date(y, m, d)
        except Exception:
            continue
        plan_by_date.setdefault(pd, []).append(r)

    total_candidates = 0
    mapped = 0
    skipped = 0

    # 3) per-activity matching
    for a in acts:
        aid = a.get("activity_id")
        a_date = _date_from_ts(a.get("date"))
        if not aid or not a_date:
            skipped += 1
            print(f"[PLAN-MATCH][ACT] skip (missing id or date) raw={a}")
            continue

        print(
            f"[PLAN-MATCH][ACT] aid={aid} date={a_date.isoformat()} "
            f"sport_type_fe={a.get('sport_type_fe')} "
            f"moving_time_s={a.get('moving_time_s')} "
            f"avg_hr={a.get('average_heartrate_bpm')} "
            f"name={a.get('name')!r}"
        )

        # kandidáti: všetky session v ±days_window
        candidates: List[Tuple[Dict[str, Any], int]] = []
        for delta in range(-days_window, days_window + 1):
            d = a_date + timedelta(days=delta)
            if d in plan_by_date:
                for sess in plan_by_date[d]:
                    candidates.append((sess, delta))

        print(
            f"[PLAN-MATCH][ACT] aid={aid} candidates_found={len(candidates)}"
        )
        total_candidates += len(candidates)

        if not candidates:
            continue

        best_score = 0.0
        best_sess: Optional[Dict[str, Any]] = None
        best_detail: Dict[str, float] = {}

        # 4) scoring kandidátov
        for sess, delta in candidates:
            if sess.get("activity_id"):
                print(
                    f"[PLAN-MATCH][CAND] aid={aid} plan_row_id={sess.get('id')} "
                    f"plan_date={sess.get('plan_date')} ALREADY_MAPPED activity_id={sess.get('activity_id')}"
                )
                continue

            score, detail = _compute_match_score(a, sess, day_diff=delta)

            print(
                "[PLAN-MATCH][CAND] "
                f"aid={aid} plan_row_id={sess.get('id')} "
                f"plan_date={sess.get('plan_date')} "
                f"sport={sess.get('sport')} title={sess.get('title')!r} "
                f"session_type={sess.get('session_type')!r} "
                f"∆day={delta} "
                f"score={score:.3f} "
                f"detail={detail}"
            )

            if score > best_score:
                best_score = score
                best_sess = sess
            best_detail = detail

        if not best_sess:
            print(
                f"[PLAN-MATCH][RESULT] aid={aid} best_score=0.000 "
                f"mapped=False reason='no unmapped candidates with score>0'"
            )
            continue

        # 5) rozhodnutie podľa threshold
        if best_score >= score_threshold:
            try:
                updated = db_link_session_to_activity(
                    user_id,
                    session_id=int(best_sess["id"]),
                    activity_id=int(aid),
                )
                mapped += 1
                print(
                    f"[PLAN-MATCH][RESULT] aid={aid} "
                    f"mapped_plan_row_id={best_sess['id']} "
                    f"best_score={best_score:.3f} "
                    f"threshold={score_threshold} "
                    f"detail={best_detail} "
                    f"db_updated_rows={updated}"
                )
            except Exception as e:
                skipped += 1
                print(
                    f"[PLAN-MATCH][RESULT] aid={aid} "
                    f"best_score={best_score:.3f} "
                    f"DB_UPDATE_ERROR={e!r}"
                )
        else:
            print(
                f"[PLAN-MATCH][RESULT] aid={aid} best_plan_row_id={best_sess['id']} "
                f"best_score={best_score:.3f} < threshold={score_threshold} "
                f"detail={best_detail}"
            )

    summary = {
        "processed": len(acts),
        "candidates": int(total_candidates),
        "mapped": int(mapped),
        "skipped": int(skipped),
    }
    print(f"[PLAN-MATCH][SUMMARY] {summary}")
    return summary