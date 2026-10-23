# Services/nutrition_products.py
"""
Produkty (hodnoty na 100 g) pre zápis jedla cez čiarový kód a etiketu.

Poradie pri skene: vlastný produkt usera (opravil si etiketu) → OFF riadok
v našej cache → Open Food Facts API (výsledok sa uloží pre všetkých) →
nenájdené = FE ponúkne fotku etikety.
"""

from __future__ import annotations

import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Configs.nutrition import BARCODE_RE, OFF_NOT_FOUND_TTL_S
from DB.nutrition import (
    db_find_products_by_barcode,
    db_get_product,
    db_insert_product,
    db_update_own_product,
)
from Modules.OpenFoodFacts.client import fetch_off_product
from Modules.Supabase.auth import AuthCtx, service_ctx
from Services.user_prefs import service_get_user_language

_BARCODE = re.compile(BARCODE_RE)
_MAX_NAME = 160
_MAX_BRAND = 120
_USER_SOURCES = ("label_ai", "user")
_MACROS = ("protein", "carbs", "fat", "fiber", "sugar", "salt")

# kódy, ktoré OFF nepozná – PREČO: user často skúša skenovať ten istý
# produkt znova a každý pokus by bol request na OFF
_not_found: Dict[str, float] = {}
_lock = threading.Lock()


def _num(v: Any) -> Optional[float]:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None


def clean_barcode(v: Any) -> Optional[str]:
    code = re.sub(r"\D", "", str(v or ""))
    return code if _BARCODE.match(code) else None


def public_product(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "barcode": row.get("barcode"),
        "name": row.get("name"),
        "brand": row.get("brand"),
        "kcal_100g": _num(row.get("kcal_100g")) or 0,
        **{f"{k}_100g": _num(row.get(f"{k}_100g")) for k in _MACROS},
        "serving_g": _num(row.get("serving_g")),
        "source": row.get("source"),
        "own": row.get("created_by") is not None,
    }


def _remember_not_found(code: str) -> None:
    now = time.time()
    with _lock:
        if len(_not_found) > 5000:
            _not_found.clear()
        _not_found[code] = now + OFF_NOT_FOUND_TTL_S


def _recently_not_found(code: str) -> bool:
    with _lock:
        exp = _not_found.get(code)
        if exp and exp > time.time():
            return True
        _not_found.pop(code, None)
    return False


def service_lookup_barcode(user_id: int, code_raw: str, *, ctx: AuthCtx) -> Dict[str, Any]:
    code = clean_barcode(code_raw)
    if not code:
        return {"ok": False, "code": "invalid_barcode"}

    rows = db_find_products_by_barcode(code, ctx=ctx)
    own = next((r for r in rows if r.get("created_by") == int(user_id)), None)
    off = next((r for r in rows if r.get("source") == "off"), None)
    if own or off:
        return {"ok": True, "found": True, "barcode": code, "product": public_product(own or off)}

    if _recently_not_found(code):
        return {"ok": True, "found": False, "barcode": code}

    try:
        lang = service_get_user_language(user_id, ctx=ctx)
    except Exception:  # noqa: BLE001
        lang = "sk"
    try:
        prod = fetch_off_product(code, lang=lang)
    except Exception as e:  # noqa: BLE001
        # výpadok OFF nie je „nenájdené“ – necachuje sa, user môže skúsiť etiketu
        print(f"[NUTRITION] OFF fetch failed code={code}: {repr(e)}")
        return {"ok": True, "found": False, "barcode": code, "off_error": True}

    if not prod:
        _remember_not_found(code)
        return {"ok": True, "found": False, "barcode": code}

    sctx = service_ctx("nutrition_products.off_cache")
    try:
        row = db_insert_product(prod, ctx=sctx)
    except Exception as e:  # noqa: BLE001
        # súbežný sken toho istého kódu už riadok vložil (unikátny index)
        print(f"[NUTRITION] OFF insert failed code={code}: {repr(e)}")
        row = next((r for r in db_find_products_by_barcode(code, ctx=sctx) if r.get("source") == "off"), None)
    if not row:
        return {"ok": True, "found": False, "barcode": code}
    return {"ok": True, "found": True, "barcode": code, "product": public_product(row)}


def clean_product_payload(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Vlastný produkt (etiketa / ručne) – None, ak hodnoty nedávajú zmysel."""
    name = str(raw.get("name") or "").strip()[:_MAX_NAME]
    if not name:
        return None
    brand = str(raw.get("brand") or "").strip()[:_MAX_BRAND] or None
    barcode = None
    if raw.get("barcode"):
        barcode = clean_barcode(raw.get("barcode"))
        if not barcode:
            return None
    kcal = _num(raw.get("kcal_100g"))
    if kcal is None or not (0 <= kcal <= 1000):
        return None
    vals: Dict[str, Optional[float]] = {}
    for k in _MACROS:
        v = _num(raw.get(f"{k}_100g"))
        if v is not None and not (0 <= v <= 100):
            return None
        vals[f"{k}_100g"] = round(v, 2 if k == "salt" else 1) if v is not None else None
    # 100 g nemôže mať viac ako 100 g bielkovín + sacharidov + tukov
    if sum(vals[f"{k}_100g"] or 0 for k in ("protein", "carbs", "fat")) > 105:
        return None
    serving = _num(raw.get("serving_g"))
    if serving is not None and not (0 < serving <= 5000):
        return None
    source = str(raw.get("source") or "user")
    if source not in _USER_SOURCES:
        return None
    return {
        "barcode": barcode,
        "name": name,
        "brand": brand,
        "kcal_100g": round(kcal, 1),
        **vals,
        "serving_g": round(serving, 1) if serving is not None else None,
        "source": source,
    }


def service_save_own_product(user_id: int, payload: Dict[str, Any], *, ctx: AuthCtx) -> Dict[str, Any]:
    """Uloží vlastný produkt. S kódom, ktorý už user má, ho prepíše (oprava etikety)."""
    row = clean_product_payload(payload)
    if not row:
        return {"ok": False, "code": "invalid_product"}

    existing = None
    if row["barcode"]:
        existing = next(
            (r for r in db_find_products_by_barcode(row["barcode"], ctx=ctx) if r.get("created_by") == int(user_id)),
            None,
        )
    if existing:
        saved = db_update_own_product(
            user_id, int(existing["id"]), {**row, "updated_at": datetime.now(timezone.utc).isoformat()}, ctx=ctx
        )
    else:
        saved = db_insert_product({**row, "created_by": int(user_id)}, ctx=ctx)
    if not saved:
        return {"ok": False, "code": "save_failed"}
    return {"ok": True, "product": public_product(saved)}


def service_product_visible(product_id: int, *, ctx: AuthCtx) -> bool:
    """Produkt existuje a user ho smie vidieť (OFF alebo vlastný) – pred zápisom do food_log."""
    try:
        return db_get_product(product_id, ctx=ctx) is not None
    except Exception as e:  # noqa: BLE001
        print(f"[NUTRITION] product check failed id={product_id}: {repr(e)}")
        return False
