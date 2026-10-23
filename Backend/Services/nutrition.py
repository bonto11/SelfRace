# Services/nutrition.py
"""
Výživa: profil (cieľ + súhlas), denný prehľad, zápis jedla, obľúbené, nedávne.

Ciele počíta Services/nutrition_targets.py. AI návrh jedla z textu je
v Services/AI/nutrition – do food_log ide až to, čo user potvrdí (tu).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from Configs.nutrition import (
    BMR_MANUAL_RANGE,
    NUTRITION_AI_MIN_LOGGED_DAYS,
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
)
from DB.nutrition import (
    db_delete_food_favorite,
    db_delete_food_log,
    db_delete_nutrition_data,
    db_delete_own_products,
    db_get_food_log_entry,
    db_get_nutrition_profile,
    db_insert_food_favorite,
    db_insert_food_log,
    db_list_food_favorites,
    db_list_food_log,
    db_list_food_log_recent,
    db_update_food_log,
    db_upsert_nutrition_profile,
)
from Modules.Supabase.auth import AuthCtx
from Services.nutrition_targets import (
    load_body,
    missing_body_fields,
    service_compute_targets_range,
    today_local,
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
        "body": _body_public(body),
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

    row = db_upsert_nutrition_profile(
        {
            "user_id": int(user_id),
            "goal": goal,
            "goal_rate_pct": rate,
            "bmr_manual": int(round(bmr)) if bmr else None,
            "neat_factor": round(neat, 2),
            "protein_g_per_kg": round(protein, 2) if protein is not None else None,
            "consent_at": consent_at,
            "updated_at": _now_iso(),
        },
        ctx=ctx,
    )
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
    # po zápisoch (FK set null) – a samostatne, bez tabuľky fázy 2 zmazanie prejde
    try:
        db_delete_own_products(user_id, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[NUTRITION] delete own products failed user={user_id}: {repr(e)}")
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


def service_get_nutrition_day(user_id: int, day_iso: str, *, ctx: AuthCtx) -> Dict[str, Any]:
    day = _parse_day(day_iso)
    if not day:
        return {"ok": False, "code": "invalid_date"}

    profile_row = db_get_nutrition_profile(user_id, ctx=ctx)
    if not profile_row:
        return {"ok": True, "date": day.isoformat(), "profile": None, "missing": [], "targets": None}

    body = load_body(user_id, ctx=ctx)
    missing = missing_body_fields(profile_row, body)

    entries = [_entry_public(r) for r in db_list_food_log(user_id, day.isoformat(), day.isoformat(), ctx=ctx)]
    out: Dict[str, Any] = {
        "ok": True,
        "date": day.isoformat(),
        "profile": _public_profile(profile_row),
        "missing": missing,
        "entries": entries,
        "eaten": _sum(entries),
        "targets": None,
        "breakdown": None,
        "exercise": [],
    }
    if missing:
        return out

    today = today_local(_tz(user_id, ctx))
    per_day = service_compute_targets_range(
        user_id, profile=profile_row, body=body, d_from=day, d_to=day, today=today, ctx=ctx
    )
    res = per_day.get(day.isoformat()) or {}
    out.update(
        {
            "targets": res.get("targets"),
            "breakdown": res.get("breakdown"),
            "exercise": res.get("exercise") or [],
        }
    )
    return out


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
        days.append(
            {
                "date": iso,
                "logged": bool(entries),
                "eaten": _sum(entries),
                "targets": res.get("targets"),
                "day_load": (res.get("breakdown") or {}).get("day_load"),
            }
        )

    # súhrn len zo zapísaných dní do dneška – nezapísaný deň nie je „0 kcal“
    done = [d for d in days if d["logged"] and d["date"] <= today.isoformat() and d["targets"]]
    n = len(done)
    summary: Dict[str, Any] = {"logged_days": n}
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
        hard = [d for d in done if d["day_load"] == "hard"]
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
        "missing": missing,
        "days": days,
        "summary": summary,
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
    if summary.get("logged_days", 0) < NUTRITION_AI_MIN_LOGGED_DAYS:
        return None
    return {
        "goal": res["goal"],
        "days_in_window": (d_to - d_from).days + 1,
        **summary,
    }

