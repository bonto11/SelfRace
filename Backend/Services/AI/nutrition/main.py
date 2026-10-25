# Services/AI/nutrition/main.py
"""
AI návrhy pre zápis jedla – z textu, z fotky taniera a z fotky etikety –
a návrh jedál na zvyšok dňa.

Do food_log sa nič neukladá: návrh ide na FE, user ho upraví a potvrdí
(POST /log, pri etikete POST /products). Návrh jedál sa odloží do
nutrition_days (raz za deň, nový len na požiadanie). Účtuje sa len platný
návrh – prázdny alebo nečitateľný user nemôže použiť. Fotky sa na serveri
neukladajú, idú len do AI.
"""

from __future__ import annotations

import base64
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from Configs.nutrition import (
    AI_TEXT_MAX_LEN,
    MAX_ITEMS_PER_LOG,
    SUGGEST_MIN_REMAINING_KCAL,
    SUGGEST_SCALE_RANGE,
)
from DB.nutrition import db_upsert_nutrition_day
from Modules.Supabase.auth import AuthCtx
from Services.AI.nutrition.generate import (
    generate_food_label_json,
    generate_food_photo_json,
    generate_food_suggest_json,
    generate_food_text_json,
)
from Services.AI.utils.billing import (
    extract_usage_from_trace,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
    log_ai_usage_for_user,
)
from Services.nutrition import (
    clean_food_item,
    service_get_nutrition_day,
    service_list_favorites,
    service_recent_foods,
)
from Services.nutrition_products import clean_product_payload
from Services.user_prefs import service_get_user_language, service_get_user_timezone

_KJ_PER_KCAL = 4.184


