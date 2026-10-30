# Services/nutrition_targets.py
"""
Denné ciele výživy (kcal, bielkoviny, sacharidy, tuky) – deterministicky, nie AI.

Výdaj = BMR × NEAT + 0,75 × kcal z tréningov dňa.
  - minulé dni: reálne aktivity (Strava kcal, inak odhad MET) + ručné silové
    zápisy bez Strava aktivity,
  - dnes: reálne aktivity + ešte nesplnené tréningy z plánu (inak by ráno
    pred tréningom vyšli sacharidy ako na voľný deň),
  - budúce dni: plán (coach_plan_daily) + externé aktivity.
Udalosti (sport="other") sa rátajú podľa náročnosti (Configs/nutrition.py).

Preteky (coach prefs targets.run.races): deň pretekov a 1–2 dni pred dlhým
pretekom (≥ 90 min) sú „palivové“ dni – vyššie sacharidy a bez deficitu.
V náročný deň sa deficit pri chudnutí polovičí. Kalibrácia z váhy
(profile.tdee_factor, Services/nutrition_calibration.py) násobí výdaj.

PREČO pri čítaní a nie uložené: aktivita zo Stravy príde aj o hodiny neskôr
a plán sa mení – uložený cieľ by rýchlo zastaral. Zmena cieľa prepočíta aj
minulé dni; pre denný prehľad to nevadí.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from Configs.activity_load import read_event_structure
from Configs.nutrition import (
    CARBS_G_PER_KG,
    DAY_LOADS,
    DEFAULT_MET,
    EVENT_NET_MET,
    EXERCISE_KCAL_FACTOR,
    EXTERNAL_SPORT_MET,
    FAT_MIN_G_PER_KG,
    FUEL_DAY_PROTEIN_G_PER_KG_MAX,
    GOAL_RATE_PCT,
    KCAL_PER_KG_FAT,
    LOAD_KCAL_PER_KG_HARD,
    LOAD_KCAL_PER_KG_MODERATE,
    LONG_RUN_MIN,
    LONG_SESSION_MIN,
    MAX_WEEKLY_LOSS_PCT,
    MIN_AGE_FOR_GOAL,
    MIN_BMI_FOR_LOSS,
    NEAT_FACTOR_DEFAULT,
    PLAN_SPORT_ACTIVITY_MATCH,
    BMR_MEASURED_MAX_AGE_DAYS,
    PROTEIN_G_PER_KG_AUTO,
    PROTEIN_G_PER_KG_DEFAULT,
    RACE_KM,
    RACE_LOADING_DAYS,
    RACE_LOADING_LONG_MINUTES,
    RACE_LOADING_MIN_MINUTES,
    RACE_MIN_PER_100M_GAIN,
    RACE_PACE_MIN_PER_KM,
    REFERENCE_BMI_CAP,
    SESSION_TYPE_LOAD,
    SESSION_TYPE_MET_FACTOR,
    SPORT_MET,
    STRENGTH_MIN_PER_SET,
    STRENGTH_WARMUP_MIN,
)
from DB.activities_summary import db_get_activities_in_range_basic
from DB.coach_plan_daily import db_get_planned_range_rows
from DB.profile_static import db_fetch_static_basic
from DB.strength_sessions import db_list_strength_sessions_between
from DB.user_prefs import db_get_pref_single
from DB.user_metrics import db_get_latest_metric, db_get_metric_trend
from Modules.Supabase.auth import AuthCtx
from Services.coach_external_events import service_list_external_events_window

_LOAD_RANK = {load: i for i, load in enumerate(DAY_LOADS)}


def _f(v: Any) -> Optional[float]:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None  # NaN


def _max_load(a: str, b: str) -> str:
    return a if _LOAD_RANK.get(a, 0) >= _LOAD_RANK.get(b, 0) else b


def today_local(tz_name: Optional[str] = None) -> date:
    try:
        tz = ZoneInfo(tz_name or "Europe/Bratislava")
    except Exception:  # noqa: BLE001
        tz = ZoneInfo("Europe/Bratislava")
    return datetime.now(tz).date()


# ---------------------------------------------------------------------------
# TELO – vek, váha, BMR
# ---------------------------------------------------------------------------


def _age_on(birth: Optional[str], day: date) -> Optional[int]:
    if not birth:
        return None
    try:
        b = date.fromisoformat(str(birth)[:10])
    except ValueError:
        return None
    return day.year - b.year - ((day.month, day.day) < (b.month, b.day))


def _weight_on(trend: List[Dict[str, Any]], latest: Optional[float], day: date) -> Optional[float]:
    """Posledné meranie váhy k danému dňu, inak najstaršie známe / posledné."""
    best: Optional[float] = None
    for row in trend:  # od najstaršieho
        w = _f(row.get("value_num"))
        if w is None or w <= 0:
            continue
        measured = str(row.get("measured_at") or "")[:10]
        if measured and measured <= day.isoformat():
            best = w
        elif best is None:
            best = w
            break
    return best if best is not None else latest


def mifflin_st_jeor(*, sex: Optional[str], kg: float, cm: float, age: int) -> float:
    base = 10 * kg + 6.25 * cm - 5 * age
    if sex == "M":
        return base + 5
    if sex == "F":
        return base - 161
    return base - 78  # bez pohlavia priemer


def formula_bmr(body: Dict[str, Any], day: date) -> Optional[int]:
    """BMR zo vzorca (Mifflin-St Jeor) – len na ukážku v nastaveniach, keď nie je ručný ani zo scanu."""
    kg, cm = body.get("weight_kg"), body.get("height_cm")
    age = _age_on(body.get("birth_date"), day)
    if not kg or not cm or age is None or body.get("sex") not in ("M", "F"):
        return None
    return int(round(mifflin_st_jeor(sex=body.get("sex"), kg=float(kg), cm=float(cm), age=age)))


def _measured_bmr(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    """
    Posledný BMR z body scanu (InBody) – users_metrics `bmr_kcal`, zapisuje ho
    potvrdenie scanu. PREČO cez merania a nie body_scans: tréner body scany
    nevidí (fotky), merania áno – ciele u neho vyjdú rovnako ako u zverenca.
    """
    try:
        row = db_get_latest_metric(user_id, "bmr_kcal", ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[NUTRITION] bmr metric load failed user={user_id}: {repr(e)}")
        return None
    kcal = _f((row or {}).get("value_num"))
    day = str((row or {}).get("measured_at") or "")[:10]
    if not kcal or not day:
        return None
    try:
        age_days = (date.today() - date.fromisoformat(day)).days
    except ValueError:
        return None
    if age_days > BMR_MEASURED_MAX_AGE_DAYS:
        return None
    return {"kcal": int(round(kcal)), "date": day}


def load_body(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """Pohlavie, narodenie, výška (profile_static), váhy a BMR zo scanu (users_metrics)."""
    static: Dict[str, Any] = {}
    try:
        static = db_fetch_static_basic(user_id, ctx=ctx) or {}
    except Exception as e:  # noqa: BLE001
        print(f"[NUTRITION] static load failed user={user_id}: {repr(e)}")

    trend: List[Dict[str, Any]] = []
    latest: Optional[float] = None
    try:
        trend = db_get_metric_trend(user_id, "weight_kg", 400, ctx=ctx) or []
        if trend:
            latest = _f(trend[-1].get("value_num"))
        else:
            row = db_get_latest_metric(user_id, "weight_kg", ctx=ctx)
            latest = _f((row or {}).get("value_num"))
    except Exception as e:  # noqa: BLE001
        print(f"[NUTRITION] weight load failed user={user_id}: {repr(e)}")

    return {
        "sex": static.get("sex"),
        "birth_date": static.get("birth_date"),
        "height_cm": _f(static.get("height_cm")),
        "weight_trend": trend,
        "weight_kg": latest,
        "bmr_measured": _measured_bmr(user_id, ctx=ctx),
    }


def missing_body_fields(profile: Optional[Dict[str, Any]], body: Dict[str, Any]) -> List[str]:
    """Čo chýba na výpočet. Pohlavie treba len pre vzorec (bez ručného BMR a scanu)."""
    missing: List[str] = []
    if not body.get("weight_kg"):
        missing.append("weight_kg")
    if not body.get("birth_date"):
        missing.append("birth_date")
    if not body.get("height_cm"):
        missing.append("height_cm")
    has_bmr = (profile or {}).get("bmr_manual") or body.get("bmr_measured")
    if not has_bmr and body.get("sex") not in ("M", "F"):
        missing.append("sex")
    return missing


# ---------------------------------------------------------------------------
# TRÉNINGY DŇA
# ---------------------------------------------------------------------------


def _activity_local_date(act: Dict[str, Any]) -> Optional[str]:
    raw = act.get("date")
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00").replace(" ", "T"))
    except ValueError:
        return None
    try:
        offset = int(act.get("utc_offset_s") or 0)
    except (TypeError, ValueError):
        offset = 0
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return (dt + timedelta(seconds=offset)).date().isoformat()


def _activity_sport(act: Dict[str, Any]) -> str:
    return str(act.get("sport_type_ovrd") or act.get("sport_type_fe") or "other").strip().lower()


def _met_kcal(met: float, kg: float, minutes: float) -> float:
    return max(0.0, met * kg * minutes / 60.0)


def _activity_item(act: Dict[str, Any], kg: float) -> Dict[str, Any]:
    sport = _activity_sport(act)
    minutes = (_f(act.get("moving_time_s")) or _f(act.get("elapsed_time_s")) or 0) / 60.0
    kcal = _f(act.get("calories_kcal"))
    estimated = not kcal or kcal <= 0
    if estimated:
        kcal = _met_kcal(SPORT_MET.get(sport, DEFAULT_MET), kg, minutes)
    long_min = LONG_RUN_MIN if sport == "run" else LONG_SESSION_MIN
    return {
        "source": "activity",
        "id": act.get("activity_id"),
        "title": act.get("name"),
        "sport": sport,
        "minutes": round(minutes),
        "kcal": round(kcal or 0),
        "estimated": estimated,
        "load": "hard" if minutes >= long_min else None,
    }


def _strength_log_item(row: Dict[str, Any], kg: float) -> Optional[Dict[str, Any]]:
    log = row.get("log") if isinstance(row.get("log"), dict) else {}
    sets = 0
    for ex in log.get("exercises") or []:
        for s in (ex or {}).get("sets") or []:
            if isinstance(s, dict) and not s.get("is_warmup") and s.get("reps"):
                sets += 1
    if not sets:
        return None
    minutes = STRENGTH_WARMUP_MIN + sets * STRENGTH_MIN_PER_SET
    return {
        "source": "strength_log",
        "id": row.get("id"),
        "title": None,
        "sport": "strength",
        "minutes": round(minutes),
        "kcal": round(_met_kcal(SPORT_MET["strength"], kg, minutes)),
        "estimated": True,
        "load": "moderate",
    }


def _plan_item(row: Dict[str, Any], kg: float) -> Optional[Dict[str, Any]]:
    minutes = _f(row.get("duration_min")) or 0
    if minutes <= 0:
        return None  # deň voľna
    sport = str(row.get("sport") or "other")
    stype = str(row.get("session_type") or "")

    if sport == "other":
        ev = read_event_structure(row.get("structure")) or {"load": "easy"}
        if ev.get("kind") == "recovery":
            return None  # sauna, masáž… – výdaj ani záťaž dňa nemenia
        load = ev["load"]
        kcal = _met_kcal(EVENT_NET_MET.get(load, 1.0), kg, minutes)
        return {
            "source": "plan",
            "id": row.get("id"),
            "title": row.get("title"),
            "sport": "other",
            "minutes": round(minutes),
            "kcal": round(kcal),
            "estimated": True,
            "load": load,
            "event": True,
        }

    met = SPORT_MET.get(sport, DEFAULT_MET) * SESSION_TYPE_MET_FACTOR.get(stype, 1.0)
    load = SESSION_TYPE_LOAD.get(stype) or ("moderate" if sport == "strength" else None)
    long_min = LONG_RUN_MIN if sport == "run" else LONG_SESSION_MIN
    if minutes >= long_min:
        load = "hard"
    return {
        "source": "plan",
        "id": row.get("id"),
        "title": row.get("title"),
        "sport": sport,
        "minutes": round(minutes),
        "kcal": round(_met_kcal(met, kg, minutes)),
        "estimated": True,
        "load": load,
    }


def _external_item(occ: Dict[str, Any], kg: float) -> Optional[Dict[str, Any]]:
    minutes = _f(occ.get("duration_min")) or 0
    if minutes <= 0:
        return None
    ev = read_event_structure(occ.get("structure")) or {"load": "easy", "kind": "other"}
    load = ev["load"]
    is_event = ev.get("kind") != "sport"
    if is_event:
        met = EVENT_NET_MET.get(load, 1.0)
    else:
        met = EXTERNAL_SPORT_MET.get(str(occ.get("intensity") or "low"), EXTERNAL_SPORT_MET["low"])
    return {
        "source": "external",
        "id": occ.get("id"),
        "title": occ.get("title"),
        "sport": str(occ.get("sport") or "other"),
        "minutes": round(minutes),
        "kcal": round(_met_kcal(met, kg, minutes)),
        "estimated": True,
        "load": load,
        "event": is_event,
    }


def _covered_by_activity(sport: str, done_sports: set) -> bool:
    """Dnešný plán/externá aktivita už má reálnu aktivitu rovnakého športu."""
    match = PLAN_SPORT_ACTIVITY_MATCH.get(sport)
    return bool(match) and any(s in done_sports for s in match)


def _day_load(items: List[Dict[str, Any]], kg: float) -> str:
    if not items:
        return "rest"
    load = "easy"
    for it in items:
        if it.get("load"):
            load = _max_load(load, it["load"])
    # udalosť (svadba) má vlastnú náročnosť – jej kcal deň „tréningovým“ nerobia
    per_kg = sum(float(it.get("kcal") or 0) for it in items if not it.get("event")) / max(kg, 1.0)
    if per_kg >= LOAD_KCAL_PER_KG_HARD:
        load = _max_load(load, "hard")
    elif per_kg >= LOAD_KCAL_PER_KG_MODERATE:
        load = _max_load(load, "moderate")
    return load


def load_exercise_by_day(
    user_id: int,
    d_from: date,
    d_to: date,
    *,
    today: date,
    kg_by_day: Dict[str, float],
    ctx: AuthCtx,
) -> Dict[str, List[Dict[str, Any]]]:
    """Tréningy každého dňa v [d_from, d_to] podľa pravidiel z hlavičky modulu."""
    days = [(d_from + timedelta(days=i)).isoformat() for i in range((d_to - d_from).days + 1)]
    out: Dict[str, List[Dict[str, Any]]] = {d: [] for d in days}
    today_iso = today.isoformat()
    done_sports: Dict[str, set] = {d: set() for d in days}

    # 1) reálne aktivity (minulosť + dnes). Okno o deň širšie – lokálny deň
    #    aktivity sa ráta z UTC + posunu pásma.
    if d_from <= today:
        last = min(d_to, today)
        try:
            acts = db_get_activities_in_range_basic(
                ctx,
                user_id,
                (d_from - timedelta(days=1)).isoformat(),
                (last + timedelta(days=2)).isoformat(),
            )
        except Exception as e:  # noqa: BLE001
            print(f"[NUTRITION] activities load failed user={user_id}: {repr(e)}")
            acts = []
        for act in acts:
            day = _activity_local_date(act)
            if day not in out or day > today_iso:
                continue
            item = _activity_item(act, kg_by_day[day])
            out[day].append(item)
            done_sports[day].add(item["sport"])

        # ručné silové zápisy bez Strava aktivity (tá je už vyššie)
        try:
            logs = db_list_strength_sessions_between(user_id, d_from.isoformat(), last.isoformat(), ctx=ctx)
        except Exception as e:  # noqa: BLE001
            print(f"[NUTRITION] strength load failed user={user_id}: {repr(e)}")
            logs = []
        for row in logs:
            day = str(row.get("session_date") or "")[:10]
            if day not in out or row.get("activity_id"):
                continue
            item = _strength_log_item(row, kg_by_day[day])
            if item:
                out[day].append(item)
                done_sports[day].add("strength")

    # 2) plán + externé aktivity (dnes len to, čo ešte nie je odcvičené)
    if d_to >= today:
        first = max(d_from, today)
        try:
            plan_rows = db_get_planned_range_rows(user_id, None, first.isoformat(), d_to.isoformat(), ctx=ctx)
        except Exception as e:  # noqa: BLE001
            print(f"[NUTRITION] plan load failed user={user_id}: {repr(e)}")
            plan_rows = []
        for row in plan_rows:
            day = str(row.get("plan_date") or "")[:10]
            if day not in out:
                continue
            if str(row.get("status") or "planned") != "planned" or row.get("activity_id"):
                continue
            item = _plan_item(row, kg_by_day[day])
            if not item:
                continue
            if day == today_iso and _covered_by_activity(item["sport"], done_sports[day]):
                continue
            out[day].append(item)

        try:
            ext = service_list_external_events_window(
                user_id, from_iso=first.isoformat(), to_iso=d_to.isoformat(), ctx=ctx
            ).get("occurrences") or []
        except Exception as e:  # noqa: BLE001
            print(f"[NUTRITION] external load failed user={user_id}: {repr(e)}")
            ext = []
        for occ in ext:
            day = str(occ.get("occurrence_date") or "")[:10]
            if day not in out:
                continue
            item = _external_item(occ, kg_by_day[day])
            if not item:
                continue
            if day == today_iso and _covered_by_activity(item["sport"], done_sports[day]):
                continue
            out[day].append(item)

    return out


# ---------------------------------------------------------------------------
# PRETEKY
# ---------------------------------------------------------------------------


def parse_duration_min(raw: Any) -> Optional[float]:
    """'1:45:00' → 105, '45:30' (MM:SS) → 45,5. Prázdne/zlé → None."""
    if not raw:
        return None
    try:
        nums = [float(p) for p in str(raw).strip().split(":")]
    except ValueError:
        return None
    if len(nums) == 3:
        minutes = nums[0] * 60 + nums[1] + nums[2] / 60
    elif len(nums) == 2:
        minutes = nums[0] + nums[1] / 60
    else:
        return None
    return minutes if minutes > 0 else None


def _race_estimate(race: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    """(km, minúty) pretekov – cieľový čas, inak odhad z dĺžky, typu a prevýšenia."""
    km = _f(race.get("custom_distance_km")) or RACE_KM.get(str(race.get("race_goal") or ""))
    minutes = parse_duration_min(race.get("target_time"))
    if minutes or not km:
        return km, minutes
    pace = RACE_PACE_MIN_PER_KM.get(str(race.get("race_type") or "road"), RACE_PACE_MIN_PER_KM["other"])
    gain = _f(race.get("elevation_gain_m")) or 0.0
    return km, km * pace + gain / 100 * RACE_MIN_PER_100M_GAIN


def load_races(user_id: int, d_from: date, d_to: date, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """
    Preteky z coach prefs, ktoré ovplyvnia dni [d_from, d_to] – aj tie,
    ktoré sú do RACE_LOADING_DAYS po d_to (doplnenie sacharidov vopred).
    """
    try:
        row = db_get_pref_single(user_id, "coach.prefs", ctx=ctx)
        prefs = (row or {}).get("value") or {}
        races = ((prefs.get("targets") or {}).get("run") or {}).get("races") or []
    except Exception as e:  # noqa: BLE001
        print(f"[NUTRITION] races load failed user={user_id}: {repr(e)}")
        return []
    last = d_to + timedelta(days=RACE_LOADING_DAYS)
    out: List[Dict[str, Any]] = []
    for r in races if isinstance(races, list) else []:
        if not isinstance(r, dict):
            continue
        try:
            day = date.fromisoformat(str(r.get("date") or "")[:10])
        except ValueError:
            continue
        if day < d_from or day > last:
            continue
        km, minutes = _race_estimate(r)
        out.append({
            "date": day.isoformat(),
            "name": (str(r.get("name") or "").strip() or None),
            "km": round(km, 1) if km else None,
            "minutes": int(round(minutes)) if minutes else None,
            "minutes_estimated": not parse_duration_min(r.get("target_time")),
            "race_type": r.get("race_type") or None,
            "long": bool(minutes and minutes >= RACE_LOADING_MIN_MINUTES),
            "loading_days": (
                RACE_LOADING_DAYS if minutes and minutes >= RACE_LOADING_LONG_MINUTES
                else 1 if minutes and minutes >= RACE_LOADING_MIN_MINUTES
                else 0
            ),
        })
    return sorted(out, key=lambda x: x["date"])


def race_context_by_day(races: List[Dict[str, Any]], days: List[date]) -> Dict[str, Dict[str, Any]]:
    """
    {iso: {"kind": "race"|"load", "race": {...}, "days_to": n}}.
    Deň pretekov má prednosť pred doplnením na ďalší pretek.
    """
    out: Dict[str, Dict[str, Any]] = {}
    isos = {d.isoformat() for d in days}
    for r in races:
        if r["date"] in isos:
            out[r["date"]] = {"kind": "race", "race": r, "days_to": 0}
    for r in races:
        race_day = date.fromisoformat(r["date"])
        for n in range(1, int(r.get("loading_days") or 0) + 1):
            iso = (race_day - timedelta(days=n)).isoformat()
            if iso in isos and iso not in out:
                out[iso] = {"kind": "load", "race": r, "days_to": n}
    return out


def _race_item(race: Dict[str, Any], kg: float) -> Optional[Dict[str, Any]]:
    """Pretek ako tréning dňa – keď ho nemá plán ani aktivita."""
    minutes = race.get("minutes")
    if not minutes:
        return None
    return {
        "source": "race",
        "id": None,
        "title": race.get("name"),
        "sport": "run",
        "minutes": int(minutes),
        "kcal": round(_met_kcal(SPORT_MET["run"], kg, minutes)),
        "estimated": True,
        "load": "hard",
    }


def _has_race_session(items: List[Dict[str, Any]], race: Dict[str, Any]) -> bool:
    """Deň už má tréning dĺžky pretekov (plán s pretekom, odbehnutá aktivita)."""
    minutes = race.get("minutes") or 0
    return any(
        not it.get("event") and float(it.get("minutes") or 0) >= 0.5 * minutes
        for it in items
    )


# ---------------------------------------------------------------------------
# CIELE
# ---------------------------------------------------------------------------


def _goal_rate(profile: Dict[str, Any], goal: str) -> float:
    rng = GOAL_RATE_PCT.get(goal)
    if not rng:
        return 0.0
    lo, default, hi = rng
    rate = _f(profile.get("goal_rate_pct"))
    return min(max(rate if rate is not None else default, lo), hi)


def compute_day_targets(
    *,
    profile: Dict[str, Any],
    body: Dict[str, Any],
    day: date,
    exercise: List[Dict[str, Any]],
    race: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Ciele jedného dňa. `race` = kontext z race_context_by_day (deň pretekov
    alebo doplnenie sacharidov pred nimi).
    """
    kg = _weight_on(body.get("weight_trend") or [], body.get("weight_kg"), day) or 0.0
    cm = body.get("height_cm") or 0.0
    age = _age_on(body.get("birth_date"), day) or 30
    limits: List[str] = []

    # ručný > z body scanu (InBody) > vzorec
    bmr_manual = _f(profile.get("bmr_manual"))
    measured = body.get("bmr_measured") or {}
    if bmr_manual:
        bmr, bmr_source = bmr_manual, "manual"
    elif measured.get("kcal"):
        bmr, bmr_source = float(measured["kcal"]), "measured"
    else:
        bmr, bmr_source = mifflin_st_jeor(sex=body.get("sex"), kg=kg, cm=cm, age=age), "formula"

    neat = _f(profile.get("neat_factor")) or NEAT_FACTOR_DEFAULT
    exercise_kcal = sum(float(it.get("kcal") or 0) for it in exercise)
    counted = EXERCISE_KCAL_FACTOR * exercise_kcal
    # kalibrácia z váhy a zapísaných dní (1 = bez úpravy)
    tdee_factor = _f(profile.get("tdee_factor")) or 1.0
    tdee_model = bmr * neat + counted
    tdee = tdee_model * tdee_factor

    load = _day_load(exercise, kg)
    race_kind = (race or {}).get("kind")
    if race_kind == "load":
        load = "load"
    elif race_kind == "race":
        # krátky pretek (do 90 min) = náročný deň, dlhý = pretekové sacharidy
        load = "race" if (race.get("race") or {}).get("long") else _max_load(load, "hard")

    goal = str(profile.get("goal") or "maintain")
    bmi = kg / ((cm / 100) ** 2) if kg and cm else None
    if goal != "maintain" and age < MIN_AGE_FOR_GOAL:
        goal = "maintain"
        limits.append("minor_maintain")
    if goal == "lose" and bmi is not None and bmi < MIN_BMI_FOR_LOSS:
        goal = "maintain"
        limits.append("low_bmi_maintain")

    rate = _goal_rate(profile, goal)
    target = tdee
    if goal == "lose":
        deficit = tdee * rate / 100
        max_deficit = kg * MAX_WEEKLY_LOSS_PCT / 100 * KCAL_PER_KG_FAT / 7
        if deficit > max_deficit:
            deficit = max_deficit
            limits.append("max_loss_rate")
        # PREČO: podjedený náročný tréning = horší tréning a vyššie riziko
        # zranenia. Chudnutie je preto o kúsok pomalšie, nie za cenu výkonu.
        if race_kind:
            deficit = 0.0
            limits.append("race_fueling")
        elif load == "hard":
            deficit *= 0.5
            limits.append("hard_day_deficit")
        target = tdee - deficit
    elif goal == "gain":
        target = tdee * (1 + rate / 100)

    if target < bmr:
        target = bmr
        limits.append("min_bmr")

    # g/kg z referenčnej váhy (viď REFERENCE_BMI_CAP)
    ref_kg = min(kg, REFERENCE_BMI_CAP * (cm / 100) ** 2) if cm else kg
    # bez vlastnej voľby automaticky podľa (skutočného) cieľa
    protein_manual = _f(profile.get("protein_g_per_kg"))
    protein_per_kg = protein_manual or PROTEIN_G_PER_KG_AUTO.get(goal, PROTEIN_G_PER_KG_DEFAULT)
    if race_kind:
        protein_per_kg = min(protein_per_kg, FUEL_DAY_PROTEIN_G_PER_KG_MAX)
    protein = protein_per_kg * ref_kg
    carbs = CARBS_G_PER_KG[load] * ref_kg
    fat_min = FAT_MIN_G_PER_KG * ref_kg
    fat = (target - 4 * protein - 4 * carbs) / 9
    if fat < fat_min:
        fat = fat_min
        if race_kind:
            # pred pretekom sa sacharidy neuberajú – kcal pôjdu hore
            pass
        else:
            # tuky majú minimum – uberú sa sacharidy
            carbs = max(0.0, (target - 4 * protein - 9 * fat) / 4)
            limits.append("carbs_reduced")
    target = max(target, 4 * protein + 4 * carbs + 9 * fat)

    return {
        "targets": {
            "kcal": int(round(target / 10) * 10),
            "protein_g": int(round(protein)),
            "carbs_g": int(round(carbs)),
            "fat_g": int(round(fat)),
        },
        "breakdown": {
            "bmr": int(round(bmr)),
            "bmr_source": bmr_source,
            "bmr_measured_at": measured.get("date") if bmr_source == "measured" else None,
            "neat_factor": round(neat, 2),
            "exercise_kcal": int(round(exercise_kcal)),
            "exercise_counted_kcal": int(round(counted)),
            "tdee": int(round(tdee)),
            "tdee_model": int(round(tdee_model)),
            "tdee_factor": round(tdee_factor, 3),
            "goal": goal,
            "goal_rate_pct": rate,
            "day_load": load,
            "carbs_g_per_kg": CARBS_G_PER_KG[load],
            "protein_g_per_kg": round(protein_per_kg, 2),
            "protein_auto": not protein_manual,
            "weight_kg": round(kg, 1),
            "ref_weight_kg": round(ref_kg, 1),
            "age": age,
            "limits": limits,
            "race": (race or {}).get("race") and {
                "kind": race_kind,
                "days_to": race.get("days_to"),
                **race["race"],
            },
        },
    }


