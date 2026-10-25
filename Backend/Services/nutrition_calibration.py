# Services/nutrition_calibration.py
"""
Kalibrácia výdaja z trendu váhy a celých zapísaných dní.

Vzorec (BMR × NEAT + tréningy) má chybu ±15–25 % – človek drží cieľ
a váha nejde podľa plánu. Z reálnych dát sa dá spätne zistiť skutočný
výdaj:

    skutočný výdaj = priemerný príjem − zmena váhy × 7700 kcal/kg

Porovná sa s výdajom podľa modelu za tie isté dni a pomer (faktor) sa
uloží do nutrition_profile.tdee_factor. nutrition_targets.compute_day_targets
ním násobí výdaj.

Poistky:
  - len dni, ktoré user označil „deň mám zapísaný celý“ (nutrition_days),
    aspoň CALIB_MIN_COMPLETE_DAYS za CALIB_WINDOW_DAYS,
  - aspoň CALIB_MIN_WEIGHINS vážení v rozpätí CALIB_MIN_SPAN_DAYS dní,
  - faktor len v CALIB_FACTOR_RANGE (nadol menej – nedozapísané jedlo
    by inak radilo jesť ešte menej) a mení sa najviac o polovicu rozdielu.
Prepočet beží pri čítaní dňa, keď je posledný starší ako CALIB_REFRESH_DAYS
a dňa sa pýta sám user (tréner kalibráciu len vidí).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from Configs.nutrition import (
    CALIB_FACTOR_RANGE,
    CALIB_MIN_COMPLETE_DAYS,
    CALIB_MIN_SPAN_DAYS,
    CALIB_MIN_WEIGHINS,
    CALIB_REFRESH_DAYS,
    CALIB_WINDOW_DAYS,
    KCAL_PER_KG_FAT,
)
from DB.nutrition import db_list_food_log, db_list_nutrition_days, db_update_nutrition_profile
from Modules.Supabase.auth import AuthCtx
from Services.nutrition_targets import service_compute_targets_range


def _f(v: Any) -> Optional[float]:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None


def weight_slope(points: List[Tuple[float, float]]) -> Optional[float]:
    """Lineárna regresia (deň, kg) → kg/deň. Málo bodov alebo jeden deň → None."""
    n = len(points)
    if n < 2:
        return None
    mx = sum(p[0] for p in points) / n
    my = sum(p[1] for p in points) / n
    sxx = sum((p[0] - mx) ** 2 for p in points)
    if sxx <= 0:
        return None
    return sum((p[0] - mx) * (p[1] - my) for p in points) / sxx


def weight_points(trend: List[Dict[str, Any]], d_from: date, d_to: date) -> List[Tuple[float, float]]:
    """Váženia v okne ako (deň od d_from, kg); viac vážení v jeden deň = posledné."""
    by_day: Dict[str, float] = {}
    for row in trend:
        w = _f(row.get("value_num"))
        iso = str(row.get("measured_at") or "")[:10]
        if not w or w <= 0 or not iso:
            continue
        if d_from.isoformat() <= iso <= d_to.isoformat():
            by_day[iso] = w
    return [((date.fromisoformat(iso) - d_from).days, kg) for iso, kg in sorted(by_day.items())]


def is_stale(profile_row: Dict[str, Any], today: date) -> bool:
    raw = profile_row.get("tdee_calibrated_at")
    if not raw:
        return True
    try:
        at = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return True
    return (today - at.date()).days >= CALIB_REFRESH_DAYS


def compute_calibration(
    user_id: int,
    *,
    profile_row: Dict[str, Any],
    body: Dict[str, Any],
    today: date,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """Výsledok kalibrácie (bez zápisu). `factor` = nový faktor alebo doterajší."""
    d_to = today - timedelta(days=1)
    d_from = d_to - timedelta(days=CALIB_WINDOW_DAYS - 1)
    prev = _f(profile_row.get("tdee_factor")) or 1.0

    complete = {
        str(r.get("log_date"))[:10]
        for r in db_list_nutrition_days(user_id, d_from.isoformat(), d_to.isoformat(), ctx=ctx)
        if r.get("complete")
    }
    eaten: Dict[str, float] = {}
    for row in db_list_food_log(user_id, d_from.isoformat(), d_to.isoformat(), ctx=ctx):
        iso = str(row.get("log_date") or "")[:10]
        eaten[iso] = eaten.get(iso, 0.0) + (_f(row.get("kcal")) or 0.0)
    days = sorted(iso for iso in complete if eaten.get(iso, 0) > 0)

    points = weight_points(body.get("weight_trend") or [], d_from, d_to)
    span = (points[-1][0] - points[0][0]) if len(points) >= 2 else 0

    base: Dict[str, Any] = {
        "window_from": d_from.isoformat(),
        "window_to": d_to.isoformat(),
        "complete_days": len(days),
        "weighins": len(points),
        "span_days": span,
        "need_complete_days": CALIB_MIN_COMPLETE_DAYS,
        "need_weighins": CALIB_MIN_WEIGHINS,
        "need_span_days": CALIB_MIN_SPAN_DAYS,
        "factor": round(prev, 3),
    }
    if len(days) < CALIB_MIN_COMPLETE_DAYS or len(points) < CALIB_MIN_WEIGHINS or span < CALIB_MIN_SPAN_DAYS:
        return {**base, "status": "collecting"}

    slope = weight_slope(points)
    if slope is None:
        return {**base, "status": "collecting"}

    per_day = service_compute_targets_range(
        user_id, profile=profile_row, body=body, d_from=d_from, d_to=d_to, today=today, ctx=ctx
    )
    model = [float((per_day.get(iso) or {}).get("breakdown", {}).get("tdee_model") or 0) for iso in days]
    model = [m for m in model if m > 0]
    if not model:
        return {**base, "status": "collecting"}

    avg_model = sum(model) / len(model)
    avg_intake = sum(eaten[iso] for iso in days) / len(days)
    real = avg_intake - slope * KCAL_PER_KG_FAT
    raw = real / avg_model
    lo, hi = CALIB_FACTOR_RANGE
    # polovica rozdielu – jeden zlý týždeň (voda, cyklus) faktor nerozhodí
    factor = min(max(prev + (min(max(raw, lo), hi) - prev) * 0.5, lo), hi)
    return {
        **base,
        "status": "ok",
        "factor": round(factor, 3),
        "raw_factor": round(raw, 3),
        "clamped": not (lo <= raw <= hi),
        "avg_intake_kcal": int(round(avg_intake)),
        "model_tdee_kcal": int(round(avg_model)),
        "real_tdee_kcal": int(round(real)),
        "kg_per_week": round(slope * 7, 2),
    }


def service_refresh_calibration(
    user_id: int,
    *,
    profile_row: Dict[str, Any],
    body: Dict[str, Any],
    today: date,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Prepočíta a uloží kalibráciu, keď je stará. Vráti profil s novými
    hodnotami (alebo pôvodný). Chyba nezhodí denný prehľad.
    """
    if not is_stale(profile_row, today):
        return profile_row
    try:
        calib = compute_calibration(user_id, profile_row=profile_row, body=body, today=today, ctx=ctx)
        fields = {
            "tdee_factor": calib["factor"] if calib["status"] == "ok" else profile_row.get("tdee_factor"),
            "tdee_calibration": calib,
            "tdee_calibrated_at": datetime.now(timezone.utc).isoformat(),
        }
        db_update_nutrition_profile(user_id, fields, ctx=ctx)
        return {**profile_row, **fields}
    except Exception as e:  # noqa: BLE001
        # bez migrácie (stĺpce chýbajú) alebo chyba dát – ide sa ďalej bez kalibrácie
        print(f"[NUTRITION] calibration failed user={user_id}: {repr(e)}")
        return profile_row


def calibration_public(profile_row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Stav kalibrácie pre FE (aj trénerovi)."""
    if not profile_row:
        return None
    calib = profile_row.get("tdee_calibration")
    if not isinstance(calib, dict):
        return None
    return {**calib, "factor": _f(profile_row.get("tdee_factor")) or 1.0, "at": profile_row.get("tdee_calibrated_at")}