def _quota_error(user_id: int, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {"ok": False, "code": "ai_quota_exceeded", "used_tokens_this_month": used}
    return None


def _lang(user_id: int, ctx: AuthCtx) -> str:
    try:
        return service_get_user_language(user_id, ctx=ctx)
    except Exception:  # noqa: BLE001
        return "sk"


def _bill(user_id: int, trace: Dict[str, Any], job_type: str, meta: Dict[str, Any], *, ctx: AuthCtx) -> None:
    usage = extract_usage_from_trace(trace)
    if not usage:
        return
    try:
        log_ai_usage_for_user(
            user_id=user_id,
            usage=usage,
            job_type=job_type,
            source="user",
            billed_via="internal",
            charge_wallet=False,
            meta={**meta, "provider": trace.get("ok_provider") or trace.get("provider"), "model": trace.get("ok_model")},
            ctx=ctx,
        )
    except Exception as e:  # noqa: BLE001
        print(f"❌ [AI_BILLING] {job_type} error: {repr(e)}")


def _items_result(
    user_id: int,
    data: Optional[Dict[str, Any]],
    trace: Dict[str, Any],
    err: Optional[str],
    *,
    job_type: str,
    raw_input: Optional[str],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """Spoločné spracovanie návrhu položiek (text aj fotka taniera)."""
    if not data:
        print(f"❌ [NUTRITION_AI] {job_type} failed user={user_id}: {err}")
        return {"ok": False, "code": "ai_generation_failed"}

    raw_items = data.get("items") if isinstance(data.get("items"), list) else None
    if raw_items is None:
        print(f"❌ [NUTRITION_AI] {job_type} invalid output user={user_id}, not billed")
        return {"ok": False, "code": "ai_generation_failed"}

    items: List[Dict[str, Any]] = []
    for raw in raw_items[:MAX_ITEMS_PER_LOG]:
        item = clean_food_item(raw)
        if item:
            items.append(item)
    # PREČO bez účtovania: prázdny návrh user nemôže použiť (spec: user platí
    # len za výstup, ktorý reálne dostane)
    if not items:
        return {"ok": False, "code": "no_food_found"}

    try:
        conf: Optional[float] = min(max(float(data.get("confidence")), 0.0), 1.0)
    except (TypeError, ValueError):
        conf = None
    note = data.get("note")
    note = str(note).strip()[:200] if isinstance(note, str) and note.strip() else None

    _bill(user_id, trace, job_type, {"items": len(items)}, ctx=ctx)
    return {"ok": True, "items": items, "confidence": conf, "note": note, "raw_input": raw_input}


def service_parse_food_text(user_id: int, text: str, *, ctx: AuthCtx) -> Dict[str, Any]:
    clean = " ".join(str(text or "").split())[:AI_TEXT_MAX_LEN]
    if not clean:
        return {"ok": False, "code": "empty_text"}
    quota = _quota_error(user_id, ctx)
    if quota:
        return quota
    data, trace, err = generate_food_text_json(text=clean, lang=_lang(user_id, ctx))
    return _items_result(user_id, data, trace, err, job_type="nutrition_text", raw_input=clean, ctx=ctx)


def service_parse_food_photo(
    user_id: int, image: Tuple[bytes, str], *, hint: str = "", ctx: AuthCtx
) -> Dict[str, Any]:
    """Fotka taniera → rovnaký návrh položiek ako z textu."""
    quota = _quota_error(user_id, ctx)
    if quota:
        return quota
    hint_clean = " ".join(str(hint or "").split())[:200]
    data, trace, err = generate_food_photo_json(
        image=(base64.b64encode(image[0]).decode("ascii"), image[1]),
        lang=_lang(user_id, ctx),
        hint=hint_clean,
    )
    return _items_result(
        user_id, data, trace, err, job_type="nutrition_photo", raw_input=hint_clean or None, ctx=ctx
    )


def _label_values(block: Any) -> Dict[str, Optional[float]]:
    block = block if isinstance(block, dict) else {}

    def num(k: str) -> Optional[float]:
        try:
            v = float(block.get(k))
        except (TypeError, ValueError):
            return None
        return v if v == v and v >= 0 else None

    kcal = num("kcal")
    kj = num("energy_kj")
    # PREČO tu a nie v AI: prepočet je deterministický, AI má len prepisovať
    if kcal is None and kj is not None:
        kcal = kj / _KJ_PER_KCAL
    return {
        "kcal": kcal,
        "protein": num("protein_g"),
        "carbs": num("carbs_g"),
        "fat": num("fat_g"),
        "fiber": num("fiber_g"),
        "sugar": num("sugar_g"),
        "salt": num("salt_g"),
    }


def service_parse_food_label(
    user_id: int,
    label: Tuple[bytes, str],
    front: Optional[Tuple[bytes, str]],
    *,
    barcode: Optional[str],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """Fotka etikety → návrh produktu (na 100 g). Uloží sa až po potvrdení."""
    quota = _quota_error(user_id, ctx)
    if quota:
        return quota

    data, trace, err = generate_food_label_json(
        label=(base64.b64encode(label[0]).decode("ascii"), label[1]),
        front=(base64.b64encode(front[0]).decode("ascii"), front[1]) if front else None,
    )
    if not data:
        print(f"❌ [NUTRITION_AI] label failed user={user_id}: {err}")
        return {"ok": False, "code": "ai_generation_failed"}

    serving = data.get("serving_g")
    try:
        serving_g: Optional[float] = float(serving) if serving is not None else None
    except (TypeError, ValueError):
        serving_g = None
    if serving_g is not None and not (0 < serving_g <= 5000):
        serving_g = None

    per100 = _label_values(data.get("per_100g"))
    if per100["kcal"] is None:
        # len stĺpec na porciu – na 100 g ho prepočíta BE, nie AI
        per_serving = _label_values(data.get("per_serving"))
        if per_serving["kcal"] is not None and serving_g:
            f = 100.0 / serving_g
            per100 = {k: (v * f if v is not None else None) for k, v in per_serving.items()}

    if data.get("readable") is False or per100["kcal"] is None:
        return {"ok": False, "code": "label_unreadable"}

    draft_raw = {
        "barcode": barcode,
        "name": data.get("name") or data.get("brand") or "",
        "brand": data.get("brand"),
        "kcal_100g": per100["kcal"],
        **{f"{k}_100g": per100[k] for k in ("protein", "carbs", "fat", "fiber", "sugar", "salt")},
        "serving_g": serving_g,
        "source": "label_ai",
    }
    # bez názvu na obale nech ho user doplní – návrh je aj tak na kontrolu
    draft = clean_product_payload({**draft_raw, "name": draft_raw["name"] or "?"})
    if not draft:
        print(f"❌ [NUTRITION_AI] label values out of range user={user_id}: {per100}")
        return {"ok": False, "code": "label_unreadable"}
    if draft["name"] == "?":
        draft["name"] = ""

    _bill(user_id, trace, "nutrition_label", {"has_front": front is not None}, ctx=ctx)
    return {"ok": True, "product": draft}



# ---------------------------------------------------------------------------
# NÁVRH JEDÁL NA ZVYŠOK DŇA
# ---------------------------------------------------------------------------

_MAIN_MEALS = ("breakfast", "lunch", "dinner")
_MAX_CANDIDATE_FAVORITES = 12
_MAX_CANDIDATE_RECENT = 25
_MACROS = ("kcal", "protein_g", "carbs_g", "fat_g")


def _local_now(user_id: int, ctx: AuthCtx) -> datetime:
    try:
        tz = ZoneInfo(service_get_user_timezone(user_id, ctx=ctx) or "Europe/Bratislava")
    except Exception:  # noqa: BLE001
        tz = ZoneInfo("Europe/Bratislava")
    return datetime.now(tz)


def _open_meals(entries: List[Dict[str, Any]], *, hour: Optional[int], session_ahead: bool) -> List[str]:
    """Jedlá dňa, ktoré ešte nie sú zapísané (dnes podľa hodiny). Snack len pred tréningom alebo navečer."""
    have = {e.get("meal") for e in entries}
    late = {"breakfast": 11, "lunch": 16, "dinner": 22}
    meals = [m for m in _MAIN_MEALS if m not in have and (hour is None or hour < late[m])]
    if "snack" not in have and (session_ahead or not meals):
        meals.append("snack")
    return meals


def _candidates(user_id: int, ctx: AuthCtx) -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    """Jedlá, ktoré user už jedáva (obľúbené, nedávne) → zoznam pre AI a mapa ref → položky."""
    out: List[Dict[str, Any]] = []
    refs: Dict[str, Dict[str, Any]] = {}
    try:
        favs = service_list_favorites(user_id, ctx=ctx).get("items") or []
    except Exception:  # noqa: BLE001
        favs = []
    for i, fav in enumerate(favs[:_MAX_CANDIDATE_FAVORITES], 1):
        ref = f"f{i}"
        refs[ref] = {"items": fav.get("items") or []}
        out.append({"id": ref, "name": fav.get("name"), "meal": fav.get("meal"),
                    **{k: round(float(fav.get(k) or 0)) for k in _MACROS}})
    try:
        recent = service_recent_foods(user_id, ctx=ctx).get("items") or []
    except Exception:  # noqa: BLE001
        recent = []
    for i, it in enumerate(recent[:_MAX_CANDIDATE_RECENT], 1):
        ref = f"r{i}"
        refs[ref] = {"items": [it]}
        out.append({"id": ref, "name": it.get("name"), "grams": it.get("grams"), "meal": it.get("meal"),
                    **{k: round(float(it.get(k) or 0)) for k in _MACROS}})
    return out, refs


def _scaled(item: Dict[str, Any], k: float) -> Optional[Dict[str, Any]]:
    """Položka × k; gramy na 5 g a makrá podľa skutočného pomeru gramov."""
    grams = item.get("grams")
    if grams:
        new_g = max(5.0, round(float(grams) * k / 5) * 5)
        k = new_g / float(grams)
    else:
        new_g = None
    return clean_food_item({
        "name": item.get("name"),
        "grams": new_g,
        **{m: float(item.get(m) or 0) * k for m in _MACROS},
    })


def _resolve_item(raw: Any, refs: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Jedna položka AI → položky jedla. Čísla počíta BE (z obľúbených/nedávnych alebo zo 100 g)."""
    if not isinstance(raw, dict):
        return []
    ref = raw.get("ref")
    if ref:
        src = refs.get(str(ref))
        if not src:
            return []
        try:
            portion = min(max(float(raw.get("portion") or 1), 0.25), 3.0)
        except (TypeError, ValueError):
            portion = 1.0
        return [it for it in (_scaled(x, portion) for x in src["items"]) if it]
    try:
        grams = float(raw.get("grams"))
        per = {m: float(raw.get(f"{m.replace('_g', '')}_100g") or 0) for m in _MACROS}
    except (TypeError, ValueError):
        return []
    if not (0 < grams <= 1500) or not (0 < per["kcal"] <= 900):
        return []
    if any(not (0 <= per[m] <= 100) for m in ("protein_g", "carbs_g", "fat_g")):
        return []
    item = clean_food_item({"name": raw.get("name"), "grams": grams, **{m: per[m] * grams / 100 for m in _MACROS}})
    return [item] if item else []


def _sum_items(items: List[Dict[str, Any]]) -> Dict[str, int]:
    return {m: int(round(sum(float(it.get(m) or 0) for it in items))) for m in _MACROS}


def service_suggest_meals(user_id: int, payload: Dict[str, Any], *, ctx: AuthCtx) -> Dict[str, Any]:
    """
    Čo zjesť na zvyšok dňa – z jedál, ktoré user jedáva, plus bežné jedlá.
    AI vyberá jedlá a pomer, BE prepočíta makrá a gramy dorovná na zvyšok
    dňa (AI v počítaní chybuje). Návrh sa drží v nutrition_days – nový
    len s `force` (každý nový sa účtuje).
    """
    now = _local_now(user_id, ctx)
    today = now.date()
    try:
        day = date.fromisoformat(str(payload.get("date") or today.isoformat())[:10])
    except ValueError:
        return {"ok": False, "code": "invalid_date"}
    if day < today or day > today + timedelta(days=1):
        return {"ok": False, "code": "invalid_date"}

    data = service_get_nutrition_day(user_id, day.isoformat(), ctx=ctx)
    if not data.get("ok"):
        return data
    if not data.get("profile"):
        return {"ok": False, "code": "profile_required"}
    if data.get("missing") or not data.get("targets"):
        return {"ok": False, "code": "missing_body"}
    if data.get("suggestion") and not payload.get("force"):
        return {"ok": True, "suggestion": data["suggestion"], "cached": True}

    targets, eaten = data["targets"], data.get("eaten") or {}
    remaining = {m: max(0, int(round(float(targets[m]) - float(eaten.get(m) or 0)))) for m in _MACROS}
    if remaining["kcal"] < SUGGEST_MIN_REMAINING_KCAL:
        return {"ok": False, "code": "nothing_left"}

    sessions = [
        {
            "title": it.get("title"),
            "sport": it.get("sport"),
            "minutes": it.get("minutes"),
            "load": it.get("load"),
            "done": it.get("source") in ("activity", "strength_log"),
        }
        for it in data.get("exercise") or []
        if not it.get("event")
    ]
    session_ahead = any(not s["done"] for s in sessions)
    entries = data.get("entries") or []
    open_meals = _open_meals(entries, hour=now.hour if day == today else None, session_ahead=session_ahead)

    quota = _quota_error(user_id, ctx)
    if quota:
        return quota

    candidates, refs = _candidates(user_id, ctx)
    breakdown = data.get("breakdown") or {}
    context = {
        "date": day.isoformat(),
        "local_time": now.strftime("%H:%M") if day == today else None,
        "goal": breakdown.get("goal"),
        "day_load": breakdown.get("day_load"),
        "remaining": remaining,
        "open_meals": open_meals,
        "sessions": sessions,
        "eaten_today": [e.get("name") for e in entries][:20],
        "candidates": candidates,
    }
    ai, trace, err = generate_food_suggest_json(context=context, lang=_lang(user_id, ctx))
    if not ai:
        print(f"❌ [NUTRITION_AI] suggest failed user={user_id}: {err}")
        return {"ok": False, "code": "ai_generation_failed"}

    meals: List[Dict[str, Any]] = []
    for raw in (ai.get("meals") if isinstance(ai.get("meals"), list) else [])[:4]:
        if not isinstance(raw, dict) or raw.get("meal") not in open_meals:
            continue
        items: List[Dict[str, Any]] = []
        for it in (raw.get("items") if isinstance(raw.get("items"), list) else [])[:6]:
            items.extend(_resolve_item(it, refs))
        if not items:
            continue
        meals.append({
            "meal": raw["meal"],
            "title": str(raw.get("title") or "").strip()[:80] or None,
            "why": str(raw.get("why") or "").strip()[:200] or None,
            "items": items[:MAX_ITEMS_PER_LOG],
        })
    # prázdny návrh user nepoužije – neúčtuje sa ani neukladá
    if not meals:
        print(f"❌ [NUTRITION_AI] suggest empty user={user_id}, not billed")
        return {"ok": False, "code": "ai_generation_failed"}

    total = sum(float(it["kcal"]) for m in meals for it in m["items"])
    lo, hi = SUGGEST_SCALE_RANGE
    k = min(max(remaining["kcal"] / total, lo), hi) if total > 0 else 1.0
    for m in meals:
        m["items"] = [x for x in (_scaled(it, k) for it in m["items"]) if x]
        m["totals"] = _sum_items(m["items"])

    note = ai.get("note")
    suggestion = {
        "meals": meals,
        "note": str(note).strip()[:200] if isinstance(note, str) and note.strip() else None,
        "remaining": remaining,
        "totals": _sum_items([it for m in meals for it in m["items"]]),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        db_upsert_nutrition_day(
            {
                "user_id": int(user_id),
                "log_date": day.isoformat(),
                "suggestion": suggestion,
                "suggestion_at": suggestion["created_at"],
                "updated_at": suggestion["created_at"],
            },
            ctx=ctx,
        )
    except Exception as e:  # noqa: BLE001
        # bez uloženia ho user aj tak dostane – len sa nezopakuje z cache
        print(f"[NUTRITION_AI] suggest save failed user={user_id}: {repr(e)}")

    _bill(user_id, trace, "nutrition_suggest", {"meals": len(meals), "date": day.isoformat()}, ctx=ctx)
    return {"ok": True, "suggestion": suggestion, "cached": False}
