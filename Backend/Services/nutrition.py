# Services/nutrition.py
"""
Výživa: profil (cieľ + súhlas), denný prehľad, zápis jedla, obľúbené, nedávne,
týždeň s varovaniami, stav dňa („zapísaný celý“), „ako včera“.

Ciele počíta Services/nutrition_targets.py, palivo okolo tréningov
Services/nutrition_fuel.py, kalibráciu výdaja nutrition_calibration.py.
AI návrhy (text, fotka, etiketa, jedlá na zvyšok dňa) sú v Services/AI/nutrition –
do food_log ide až to, čo user potvrdí (tu).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from Configs.nutrition import (
    BMR_MANUAL_RANGE,
    BUDGET_ADJUST_MAX,
    BUDGET_MIN_DIFF_KCAL,
    FAST_LOSS_PCT_PER_WEEK,
    FAT_MIN_G_PER_KG,
    FULL_DAY_MIN_MEALS,
    NUTRITION_AI_MIN_LOGGED_DAYS,
    NUTRITION_MODES,
    FOOD_LOG_SOURCES,
    GOAL_RATE_PCT,
    MAX_FAVORITES,
    MAX_ITEMS_PER_LOG,
    MEALS,
    NEAT_FACTOR_DEFAULT,
    NEAT_FACTOR_RANGE,
    NUTRITION_GOALS,
    PROTEIN_G_PER_KG_RANGE,
    RECENT_DAYS,
    RECENT_LIMIT,
    REPEAT_LOOKBACK_DAYS,
    UNDERFUEL_HARD_CARBS_PCT,
    UNDERFUEL_KCAL_PCT,
    UNDERFUEL_MIN_LOGGED_DAYS,
    WEIGHT_TREND_DAYS,
)
from DB.nutrition import (
    db_delete_food_favorite,
    db_delete_food_log,
    db_delete_nutrition_data,
    db_delete_nutrition_days,
    db_delete_own_products,
    db_get_food_log_entry,
    db_get_nutrition_profile,
    db_insert_food_favorite,
    db_insert_food_log,
    db_list_food_favorites,
    db_list_food_log,
    db_list_food_log_recent,
    db_list_nutrition_days,
    db_update_food_log,
    db_upsert_nutrition_day,
    db_upsert_nutrition_profile,
)
from Modules.Supabase.auth import AuthCtx
from Services.nutrition_targets import (
    formula_bmr,
    load_body,
    missing_body_fields,
    service_compute_targets_range,
    today_local,
)
from Services.nutrition_calibration import (
    calibration_public,
    service_refresh_calibration,
    weight_points,
    weight_slope,
)
from Services.nutrition_products import service_product_visible
from Services.user_prefs import service_get_user_timezone

# Rozumné hranice jednej položky – chráni súčty pred preklepom (5000 g, 90000 kcal)
_MAX_GRAMS = 5000.0
_MAX_KCAL = 10000.0
_MAX_MACRO_G = 1000.0
_MAX_NAME = 120
_MAX_RAW = 500


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _num(v: Any) -> Optional[float]:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None


def _parse_day(v: Any) -> Optional[date]:
    try:
        return date.fromisoformat(str(v)[:10])
    except (TypeError, ValueError):
        return None


def _tz(user_id: int, ctx: AuthCtx) -> Optional[str]:
    try:
        return service_get_user_timezone(user_id, ctx=ctx)
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------------------
# PROFIL
# ---------------------------------------------------------------------------


def _public_profile(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    return {
        "goal": row.get("goal") or "maintain",
        "goal_rate_pct": _num(row.get("goal_rate_pct")),
        "bmr_manual": int(row["bmr_manual"]) if row.get("bmr_manual") else None,
        "neat_factor": _num(row.get("neat_factor")) or NEAT_FACTOR_DEFAULT,
        # None = automaticky podľa cieľa (Configs/nutrition.py PROTEIN_G_PER_KG_AUTO)
        "protein_g_per_kg": _num(row.get("protein_g_per_kg")),
        # macros = čísla, simple = bez počítania (tanier a porcie)
        "mode": row.get("mode") if row.get("mode") in NUTRITION_MODES else "macros",
        "tdee_factor": _num(row.get("tdee_factor")),
        "consent_at": row.get("consent_at"),
        "updated_at": row.get("updated_at"),
    }


def _body_public(body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "sex": body.get("sex"),
        "birth_date": body.get("birth_date"),
        "height_cm": body.get("height_cm"),
        "weight_kg": body.get("weight_kg"),
        "bmr_measured": body.get("bmr_measured"),
    }


def service_get_nutrition_profile(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    row = db_get_nutrition_profile(user_id, ctx=ctx)
    body = load_body(user_id, ctx=ctx)
    return {
        "ok": True,
        "profile": _public_profile(row),
        # bmr_formula = ukážka vzorca v nastaveniach, keď nie je ručný ani zo scanu
        "body": {**_body_public(body), "bmr_formula": formula_bmr(body, today_local(_tz(user_id, ctx)))},
        "missing": missing_body_fields(row, body),
    }


def service_put_nutrition_profile(user_id: int, payload: Dict[str, Any], *, ctx: AuthCtx) -> Dict[str, Any]:
    existing = db_get_nutrition_profile(user_id, ctx=ctx)

    # súhlas: prvé uloženie bez neho neprejde, ďalšie si ho nesú z DB
    consent_at = (existing or {}).get("consent_at")
    if not consent_at:
        if not payload.get("consent"):
            return {"ok": False, "code": "consent_required"}
        consent_at = _now_iso()

    goal = str(payload.get("goal") or "maintain")
    if goal not in NUTRITION_GOALS:
        return {"ok": False, "code": "invalid_goal"}

    rate: Optional[float] = None
    if goal in GOAL_RATE_PCT:
        lo, default, hi = GOAL_RATE_PCT[goal]
        rate = _num(payload.get("goal_rate_pct"))
        rate = default if rate is None else rate
        if not (lo <= rate <= hi):
            return {"ok": False, "code": "invalid_goal_rate"}

    bmr = _num(payload.get("bmr_manual"))
    if bmr is not None and not (BMR_MANUAL_RANGE[0] <= bmr <= BMR_MANUAL_RANGE[1]):
        return {"ok": False, "code": "invalid_bmr"}

    neat = _num(payload.get("neat_factor"))
    neat = NEAT_FACTOR_DEFAULT if neat is None else neat
    if not (NEAT_FACTOR_RANGE[0] <= neat <= NEAT_FACTOR_RANGE[1]):
        return {"ok": False, "code": "invalid_neat"}

    # None = automaticky podľa cieľa
    protein = _num(payload.get("protein_g_per_kg"))
    if protein is not None and not (PROTEIN_G_PER_KG_RANGE[0] <= protein <= PROTEIN_G_PER_KG_RANGE[1]):
        return {"ok": False, "code": "invalid_protein"}

    mode = str(payload.get("mode") or (existing or {}).get("mode") or "macros")
    if mode not in NUTRITION_MODES:
        return {"ok": False, "code": "invalid_mode"}

    row_data: Dict[str, Any] = {
        "user_id": int(user_id),
        "goal": goal,
        "goal_rate_pct": rate,
        "bmr_manual": int(round(bmr)) if bmr else None,
        "neat_factor": round(neat, 2),
        "protein_g_per_kg": round(protein, 2) if protein is not None else None,
        "consent_at": consent_at,
        "updated_at": _now_iso(),
    }
    # PREČO len pri zmene: bez migrácie fázy 4 stĺpec mode neexistuje
    # a uloženie profilu musí ísť ďalej
    if mode != "macros" or (existing or {}).get("mode"):
        row_data["mode"] = mode
    if payload.get("reset_calibration"):
        row_data.update({"tdee_factor": None, "tdee_calibration": None, "tdee_calibrated_at": None})
    row = db_upsert_nutrition_profile(row_data, ctx=ctx)
    if not row:
        return {"ok": False, "code": "save_failed"}
    return service_get_nutrition_profile(user_id, ctx=ctx)


def service_delete_nutrition_data(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """Odvolanie súhlasu = zmazanie profilu, zápisov, obľúbených aj vlastných produktov."""
    try:
        db_delete_nutrition_data(user_id, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[NUTRITION] delete data failed user={user_id}: {repr(e)}")
        return {"ok": False, "code": "delete_failed"}
    # po zápisoch (FK set null) – a samostatne, bez tabuliek fázy 2 a 4 zmazanie prejde
    try:
        db_delete_own_products(user_id, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[NUTRITION] delete own products failed user={user_id}: {repr(e)}")
    try:
        db_delete_nutrition_days(user_id, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[NUTRITION] delete days failed user={user_id}: {repr(e)}")
    return {"ok": True}


# ---------------------------------------------------------------------------
# DENNÝ PREHĽAD
# ---------------------------------------------------------------------------


def _entry_public(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "date": str(row.get("log_date") or "")[:10],
        "meal": row.get("meal"),
        "name": row.get("name"),
        "grams": _num(row.get("grams")),
        "kcal": _num(row.get("kcal")) or 0,
        "protein_g": _num(row.get("protein_g")) or 0,
        "carbs_g": _num(row.get("carbs_g")) or 0,
        "fat_g": _num(row.get("fat_g")) or 0,
        "source": row.get("source"),
        "ai_confidence": _num(row.get("ai_confidence")),
        "created_at": row.get("created_at"),
    }


def _sum(entries: List[Dict[str, Any]]) -> Dict[str, float]:
    return {
        k: round(sum(float(e.get(k) or 0) for e in entries), 1)
        for k in ("kcal", "protein_g", "carbs_g", "fat_g")
    }


_FUEL_LOADS = ("hard", "race", "load")


def _days_meta(user_id: int, d_from: date, d_to: date, *, ctx: AuthCtx) -> Dict[str, Dict[str, Any]]:
    """nutrition_days podľa dátumu. Bez migrácie fázy 4 prázdne – nič nespadne."""
    try:
        rows = db_list_nutrition_days(user_id, d_from.isoformat(), d_to.isoformat(), ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[NUTRITION] days meta load failed user={user_id}: {repr(e)}")
        return {}
    return {str(r.get("log_date"))[:10]: r for r in rows}


def is_full_day(entries: List[Dict[str, Any]], complete: bool) -> bool:
    """
    Deň, ktorého súčet sa dá brať ako príjem: user ho označil ako celý,
    alebo má aspoň FULL_DAY_MIN_MEALS rôzne jedlá. Inak je to len časť dňa.
    """
    if complete:
        return True
    return len({e.get("meal") for e in entries if e.get("meal")}) >= FULL_DAY_MIN_MEALS


def _week_budget(
    per_day: Dict[str, Dict[str, Any]],
    by_day: Dict[str, List[Dict[str, Any]]],
    meta: Dict[str, Dict[str, Any]],
    *,
    week_from: date,
    today: date,
) -> Optional[Dict[str, Any]]:
    """
    Týždenný rozpočet (po–ne). Rozdiel minulých dní týždňa sa rozloží do
    zvyšku týždňa, najviac ±BUDGET_ADJUST_MAX.

    Minulý deň sa ráta podľa zjedeného, len keď je celý (označený), alebo
    keď zjedol viac ako cieľ (to platí aj pri neúplnom zápise – je to
    dolná hranica). Neúplný deň pod cieľom sa berie ako splnený, inak by
    zabudnutý obed znamenal „zjedz večer o 800 kcal viac“.

    PREČO: zlý deň nie je zlyhanie – vyrovná sa v ďalších dňoch. Náročné
    a pretekové dni sa neuberajú, ubrať sa dá len z ľahších dní.
    """
    week = [week_from + timedelta(days=i) for i in range(7)]
    base: Dict[str, int] = {}
    for d in week:
        t = (per_day.get(d.isoformat()) or {}).get("targets")
        if not t:
            return None
        base[d.isoformat()] = int(t["kcal"])

    diff = 0.0
    counted = 0
    for d in week:
        iso = d.isoformat()
        if d >= today:
            break
        eaten = sum(float(e.get("kcal") or 0) for e in by_day.get(iso) or [])
        complete = bool((meta.get(iso) or {}).get("complete"))
        if (complete and eaten > 0) or eaten > base[iso]:
            diff += base[iso] - eaten
            counted += 1

    remaining = [d.isoformat() for d in week if d >= today]
    adjustable = [
        iso for iso in remaining
        if not (diff < 0 and ((per_day[iso].get("breakdown") or {}).get("day_load") in _FUEL_LOADS))
    ]
    pool = sum(base[iso] for iso in adjustable)
    adj = 0.0
    if pool > 0 and abs(diff) >= BUDGET_MIN_DIFF_KCAL:
        adj = min(max(diff / pool, -BUDGET_ADJUST_MAX), BUDGET_ADJUST_MAX)
    return {
        "week_from": week_from.isoformat(),
        "week_to": (week_from + timedelta(days=6)).isoformat(),
        "week_target_kcal": sum(base.values()),
        "diff_kcal": int(round(diff)),
        "counted_days": counted,
        "adjust_pct": round(adj * 100, 1),
        "adjustable": adjustable,
    }


def _apply_budget(res: Dict[str, Any], adjust_pct: float) -> int:
    """Upraví ciele dňa o adjust_pct (bielkoviny ostávajú, min BMR). Vráti zmenu kcal."""
    t = res.get("targets") or {}
    b = res.get("breakdown") or {}
    if not t or not adjust_pct:
        return 0
    old = float(t["kcal"])
    new = max(float(b.get("bmr") or 0), old * (1 + adjust_pct / 100))
    new = round(new / 10) * 10
    rest_old = old - 4 * t["protein_g"]
    rest_new = new - 4 * t["protein_g"]
    if rest_old > 0 and rest_new > 0:
        k = rest_new / rest_old
        # tuky majú minimum (ako v nutrition_targets) – uberajú sa sacharidy
        fat_min = FAT_MIN_G_PER_KG * float(b.get("ref_weight_kg") or b.get("weight_kg") or 0)
        fat = max(t["fat_g"] * k, min(fat_min, t["fat_g"]))
        t["fat_g"] = int(round(fat))
        t["carbs_g"] = int(round(max(0.0, (rest_new - 9 * fat) / 4)))
    t["kcal"] = int(new)
    return int(new - old)


def _repeat_options(
    entries_today: List[Dict[str, Any]], prev: Dict[str, List[Dict[str, Any]]], day: date
) -> Dict[str, Dict[str, Any]]:
    """„Ako včera“: pre jedlo dňa bez zápisu posledný deň (do REPEAT_LOOKBACK_DAYS), keď ho mal."""
    have = {e.get("meal") for e in entries_today}
    out: Dict[str, Dict[str, Any]] = {}
    for meal in MEALS:
        if meal in have:
            continue
        for n in range(1, REPEAT_LOOKBACK_DAYS + 1):
            iso = (day - timedelta(days=n)).isoformat()
            rows = [e for e in prev.get(iso) or [] if e.get("meal") == meal]
            if rows:
                out[meal] = {
                    "date": iso,
                    "count": len(rows),
                    "kcal": int(round(sum(float(e.get("kcal") or 0) for e in rows))),
                    "names": [str(e.get("name") or "") for e in rows[:3]],
                }
                break
    return out


def service_get_nutrition_day(
    user_id: int, day_iso: str, *, refresh_calibration: bool = False, ctx: AuthCtx
) -> Dict[str, Any]:
    """
    Denný prehľad. `refresh_calibration` = pýta sa sám user (nie tréner) –
    vtedy sa môže prepočítať stará kalibrácia výdaja.
    """
    day = _parse_day(day_iso)
    if not day:
        return {"ok": False, "code": "invalid_date"}

    profile_row = db_get_nutrition_profile(user_id, ctx=ctx)
    if not profile_row:
        return {"ok": True, "date": day.isoformat(), "profile": None, "missing": [], "targets": None}

    body = load_body(user_id, ctx=ctx)
    missing = missing_body_fields(profile_row, body)
    today = today_local(_tz(user_id, ctx))
    if refresh_calibration and not missing:
        profile_row = service_refresh_calibration(
            user_id, profile_row=profile_row, body=body, today=today, ctx=ctx
        )

    # aktuálny týždeň od dneška = týždenný rozpočet → ciele aj zápisy za celý týždeň
    week_from = day - timedelta(days=day.weekday())
    with_budget = not missing and day >= today and week_from <= today
    d_from = week_from if with_budget else day
    d_to = week_from + timedelta(days=6) if with_budget else day
    log_from = min(d_from, day - timedelta(days=REPEAT_LOOKBACK_DAYS))

    by_day: Dict[str, List[Dict[str, Any]]] = {}
    for r in db_list_food_log(user_id, log_from.isoformat(), d_to.isoformat(), ctx=ctx):
        by_day.setdefault(str(r.get("log_date") or "")[:10], []).append(_entry_public(r))
    meta = _days_meta(user_id, min(d_from, day), d_to, ctx=ctx)
    entries = by_day.get(day.isoformat()) or []
    day_meta = meta.get(day.isoformat()) or {}

    out: Dict[str, Any] = {
        "ok": True,
        "date": day.isoformat(),
        "profile": _public_profile(profile_row),
        "missing": missing,
        "entries": entries,
        "eaten": _sum(entries),
        "complete": bool(day_meta.get("complete")),
        "suggestion": day_meta.get("suggestion") or None,
        "repeat_options": _repeat_options(entries, by_day, day),
        "calibration": calibration_public(profile_row),
        "budget": None,
        "targets": None,
        "breakdown": None,
        "exercise": [],
    }
    if missing:
        return out

    per_day = service_compute_targets_range(
        user_id, profile=profile_row, body=body, d_from=d_from, d_to=d_to, today=today, ctx=ctx
    )
    res = per_day.get(day.isoformat()) or {}
    if with_budget and res.get("targets"):
        budget = _week_budget(per_day, by_day, meta, week_from=week_from, today=today)
        if budget:
            applies = day.isoformat() in budget.pop("adjustable")
            change = _apply_budget(res, budget["adjust_pct"]) if applies else 0
            out["budget"] = {**budget, "adjust_kcal": change}
            if res.get("breakdown") is not None:
                res["breakdown"]["budget_adjust_kcal"] = change
    out.update(
        {
            "targets": res.get("targets"),
            "breakdown": res.get("breakdown"),
            "exercise": res.get("exercise") or [],
        }
    )
    return out


def service_set_day_complete(user_id: int, day_iso: str, complete: bool, *, ctx: AuthCtx) -> Dict[str, Any]:
    """„Deň mám zapísaný celý“ – berie sa do rozpočtu, kalibrácie aj varovaní."""
    day = _parse_day(day_iso)
    if not day:
        return {"ok": False, "code": "invalid_date"}
    if not db_get_nutrition_profile(user_id, ctx=ctx):
        return {"ok": False, "code": "profile_required"}
    try:
        db_upsert_nutrition_day(
            {"user_id": int(user_id), "log_date": day.isoformat(), "complete": bool(complete), "updated_at": _now_iso()},
            ctx=ctx,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[NUTRITION] set complete failed user={user_id}: {repr(e)}")
        return {"ok": False, "code": "save_failed"}
    return {"ok": True, "date": day.isoformat(), "complete": bool(complete)}


# ---------------------------------------------------------------------------
# ZÁPIS JEDLA
# ---------------------------------------------------------------------------


def clean_food_item(raw: Any) -> Optional[Dict[str, Any]]:
    """Jedna položka jedla (aj z AI) – None, ak je neplatná."""
    if not isinstance(raw, dict):
        return None
    name = str(raw.get("name") or "").strip()[:_MAX_NAME]
    if not name:
        return None
    grams = _num(raw.get("grams"))
    if grams is not None and not (0 < grams <= _MAX_GRAMS):
        return None
    vals: Dict[str, float] = {}
    for key, cap in (("protein_g", _MAX_MACRO_G), ("carbs_g", _MAX_MACRO_G), ("fat_g", _MAX_MACRO_G)):
        v = _num(raw.get(key))
        v = 0.0 if v is None else v
        if not (0 <= v <= cap):
            return None
        vals[key] = round(v, 1)
    kcal = _num(raw.get("kcal"))
    if kcal is None:
        kcal = 4 * vals["protein_g"] + 4 * vals["carbs_g"] + 9 * vals["fat_g"]
    if not (0 <= kcal <= _MAX_KCAL):
        return None
    return {
        "name": name,
        "grams": round(grams, 1) if grams is not None else None,
        "kcal": round(kcal, 1),
        **vals,
    }


def service_add_food_log(user_id: int, payload: Dict[str, Any], *, ctx: AuthCtx) -> Dict[str, Any]:
    if not db_get_nutrition_profile(user_id, ctx=ctx):
        return {"ok": False, "code": "profile_required"}

    day = _parse_day(payload.get("date"))
    if not day:
        return {"ok": False, "code": "invalid_date"}
    meal = str(payload.get("meal") or "")
    if meal not in MEALS:
        return {"ok": False, "code": "invalid_meal"}
    source = str(payload.get("source") or "manual")
    if source not in FOOD_LOG_SOURCES:
        return {"ok": False, "code": "invalid_source"}

    raw_items = payload.get("items") or []
    if not isinstance(raw_items, list) or not raw_items or len(raw_items) > MAX_ITEMS_PER_LOG:
        return {"ok": False, "code": "invalid_items"}
    items = [clean_food_item(it) for it in raw_items]
    if any(it is None for it in items):
        return {"ok": False, "code": "invalid_items"}

    # produkt (čiarový kód / etiketa) = jedna položka; hodnoty sa aj tak kopírujú
    product_id = payload.get("product_id")
    if product_id is not None:
        if len(items) != 1 or not service_product_visible(int(product_id), ctx=ctx):
            return {"ok": False, "code": "invalid_product"}

    conf = _num(payload.get("ai_confidence"))
    conf = min(max(conf, 0.0), 1.0) if conf is not None else None
    raw_input = str(payload.get("raw_input") or "").strip()[:_MAX_RAW] or None

    rows = [
        {
            "user_id": int(user_id),
            "log_date": day.isoformat(),
            "meal": meal,
            "product_id": int(product_id) if product_id is not None else None,
            **it,
            "source": source,
            "ai_confidence": conf,
            "raw_input": raw_input,
        }
        for it in items
        if it
    ]
    inserted = db_insert_food_log(rows, ctx=ctx)
    if not inserted:
        return {"ok": False, "code": "save_failed"}
    return {"ok": True, "entries": [_entry_public(r) for r in inserted]}


def service_update_food_log(user_id: int, entry_id: int, payload: Dict[str, Any], *, ctx: AuthCtx) -> Dict[str, Any]:
    existing = db_get_food_log_entry(user_id, entry_id, ctx=ctx)
    if not existing:
        return {"ok": False, "code": "not_found"}

    # payload nesie len polia, ktoré FE poslal (exclude_unset) – grams: null = bez gramov
    fields: Dict[str, Any] = {}
    if any(k in payload for k in ("name", "grams", "kcal", "protein_g", "carbs_g", "fat_g")):
        merged = {**_entry_public(existing), **payload}
        item = clean_food_item(merged)
        if not item:
            return {"ok": False, "code": "invalid_items"}
        fields.update(item)
    if payload.get("meal") is not None:
        if payload["meal"] not in MEALS:
            return {"ok": False, "code": "invalid_meal"}
        fields["meal"] = payload["meal"]
    if payload.get("date") is not None:
        day = _parse_day(payload["date"])
        if not day:
            return {"ok": False, "code": "invalid_date"}
        fields["log_date"] = day.isoformat()
    if not fields:
        return {"ok": True, "entry": _entry_public(existing)}

    fields["updated_at"] = _now_iso()
    row = db_update_food_log(user_id, entry_id, fields, ctx=ctx)
    if not row:
        return {"ok": False, "code": "save_failed"}
    return {"ok": True, "entry": _entry_public(row)}


def service_delete_food_log(user_id: int, entry_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    if not db_delete_food_log(user_id, entry_id, ctx=ctx):
        return {"ok": False, "code": "not_found"}
    return {"ok": True}


def service_copy_meal(user_id: int, payload: Dict[str, Any], *, ctx: AuthCtx) -> Dict[str, Any]:
    """„Ako včera“ – skopíruje zápisy jedného jedla dňa na iný deň (source copy)."""
    src = _parse_day(payload.get("from_date"))
    dst = _parse_day(payload.get("to_date"))
    if not src or not dst or src == dst:
        return {"ok": False, "code": "invalid_date"}
    meal = str(payload.get("meal") or "")
    if meal not in MEALS:
        return {"ok": False, "code": "invalid_meal"}
    to_meal = str(payload.get("to_meal") or meal)
    if to_meal not in MEALS:
        return {"ok": False, "code": "invalid_meal"}
    if not db_get_nutrition_profile(user_id, ctx=ctx):
        return {"ok": False, "code": "profile_required"}

    rows = [r for r in db_list_food_log(user_id, src.isoformat(), src.isoformat(), ctx=ctx) if r.get("meal") == meal]
    if not rows:
        return {"ok": False, "code": "not_found"}
    new_rows = []
    for r in rows[:MAX_ITEMS_PER_LOG]:
        e = _entry_public(r)
        new_rows.append({
            "user_id": int(user_id),
            "log_date": dst.isoformat(),
            "meal": to_meal,
            "product_id": r.get("product_id"),
            **{k: e[k] for k in ("name", "grams", "kcal", "protein_g", "carbs_g", "fat_g")},
            "source": "copy",
            "ai_confidence": None,
            "raw_input": None,
        })
    inserted = db_insert_food_log(new_rows, ctx=ctx)
    if not inserted:
        return {"ok": False, "code": "save_failed"}
    return {"ok": True, "entries": [_entry_public(r) for r in inserted]}


def service_recent_foods(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    """Nedávne jedlá – posledný výskyt každého názvu za RECENT_DAYS dní."""
    since = (today_local(_tz(user_id, ctx)) - timedelta(days=RECENT_DAYS)).isoformat()
    seen: set = set()
    items: List[Dict[str, Any]] = []
    for row in db_list_food_log_recent(user_id, since, ctx=ctx):
        key = str(row.get("name") or "").strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        e = _entry_public(row)
        items.append({k: e[k] for k in ("name", "grams", "kcal", "protein_g", "carbs_g", "fat_g", "meal")})
        if len(items) >= RECENT_LIMIT:
            break
    return {"ok": True, "items": items}


# ---------------------------------------------------------------------------
# OBĽÚBENÉ
# ---------------------------------------------------------------------------


def _fav_public(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "meal": row.get("meal"),
        "items": row.get("items") or [],
        "kcal": _num(row.get("kcal")) or 0,
        "protein_g": _num(row.get("protein_g")) or 0,
        "carbs_g": _num(row.get("carbs_g")) or 0,
        "fat_g": _num(row.get("fat_g")) or 0,
    }


def service_list_favorites(user_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    return {"ok": True, "items": [_fav_public(r) for r in db_list_food_favorites(user_id, ctx=ctx)]}


def service_add_favorite(user_id: int, payload: Dict[str, Any], *, ctx: AuthCtx) -> Dict[str, Any]:
    if not db_get_nutrition_profile(user_id, ctx=ctx):
        return {"ok": False, "code": "profile_required"}
    name = str(payload.get("name") or "").strip()[:_MAX_NAME]
    if not name:
        return {"ok": False, "code": "invalid_name"}
    meal = payload.get("meal")
    if meal is not None and meal not in MEALS:
        return {"ok": False, "code": "invalid_meal"}
    raw_items = payload.get("items") or []
    if not isinstance(raw_items, list) or not raw_items or len(raw_items) > MAX_ITEMS_PER_LOG:
        return {"ok": False, "code": "invalid_items"}
    items = [clean_food_item(it) for it in raw_items]
    if any(it is None for it in items):
        return {"ok": False, "code": "invalid_items"}
    if len(db_list_food_favorites(user_id, ctx=ctx)) >= MAX_FAVORITES:
        return {"ok": False, "code": "favorites_limit"}

    totals = _sum([it for it in items if it])
    row = db_insert_food_favorite(
        {"user_id": int(user_id), "name": name, "meal": meal, "items": items, **totals},
        ctx=ctx,
    )
    if not row:
        return {"ok": False, "code": "save_failed"}
    return {"ok": True, "favorite": _fav_public(row)}


def service_delete_favorite(user_id: int, fav_id: int, *, ctx: AuthCtx) -> Dict[str, Any]:
    if not db_delete_food_favorite(user_id, fav_id, ctx=ctx):
        return {"ok": False, "code": "not_found"}
    return {"ok": True}


# ---------------------------------------------------------------------------
# TÝŽDEŇ (fáza 3) – prehľad na stránke aj sumár pre AI
# ---------------------------------------------------------------------------


def _pct(part: float, whole: float) -> Optional[int]:
    return int(round(part / whole * 100)) if whole > 0 else None


def fast_loss(body: Dict[str, Any], today: date) -> Optional[Dict[str, Any]]:
    """Váha klesá rýchlejšie ako FAST_LOSS_PCT_PER_WEEK % týždenne (trend za WEIGHT_TREND_DAYS dní)."""
    d_from = today - timedelta(days=WEIGHT_TREND_DAYS)
    points = weight_points(body.get("weight_trend") or [], d_from, today)
    if len(points) < 3 or points[-1][0] - points[0][0] < 10:
        return None
    slope = weight_slope(points)
    kg = points[-1][1]
    if slope is None or not kg:
        return None
    pct = -slope * 7 / kg * 100
    if pct <= FAST_LOSS_PCT_PER_WEEK:
        return None
    return {"pct_per_week": round(pct, 1), "kg_per_week": round(-slope * 7, 2)}


def _warnings(days: List[Dict[str, Any]], body: Dict[str, Any], today: date) -> Dict[str, Any]:
    """
    Varovania pre usera aj AI trénera: dlhodobé podjedenie (riziko RED-S –
    nízka dostupnosť energie), málo sacharidov v náročné dni, rýchly pokles
    váhy. Len z celých dní – neúplný zápis nie je podjedenie.
    """
    out: Dict[str, Any] = {}
    full = [d for d in days if d["full"] and d["targets"] and d["date"] < today.isoformat()]
    if len(full) >= UNDERFUEL_MIN_LOGGED_DAYS:
        pct = _pct(
            sum(float(d["eaten"]["kcal"]) for d in full),
            sum(float(d["targets"]["kcal"]) for d in full),
        )
        if pct is not None and pct < UNDERFUEL_KCAL_PCT:
            out["underfuel"] = {"kcal_pct": pct, "days": len(full)}
    low = []
    for d in full:
        if d["day_load"] not in _FUEL_LOADS:
            continue
        pct = _pct(d["eaten"]["carbs_g"], d["targets"]["carbs_g"])
        if pct is not None and pct < UNDERFUEL_HARD_CARBS_PCT:
            low.append({"date": d["date"], "carbs_pct": pct})
    if low:
        out["low_carb_hard_days"] = low
    fl = fast_loss(body, today)
    if fl:
        out["fast_loss"] = fl
    return out


def _range_overview(user_id: int, d_from: date, d_to: date, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    """Dni v [d_from, d_to] s cieľmi a zjedeným + súhrn zapísaných dní do dneška. None = bez profilu."""
    profile_row = db_get_nutrition_profile(user_id, ctx=ctx)
    if not profile_row:
        return None
    body = load_body(user_id, ctx=ctx)
    missing = missing_body_fields(profile_row, body)
    today = today_local(_tz(user_id, ctx))

    by_day: Dict[str, List[Dict[str, Any]]] = {}
    for row in db_list_food_log(user_id, d_from.isoformat(), d_to.isoformat(), ctx=ctx):
        by_day.setdefault(str(row.get("log_date") or "")[:10], []).append(_entry_public(row))
    meta = _days_meta(user_id, d_from, d_to, ctx=ctx)

    per_day: Dict[str, Dict[str, Any]] = {}
    if not missing:
        per_day = service_compute_targets_range(
            user_id, profile=profile_row, body=body, d_from=d_from, d_to=d_to, today=today, ctx=ctx
        )

    days: List[Dict[str, Any]] = []
    for i in range((d_to - d_from).days + 1):
        iso = (d_from + timedelta(days=i)).isoformat()
        res = per_day.get(iso) or {}
        entries = by_day.get(iso) or []
        complete = bool((meta.get(iso) or {}).get("complete"))
        days.append(
            {
                "date": iso,
                "logged": bool(entries),
                "complete": complete,
                "full": bool(entries) and is_full_day(entries, complete),
                "eaten": _sum(entries),
                "targets": res.get("targets"),
                "day_load": (res.get("breakdown") or {}).get("day_load"),
            }
        )

    # súhrn len zo zapísaných dní do dneška – nezapísaný deň nie je „0 kcal“
    done = [d for d in days if d["logged"] and d["date"] <= today.isoformat() and d["targets"]]
    n = len(done)
    summary: Dict[str, Any] = {"logged_days": n, "full_days": sum(1 for d in done if d["full"])}
    if n:
        avg = lambda key, src: round(sum(float(d[src][key]) for d in done) / n)  # noqa: E731
        summary.update(
            {
                "avg_kcal": avg("kcal", "eaten"),
                "avg_target_kcal": avg("kcal", "targets"),
                "avg_protein_g": avg("protein_g", "eaten"),
                "avg_target_protein_g": avg("protein_g", "targets"),
            }
        )
        summary["kcal_pct"] = _pct(summary["avg_kcal"], summary["avg_target_kcal"])
        summary["protein_pct"] = _pct(summary["avg_protein_g"], summary["avg_target_protein_g"])
        hard = [d for d in done if d["day_load"] in _FUEL_LOADS]
        summary["hard_days"] = [
            {
                "date": d["date"],
                "carbs_g": round(d["eaten"]["carbs_g"]),
                "target_carbs_g": d["targets"]["carbs_g"],
                "carbs_pct": _pct(d["eaten"]["carbs_g"], d["targets"]["carbs_g"]),
            }
            for d in hard
        ]
    return {
        "goal": profile_row.get("goal") or "maintain",
        "mode": _public_profile(profile_row)["mode"],
        "missing": missing,
        "days": days,
        "summary": summary,
        "warnings": _warnings(days, body, today),
    }


def service_get_nutrition_week(user_id: int, end_iso: Optional[str], *, ctx: AuthCtx) -> Dict[str, Any]:
    """7 dní končiacich `end_iso` (predvolene dnes)."""
    end = _parse_day(end_iso) if end_iso else today_local(_tz(user_id, ctx))
    if not end:
        return {"ok": False, "code": "invalid_date"}
    res = _range_overview(user_id, end - timedelta(days=6), end, ctx=ctx)
    if res is None:
        return {"ok": True, "profile": False, "days": [], "summary": {"logged_days": 0}}
    return {"ok": True, "profile": True, **res}


def service_nutrition_summary_for_ai(
    user_id: int, d_from: date, d_to: date, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """
    Sumár výživy pre advisor review / athlete state. None = nič do AI
    (funkcia vypnutá, bez profilu alebo málo zapísaných dní).

    AI výživu len komentuje – ciele počíta BE a AI ich nesmie meniť.
    """
    from Services.features import service_feature_enabled

    try:
        if not service_feature_enabled(user_id, "nutrition"):
            return None
        res = _range_overview(user_id, d_from, d_to, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        # vedľajší blok – chyba nesmie zhodiť hodnotenie
        print(f"[NUTRITION] AI summary failed user={user_id}: {repr(e)}")
        return None
    if not res or res["missing"]:
        return None
    summary = res["summary"]
    warnings = res.get("warnings") or {}
    # rýchly pokles váhy ide do AI aj bez zapisovania jedla
    if summary.get("logged_days", 0) < NUTRITION_AI_MIN_LOGGED_DAYS and not warnings.get("fast_loss"):
        return None
    return {
        "goal": res["goal"],
        "days_in_window": (d_to - d_from).days + 1,
        **summary,
        "warnings": warnings,
    }

