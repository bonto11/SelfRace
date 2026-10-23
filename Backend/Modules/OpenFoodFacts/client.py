# Modules/OpenFoodFacts/client.py
"""
Open Food Facts API v2 – produkt podľa čiarového kódu.
https://openfoodfacts.github.io/openfoodfacts-server/api/

Bez kľúča, ale OFF žiada vlastný User-Agent s kontaktom. Výsledok si BE
ukladá do food_products (zdieľaná cache) – OFF sa pýta len raz na kód.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import requests

from Configs.nutrition import OFF_FIELDS, OFF_PRODUCT_URL, OFF_TIMEOUT_S, OFF_USER_AGENT


def _num(v: Any) -> Optional[float]:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None


def _per100(n: Dict[str, Any], key: str, decimals: int = 1) -> Optional[float]:
    v = _num(n.get(f"{key}_100g"))
    if v is None or v < 0 or v > 100:
        return None
    return round(v, decimals)


def normalize_off_product(barcode: str, product: Dict[str, Any], *, lang: str = "sk") -> Optional[Dict[str, Any]]:
    """
    OFF produkt → riadok food_products (hodnoty na 100 g).
    None = produkt nemá použiteľné výživové hodnoty (vtedy fotka etikety).
    """
    n = product.get("nutriments") if isinstance(product.get("nutriments"), dict) else {}

    kcal = _num(n.get("energy-kcal_100g"))
    if kcal is None:
        kj = _num(n.get("energy-kj_100g")) or _num(n.get("energy_100g"))
        kcal = kj / 4.184 if kj is not None else None
    protein = _per100(n, "proteins")
    carbs = _per100(n, "carbohydrates")
    fat = _per100(n, "fat")
    # PREČO aj makrá: produkt len s kcal by v zápise ukázal nulové makrá
    if kcal is None or not (0 <= kcal <= 1000) or (protein is None and carbs is None and fat is None):
        return None

    names = [
        product.get(f"product_name_{lang}"),
        product.get("product_name"),
        product.get("product_name_sk"),
        product.get("product_name_cs"),
        product.get("product_name_en"),
        product.get("generic_name"),
    ]
    name = next((str(x).strip() for x in names if isinstance(x, str) and x.strip()), "")
    brand = str(product.get("brands") or "").split(",")[0].strip() or None
    if not name:
        name = brand or barcode

    serving = _num(product.get("serving_quantity"))
    serving_g = round(serving, 1) if serving and 0 < serving <= 5000 else None

    return {
        "barcode": barcode,
        "name": name[:160],
        "brand": brand[:120] if brand else None,
        "kcal_100g": round(kcal, 1),
        "protein_100g": protein,
        "carbs_100g": carbs,
        "fat_100g": fat,
        "fiber_100g": _per100(n, "fiber"),
        "sugar_100g": _per100(n, "sugars"),
        "salt_100g": _per100(n, "salt", 2),
        "serving_g": serving_g,
        "source": "off",
    }


def fetch_off_product(barcode: str, *, lang: str = "sk") -> Optional[Dict[str, Any]]:
    """
    None = OFF produkt nepozná alebo nemá výživové hodnoty.
    Sieťová / HTTP chyba = výnimka (volajúci ju nesmie cachovať ako „nenájdené“).
    """
    res = requests.get(
        OFF_PRODUCT_URL.format(code=barcode),
        params={"fields": OFF_FIELDS},
        headers={"User-Agent": OFF_USER_AGENT},
        timeout=OFF_TIMEOUT_S,
    )
    if res.status_code == 404:
        return None
    res.raise_for_status()
    data = res.json()
    if not isinstance(data, dict) or data.get("status") != 1:
        return None
    product = data.get("product") if isinstance(data.get("product"), dict) else {}
    return normalize_off_product(barcode, product, lang=lang)
