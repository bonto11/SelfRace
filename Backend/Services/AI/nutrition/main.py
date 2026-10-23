# Services/AI/nutrition/main.py
"""
AI návrhy pre zápis jedla – z textu, z fotky taniera a z fotky etikety.

Nič sa neukladá: návrh ide na FE, user ho upraví a potvrdí (POST /log,
pri etikete POST /products). Účtuje sa len platný návrh – prázdny alebo
nečitateľný user nemôže použiť. Fotky sa na serveri neukladajú, idú len do AI.
"""

from __future__ import annotations

import base64
from typing import Any, Dict, List, Optional, Tuple

from Configs.nutrition import AI_TEXT_MAX_LEN, MAX_ITEMS_PER_LOG
from Modules.Supabase.auth import AuthCtx
from Services.AI.nutrition.generate import (
    generate_food_label_json,
    generate_food_photo_json,
    generate_food_text_json,
)
from Services.AI.utils.billing import (
    extract_usage_from_trace,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
    log_ai_usage_for_user,
)
from Services.nutrition import clean_food_item
from Services.nutrition_products import clean_product_payload
from Services.user_prefs import service_get_user_language

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
