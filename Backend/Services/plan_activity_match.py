# Services/plan_activity_match.py
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Mapping, Optional, Sequence

from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_ENRICHMENT,
    TABLE_COACH_PLANNED_SESSIONS,
)

supabase = get_client()


# ----------------- helpers: basic -----------------


def _sport_group(s: Any) -> str:
    s = str(s or "").lower()
    if s in ("run", "trail_run", "virtual_run"):
        return "run"
    if s in ("ride", "virtual_ride", "ebike_ride", "gravel_ride"):
        return "ride"
    if s in ("swim", "pool_swim", "open_water_swim"):
        return "swim"
    if s in ("workout", "weight_training", "strength", "gym"):
        return "strength"
    return "other"


def _date_only_from_db(v: Any) -> Optional[date]:
    if not v:
        return None
    s = str(v)
    # "2025-11-24 10:15:00+00" → "2025-11-24"
    if " " in s:
        s = s.split(" ", 1)[0]
    if "T" in s:
        s = s.split("T", 1)[0]
    try:
        return date.fromisoformat(s)
    except Exception:
        return None


def _to_float(v: Any) -> Optional[float]:
    try:
        if v is None or v == "":
            return None
        return float(v)
    except Exception:
        return None


def _safe_date(s: str) -> date:
    return date.fromisoformat(s[:10])


# ----------------- helpers: plan meta -----------------


def _plan_hr_range(plan: Mapping[str, Any]) -> Optional[tuple[int, int]]:
    # priamo v stĺpci / payload-e
    payload = plan.get("payload") or {}
    hr = plan.get("target_hr_bpm_range") or plan.get("target_hr") or payload.get(
        "target_hr_bpm_range"
    )

    if isinstance(hr, list) and len(hr) == 2:
        try:
            return int(hr[0]), int(hr[1])
        except Exception:
            pass

    struct = payload.get("structure") or {}
    main = struct.get("main")
    main_target: Mapping[str, Any] = {}

    if isinstance(main, dict):
        # buď priamo target alebo prvý set
        if isinstance(main.get("target"), dict):
            main_target = main["target"]
        elif isinstance(main.get("sets"), list) and main["sets"]:
            main_target = main["sets"][0].get("target") or {}
    elif isinstance(main, list) and main:
        main_target = main[0].get("target") or {}

    hr2 = main_target.get("hr") or main_target.get("heart_rate")
    if isinstance(hr2, list) and len(hr2) == 2:
        try:
            return int(hr2[0]), int(hr2[1])
        except Exception:
            pass

    return None


def _plan_duration_min(plan: Mapping[str, Any]) -> Optional[float]:
    payload = plan.get("payload") or {}
    d = plan.get("duration_min") or payload.get("duration_min") or payload.get("dur")
    return _to_float(d)


def _plan_distance_km(plan: Mapping[str, Any]) -> Optional[float]:
    payload = plan.get("payload") or {}
    d = (
        payload.get("distance_km")
        or payload.get("distance_m")
        or plan.get("distance_km")
        or plan.get("distance_m")
    )
    if d is None:
        return None
    v = _to_float(d)
    if v is None:
        return None
    # ak je to v metroch, prehoď na km
    return v / 1000.0 if v > 1000 else v


# ----------------- helpers: scoring -----------------


KEYWORDS: Dict[str, List[str]] = {
    "interval": ["interval", "repeats", "reps", "repeat", "intervaly"],
    "vo2": ["vo2", "vo2max"],
    "threshold": ["threshold", "tempo", "lt2", "lactate"],
    "long": ["long run", "long", "dlhy beh", "dlhý beh"],
    "easy": ["easy", "recovery", "ľahký", "lahky", "z2"],
}