def service_compute_targets_range(
    user_id: int,
    *,
    profile: Dict[str, Any],
    body: Dict[str, Any],
    d_from: date,
    d_to: date,
    today: date,
    ctx: AuthCtx,
) -> Dict[str, Dict[str, Any]]:
    """Ciele pre každý deň v [d_from, d_to] → {iso_date: {targets, breakdown, exercise}}."""
    trend = body.get("weight_trend") or []
    days = [d_from + timedelta(days=i) for i in range((d_to - d_from).days + 1)]
    kg_by_day = {d.isoformat(): (_weight_on(trend, body.get("weight_kg"), d) or 70.0) for d in days}
    exercise = load_exercise_by_day(user_id, d_from, d_to, today=today, kg_by_day=kg_by_day, ctx=ctx)
    races = race_context_by_day(load_races(user_id, d_from, d_to, ctx=ctx), days)

    out: Dict[str, Dict[str, Any]] = {}
    for d in days:
        iso = d.isoformat()
        items = exercise[iso]
        race = races.get(iso)
        # pretek, ktorý nie je v pláne (advisor, ručný plán) – kým nie je odbehnutý
        if race and race["kind"] == "race" and d >= today and not _has_race_session(items, race["race"]):
            item = _race_item(race["race"], kg_by_day[iso])
            if item:
                items = items + [item]
        res = compute_day_targets(profile=profile, body=body, day=d, exercise=items, race=race)
        res["exercise"] = items
        out[iso] = res
    return out
