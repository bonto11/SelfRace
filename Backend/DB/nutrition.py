# DB/nutrition.py
# Výživa: profil (nutrition_profile), zápis jedla (food_log), obľúbené (food_favorites).
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import (
    TABLE_FOOD_FAVORITES,
    TABLE_FOOD_LOG,
    TABLE_FOOD_PRODUCTS,
    TABLE_NUTRITION_PROFILE,
)

_LOG_COLS = (
    "id, log_date, meal, product_id, name, grams, kcal, protein_g, carbs_g, fat_g, "
    "source, ai_confidence, created_at"
)
_FAV_COLS = "id, name, meal, items, kcal, protein_g, carbs_g, fat_g, created_at"
_PRODUCT_COLS = (
    "id, barcode, name, brand, kcal_100g, protein_100g, carbs_100g, fat_100g, "
    "fiber_100g, sugar_100g, salt_100g, serving_g, source, created_by"
)


# ---------------------------------------------------------------------------
# PROFIL
# ---------------------------------------------------------------------------


def db_get_nutrition_profile(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="nutrition.db_get_nutrition_profile")
    res = sb.table(TABLE_NUTRITION_PROFILE).select("*").eq("user_id", int(user_id)).limit(1).execute()
    return (res.data or [None])[0]


def db_upsert_nutrition_profile(row: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="nutrition.db_upsert_nutrition_profile")
    res = sb.table(TABLE_NUTRITION_PROFILE).upsert(row, on_conflict="user_id").execute()
    return (res.data or [None])[0]


def db_delete_nutrition_data(user_id: int, *, ctx: AuthCtx) -> None:
    """Odvolanie súhlasu – zmaže všetko o strave usera (profil posledný)."""
    sb = get_sb(ctx, caller="nutrition.db_delete_nutrition_data")
    uid = int(user_id)
    sb.table(TABLE_FOOD_FAVORITES).delete().eq("user_id", uid).execute()
    sb.table(TABLE_FOOD_LOG).delete().eq("user_id", uid).execute()
    sb.table(TABLE_NUTRITION_PROFILE).delete().eq("user_id", uid).execute()


# ---------------------------------------------------------------------------
# ZÁPIS JEDLA
# ---------------------------------------------------------------------------


def db_list_food_log(user_id: int, date_from: str, date_to: str, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="nutrition.db_list_food_log")
    res = (
        sb.table(TABLE_FOOD_LOG)
        .select(_LOG_COLS)
        .eq("user_id", int(user_id))
        .gte("log_date", str(date_from)[:10])
        .lte("log_date", str(date_to)[:10])
        .order("log_date", desc=False)
        .order("created_at", desc=False)
        .limit(1000)
        .execute()
    )
    return res.data or []


def db_insert_food_log(rows: List[Dict[str, Any]], *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    if not rows:
        return []
    sb = get_sb(ctx, caller="nutrition.db_insert_food_log")
    res = sb.table(TABLE_FOOD_LOG).insert(rows).execute()
    return res.data or []


def db_update_food_log(
    user_id: int, entry_id: int, fields: Dict[str, Any], *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="nutrition.db_update_food_log")
    res = (
        sb.table(TABLE_FOOD_LOG)
        .update(fields)
        .eq("user_id", int(user_id))
        .eq("id", int(entry_id))
        .execute()
    )
    return (res.data or [None])[0]


def db_get_food_log_entry(user_id: int, entry_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="nutrition.db_get_food_log_entry")
    res = (
        sb.table(TABLE_FOOD_LOG)
        .select(_LOG_COLS)
        .eq("user_id", int(user_id))
        .eq("id", int(entry_id))
        .limit(1)
        .execute()
    )
    return (res.data or [None])[0]


def db_delete_food_log(user_id: int, entry_id: int, *, ctx: AuthCtx) -> bool:
    sb = get_sb(ctx, caller="nutrition.db_delete_food_log")
    res = sb.table(TABLE_FOOD_LOG).delete().eq("user_id", int(user_id)).eq("id", int(entry_id)).execute()
    return bool(res.data)


def db_list_food_log_recent(user_id: int, since_date: str, *, limit: int = 300, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Posledné zápisy od najnovšieho – „nedávne“ jedlá (dedup robí service)."""
    sb = get_sb(ctx, caller="nutrition.db_list_food_log_recent")
    res = (
        sb.table(TABLE_FOOD_LOG)
        .select(_LOG_COLS)
        .eq("user_id", int(user_id))
        .gte("log_date", str(since_date)[:10])
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


# ---------------------------------------------------------------------------
# OBĽÚBENÉ
# ---------------------------------------------------------------------------


def db_list_food_favorites(user_id: int, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    sb = get_sb(ctx, caller="nutrition.db_list_food_favorites")
    res = (
        sb.table(TABLE_FOOD_FAVORITES)
        .select(_FAV_COLS)
        .eq("user_id", int(user_id))
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return res.data or []


def db_insert_food_favorite(row: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="nutrition.db_insert_food_favorite")
    res = sb.table(TABLE_FOOD_FAVORITES).insert(row).execute()
    return (res.data or [None])[0]


def db_delete_food_favorite(user_id: int, fav_id: int, *, ctx: AuthCtx) -> bool:
    sb = get_sb(ctx, caller="nutrition.db_delete_food_favorite")
    res = (
        sb.table(TABLE_FOOD_FAVORITES)
        .delete()
        .eq("user_id", int(user_id))
        .eq("id", int(fav_id))
        .execute()
    )
    return bool(res.data)


# ---------------------------------------------------------------------------
# PRODUKTY (fáza 2) – OFF zdieľané, z etikety / ručné len autora (RLS)
# ---------------------------------------------------------------------------


def db_find_products_by_barcode(barcode: str, *, ctx: AuthCtx) -> List[Dict[str, Any]]:
    """Pod user ctx RLS vráti OFF riadok + vlastný produkt s týmto kódom."""
    sb = get_sb(ctx, caller="nutrition.db_find_products_by_barcode")
    res = sb.table(TABLE_FOOD_PRODUCTS).select(_PRODUCT_COLS).eq("barcode", barcode).limit(5).execute()
    return res.data or []


def db_get_product(product_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="nutrition.db_get_product")
    res = sb.table(TABLE_FOOD_PRODUCTS).select(_PRODUCT_COLS).eq("id", int(product_id)).limit(1).execute()
    return (res.data or [None])[0]


def db_insert_product(row: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    """OFF riadok vkladá BE so service ctx, vlastný produkt user ctx (RLS)."""
    sb = get_sb(ctx, caller="nutrition.db_insert_product")
    res = sb.table(TABLE_FOOD_PRODUCTS).insert(row).execute()
    return (res.data or [None])[0]


def db_update_own_product(
    user_id: int, product_id: int, fields: Dict[str, Any], *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    sb = get_sb(ctx, caller="nutrition.db_update_own_product")
    res = (
        sb.table(TABLE_FOOD_PRODUCTS)
        .update(fields)
        .eq("id", int(product_id))
        .eq("created_by", int(user_id))
        .execute()
    )
    return (res.data or [None])[0]


def db_delete_own_products(user_id: int, *, ctx: AuthCtx) -> None:
    """Odvolanie súhlasu – vlastné produkty (z etikety, ručné). OFF ostávajú."""
    sb = get_sb(ctx, caller="nutrition.db_delete_own_products")
    sb.table(TABLE_FOOD_PRODUCTS).delete().eq("created_by", int(user_id)).execute()