def _name_flags_from_plan(plan: Mapping[str, Any]) -> Dict[str, bool]:
    payload = plan.get("payload") or {}
    txt = " ".join(
        str(x).lower()
        for x in [
            plan.get("title"),
            plan.get("session_type"),
            payload.get("session_type"),
            plan.get("intensity"),
        ]
        if x
    )
    flags: Dict[str, bool] = {}
    for k, words in KEYWORDS.items():
        flags[k] = any(w in txt for w in words)
    return flags


def _name_flags_from_activity(act: Mapping[str, Any]) -> Dict[str, bool]:
    txt = str(act.get("name") or "").lower()
    flags: Dict[str, bool] = {}
    for k, words in KEYWORDS.items():
        flags[k] = any(w in txt for w in words)
    return flags


def _name_score(plan: Mapping[str, Any], act: Mapping[str, Any]) -> float:
    p = _name_flags_from_plan(plan)
    a = _name_flags_from_activity(act)
    common = sum(1 for k in KEYWORDS.keys() if p.get(k) and a.get(k))
    if common == 0:
        return 0.0
    if common == 1:
        return 0.6
    return 1.0  # >=2 tagy


def _date_score(plan_date: date, act_date: date) -> float:
    diff = abs((plan_date - act_date).days)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.6
    return 0.0


def _hr_score(plan: Mapping[str, Any], act: Mapping[str, Any]) -> float:
    avg = _to_float(act.get("avg_hr_bpm") or act.get("average_heartrate_bpm"))
    if avg is None:
        return 0.0
    rng = _plan_hr_range(plan)
    if not rng:
        return 0.0
    lo, hi = rng
    if lo <= avg <= hi:
        return 1.0
    if lo - 5 <= avg <= hi + 5:
        return 0.6
    return 0.0


def _duration_score(plan: Mapping[str, Any], act: Mapping[str, Any]) -> float:
    plan_min = _plan_duration_min(plan)
    if plan_min is None or plan_min <= 0:
        return 0.0
    act_min = _to_float(act.get("moving_time_s"))
    if act_min is None or act_min <= 0:
        return 0.0
    act_min /= 60.0
    ratio = act_min / plan_min
    if 0.8 <= ratio <= 1.2:
        return 1.0
    if 0.6 <= ratio <= 1.4:
        return 0.6
    return 0.0


def _distance_score(plan: Mapping[str, Any], act: Mapping[str, Any]) -> float:
    plan_km = _plan_distance_km(plan)
    if plan_km is None or plan_km <= 0:
        return 0.0
    d_m = _to_float(act.get("distance_m"))
    if d_m is None or d_m <= 0:
        return 0.0
    act_km = d_m / 1000.0
    ratio = act_km / plan_km
    if 0.8 <= ratio <= 1.2:
        return 1.0
    if 0.6 <= ratio <= 1.4:
        return 0.6
    return 0.0


def _plan_activity_score(plan: Mapping[str, Any], act: Mapping[str, Any]) -> float:
    """Finálne skóre 0–1, predpokladáme už rovnaký user_id a sport-group."""
    pd = _safe_date(str(plan["plan_date"]))
    ad = _safe_date(str(act["date_iso"]))
    ds = _date_score(pd, ad)
    if ds == 0.0:
        return 0.0

    hr_s = _hr_score(plan, act)
    name_s = _name_score(plan, act)
    dur_s = _duration_score(plan, act)
    dist_s = _distance_score(plan, act)

    score = (
        0.30 * ds
        + 0.30 * hr_s
        + 0.20 * name_s
        + 0.15 * dur_s
        + 0.05 * dist_s
    )
    return score


# ----------------- load meta z DB -----------------


