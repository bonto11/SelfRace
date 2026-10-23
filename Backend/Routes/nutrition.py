# Routes/nutrition.py
"""
Výživa (fáza 1). Všetko za funkciou `nutrition` (admin panel → Funkcie).

Funkcia sa overuje pre volajúceho z JWT (rovnako ako /features/me) – tréner
číta výživu zverenca podľa svojej funkcie, dáta chráni RLS (trainer_read).
Zápis a AI len vlastník.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, File, Form, Request, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from Configs.nutrition import IMAGE_TYPES, MAX_IMAGE_BYTES

from Modules.Supabase.auth import AuthCtx, get_auth_ctx, require_user
from Modules.Supabase.ownership import caller_user_id
from Services.features import service_feature_enabled
from Services.nutrition import (
    service_add_favorite,
    service_add_food_log,
    service_delete_favorite,
    service_delete_food_log,
    service_delete_nutrition_data,
    service_get_nutrition_day,
    service_get_nutrition_profile,
    service_get_nutrition_week,
    service_list_favorites,
    service_put_nutrition_profile,
    service_recent_foods,
    service_update_food_log,
)
from Services.nutrition_products import clean_barcode, service_lookup_barcode, service_save_own_product
from Services.AI.nutrition.main import (
    service_parse_food_label,
    service_parse_food_photo,
    service_parse_food_text,
)

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


class ProfileIn(BaseModel):
    goal: str = Field(..., max_length=16)
    goal_rate_pct: Optional[float] = None
    bmr_manual: Optional[int] = None
    neat_factor: Optional[float] = None
    protein_g_per_kg: Optional[float] = None
    consent: Optional[bool] = None

    model_config = ConfigDict(extra="forbid")


class FoodItemIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    grams: Optional[float] = None
    kcal: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None

    model_config = ConfigDict(extra="ignore")


class LogIn(BaseModel):
    date: str = Field(..., min_length=10, max_length=10)
    meal: str = Field(..., max_length=16)
    source: str = Field("manual", max_length=16)
    items: List[FoodItemIn] = Field(..., min_length=1, max_length=20)
    ai_confidence: Optional[float] = None
    raw_input: Optional[str] = Field(None, max_length=1000)
    # produkt z čiarového kódu / etikety (fáza 2)
    product_id: Optional[int] = None

    model_config = ConfigDict(extra="forbid")


class LogPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    grams: Optional[float] = None
    kcal: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    meal: Optional[str] = Field(None, max_length=16)
    date: Optional[str] = Field(None, min_length=10, max_length=10)

    model_config = ConfigDict(extra="forbid")


class ParseTextIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)

    model_config = ConfigDict(extra="forbid")


class ProductIn(BaseModel):
    barcode: Optional[str] = Field(None, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    brand: Optional[str] = Field(None, max_length=200)
    kcal_100g: float
    protein_100g: Optional[float] = None
    carbs_100g: Optional[float] = None
    fat_100g: Optional[float] = None
    fiber_100g: Optional[float] = None
    sugar_100g: Optional[float] = None
    salt_100g: Optional[float] = None
    serving_g: Optional[float] = None
    source: str = Field("user", max_length=16)

    model_config = ConfigDict(extra="forbid")


class FavoriteIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    meal: Optional[str] = Field(None, max_length=16)
    items: List[FoodItemIn] = Field(..., min_length=1, max_length=20)

    model_config = ConfigDict(extra="forbid")


def _guard(req: Request, user_id: int, *, own: bool = False) -> Tuple[AuthCtx, Optional[Dict[str, Any]]]:
    """(ctx, chyba) – chyba je hotová odpoveď route."""
    ctx = require_user(get_auth_ctx(req))
    caller = caller_user_id(ctx)
    if not service_feature_enabled(caller, "nutrition"):
        return ctx, {"success": False, "error_code": "feature_disabled"}
    # PREČO pri zápise a AI explicitne: AI volanie by inak minulo kvótu
    # cudzieho usera (RLS chráni len tabuľky)
    if own and caller != int(user_id):
        return ctx, {"success": False, "error_code": "forbidden"}
    return ctx, None


def _out(res: Dict[str, Any]) -> Dict[str, Any]:
    if not res.get("ok"):
        out = {"success": False, "error_code": res.get("code") or "nutrition_failed"}
        if "used_tokens_this_month" in res:
            out["used_tokens_this_month"] = res["used_tokens_this_month"]
        return out
    return {"success": True, "data": {k: v for k, v in res.items() if k != "ok"}}


# ---------- profil ----------


@router.get("/{user_id}/profile")
def get_profile(req: Request, user_id: int) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id)
    if err:
        return err
    return _out(service_get_nutrition_profile(user_id, ctx=ctx))


@router.put("/{user_id}/profile")
def put_profile(req: Request, user_id: int, payload: ProfileIn) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    return _out(service_put_nutrition_profile(user_id, payload.model_dump(), ctx=ctx))


@router.delete("/{user_id}/profile")
def delete_profile(req: Request, user_id: int) -> Dict[str, Any]:
    # odvolanie súhlasu – zmaže všetky údaje o strave
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    return _out(service_delete_nutrition_data(user_id, ctx=ctx))


# ---------- deň ----------


@router.get("/{user_id}/day/{day}")
def get_day(req: Request, user_id: int, day: str) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id)
    if err:
        return err
    return _out(service_get_nutrition_day(user_id, day, ctx=ctx))


# ---------- zápis jedla ----------


@router.post("/{user_id}/log")
def post_log(req: Request, user_id: int, payload: LogIn) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    return _out(service_add_food_log(user_id, payload.model_dump(), ctx=ctx))


@router.patch("/{user_id}/log/{entry_id}")
def patch_log(req: Request, user_id: int, entry_id: int, payload: LogPatch) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    return _out(service_update_food_log(user_id, entry_id, payload.model_dump(exclude_unset=True), ctx=ctx))


@router.delete("/{user_id}/log/{entry_id}")
def delete_log(req: Request, user_id: int, entry_id: int) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    return _out(service_delete_food_log(user_id, entry_id, ctx=ctx))


@router.get("/{user_id}/recent")
def get_recent(req: Request, user_id: int) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id)
    if err:
        return err
    return _out(service_recent_foods(user_id, ctx=ctx))


# ---------- AI ----------


@router.post("/{user_id}/parse-text")
def post_parse_text(req: Request, user_id: int, payload: ParseTextIn) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    return _out(service_parse_food_text(user_id, payload.text, ctx=ctx))


# ---------- obľúbené ----------


@router.get("/{user_id}/favorites")
def get_favorites(req: Request, user_id: int) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id)
    if err:
        return err
    return _out(service_list_favorites(user_id, ctx=ctx))


@router.post("/{user_id}/favorites")
def post_favorite(req: Request, user_id: int, payload: FavoriteIn) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    return _out(service_add_favorite(user_id, payload.model_dump(), ctx=ctx))


@router.delete("/{user_id}/favorites/{fav_id}")
def delete_favorite(req: Request, user_id: int, fav_id: int) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    return _out(service_delete_favorite(user_id, fav_id, ctx=ctx))


# ---------- týždeň (fáza 3) ----------


@router.get("/{user_id}/week")
def get_week(req: Request, user_id: int, end: Optional[str] = None) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id)
    if err:
        return err
    return _out(service_get_nutrition_week(user_id, end, ctx=ctx))


# ---------- čiarový kód a produkty (fáza 2) ----------


@router.get("/{user_id}/barcode/{code}")
def get_barcode(req: Request, user_id: int, code: str) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    return _out(service_lookup_barcode(user_id, code, ctx=ctx))


@router.post("/{user_id}/products")
def post_product(req: Request, user_id: int, payload: ProductIn) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    return _out(service_save_own_product(user_id, payload.model_dump(), ctx=ctx))


# ---------- fotky (etiketa – fáza 2, tanier – fáza 3) ----------


def _image(data: Optional[bytes], content_type: Optional[str]) -> Optional[Tuple[bytes, str]]:
    """Fotka z FE (zmenšená JPEG). None = chýba, je prázdna, veľká alebo iný typ."""
    ctype = (content_type or "").split(";")[0].strip().lower()
    if not data or len(data) > MAX_IMAGE_BYTES or ctype not in IMAGE_TYPES:
        return None
    return data, ctype


def _parse_label_sync(
    req: Request,
    user_id: int,
    label: Optional[Tuple[bytes, str]],
    front: Optional[Tuple[bytes, str]],
    front_sent: bool,
    barcode: Optional[str],
) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    if not label or (front_sent and not front):
        return {"success": False, "error_code": "invalid_image"}
    return _out(service_parse_food_label(user_id, label, front, barcode=clean_barcode(barcode), ctx=ctx))


@router.post("/{user_id}/parse-label")
async def post_parse_label(
    req: Request,
    user_id: int,
    label: UploadFile = File(...),
    front: Optional[UploadFile] = File(None),
    barcode: Optional[str] = Form(None),
) -> Dict[str, Any]:
    label_img = _image(await label.read(), label.content_type)
    front_img = _image(await front.read(), front.content_type) if front else None
    # AI aj kontrola JWT sú synchrónne – v async route by zablokovali server
    return await run_in_threadpool(
        _parse_label_sync, req, user_id, label_img, front_img, front is not None, barcode
    )


def _parse_photo_sync(
    req: Request, user_id: int, image: Optional[Tuple[bytes, str]], hint: Optional[str]
) -> Dict[str, Any]:
    ctx, err = _guard(req, user_id, own=True)
    if err:
        return err
    if not image:
        return {"success": False, "error_code": "invalid_image"}
    return _out(service_parse_food_photo(user_id, image, hint=hint or "", ctx=ctx))


@router.post("/{user_id}/parse-photo")
async def post_parse_photo(
    req: Request,
    user_id: int,
    image: UploadFile = File(...),
    hint: Optional[str] = Form(None),
) -> Dict[str, Any]:
    img = _image(await image.read(), image.content_type)
    return await run_in_threadpool(_parse_photo_sync, req, user_id, img, hint)