def _load_activity_meta(
    user_id: int, activity_ids: Sequence[int]
) -> Dict[int, Dict[str, Any]]:
    """Načíta info pre matchovanie z enrichment + summary."""
    ids = sorted({int(x) for x in activity_ids if x is not None})
    if not ids:
        return {}

    # enrichment (hr, zóny, čas, vzdialenosť, sport_type_fe)
    enr = (
        supabase.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select(
            "activity_id, avg_hr_bpm, moving_time_s, distance_m, sport_type_fe"
        )
        .eq("user_id", user_id)
        .in_("activity_id", ids)
        .execute()
    )
    enr_map: Dict[int, Dict[str, Any]] = {
        int(r["activity_id"]): dict(r) for r in (enr.data or [])
    }

    # summary (dátum, názov, fallback sport_type_fe)
    summ = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id, date, name, sport_type_fe, average_heartrate_bpm, moving_time_s, distance_m"
        )
        .eq("user_id", user_id)
        .in_("activity_id", ids)
        .execute()
    )
    out: Dict[int, Dict[str, Any]] = {}

    for r in summ.data or []:
        aid = int(r["activity_id"])
        base: Dict[str, Any] = enr_map.get(aid, {})
        base.setdefault("activity_id", aid)
        base.setdefault("avg_hr_bpm", r.get("average_heartrate_bpm"))
        base.setdefault("moving_time_s", r.get("moving_time_s"))
        base.setdefault("distance_m", r.get("distance_m"))
        base["name"] = r.get("name") or ""
        base["sport_type_fe"] = base.get("sport_type_fe") or r.get("sport_type_fe") or "other"
        d = _date_only_from_db(r.get("date"))
        base["date_iso"] = d.isoformat() if d else None
        out[aid] = base

    return out


# ----------------- public API -----------------


def auto_map_plans_for_activities(
    user_id: int,
    activity_ids: Sequence[int],
    *,
    date_window: int = 1,
    threshold: float = 0.7,
) -> Dict[str, int]:
    """
    Pre daného usera a zoznam activity_id:
      - nájde plánované tréningy v coach_plan_log (TABLE_COACH_PLANNED_SESSIONS),
      - pokúsi sa ich spárovať podľa dátumu, športu, HR, názvu a trvania,
      - do plánu zapíše activity_id, ak score >= threshold.

    Vracia štatistiky: {"candidates": X, "mapped": Y}.
    """
    meta = _load_activity_meta(user_id, activity_ids)
    if not meta:
        return {"candidates": 0, "mapped": 0}

    mapped = 0
    candidates = 0

    for aid in sorted(meta.keys()):
        act = meta[aid]
        if not act.get("date_iso"):
            continue

        act_date = _safe_date(act["date_iso"])
        sport_group = _sport_group(act.get("sport_type_fe"))

        date_from = (act_date - timedelta(days=date_window)).isoformat()
        date_to = (act_date + timedelta(days=date_window)).isoformat()

        # kandidáti z plánu
        res = (
            supabase.table(TABLE_COACH_PLANNED_SESSIONS)
            .select("*")
            .eq("user_id", user_id)
            .gte("plan_date", date_from)
            .lte("plan_date", date_to)
            .is_("activity_id", None)
            .execute()
        )
        plans: List[Dict[str, Any]] = res.data or []
        if not plans:
            continue

        # filtruj podľa sport-group
        plans = [
            p for p in plans if _sport_group(p.get("sport")) == sport_group
        ]
        if not plans:
            continue

        candidates += 1

        best: Optional[Dict[str, Any]] = None
        best_score = 0.0
        for p in plans:
            score = _plan_activity_score(p, act)
            if score > best_score:
                best_score = score
                best = p

        if not best or best_score < threshold:
            continue

        # zapis activity_id do plánu
        try:
            supabase.table(TABLE_COACH_PLANNED_SESSIONS).update(
                {"activity_id": aid}
            ).eq("id", best["id"]).execute()
            mapped += 1
            print(
                f"[PLAN-MATCH] user={user_id} aid={aid} -> plan_id={best['id']} "
                f"date={best['plan_date']} score={best_score:.3f}"
            )
        except Exception as e:  # noqa: BLE001
            print(f"[PLAN-MATCH] update failed user={user_id} aid={aid}: {e}")

    return {"candidates": candidates, "mapped": mapped}