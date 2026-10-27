# Services/AI/utils/images.py
"""
Fotky, ktoré user priloží k otázke pre AI (graf zo Stravy/Garminu, screenshot
tréningu, fotka tabuľky…) – hodnotenie aktivity a náhľad tréningu.

FE fotku zmenší (max ~1600 px, JPEG) a pošle ako base64 v JSON. Tu sa len
skontroluje typ, veľkosť a počet. Fotky sa nikam neukladajú: idú priamo do
AI (Claude vision) a pri hodnotení aktivity ešte cez frontu jobov, odkiaľ
ich worker po spracovaní zmaže (`strip_job_images`).
"""

from __future__ import annotations

import base64
import binascii
from typing import Any, List, Optional, Tuple

MAX_IMAGES = 2
# po zmenšení na FE má fotka stovky kB – 2 MB je strop proti zneužitiu
MAX_IMAGE_BYTES = 2 * 1024 * 1024

_MAGIC = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),
}

ImageList = List[Tuple[str, str]]  # [(base64, media_type)]


def normalize_images(raw: Any) -> Tuple[ImageList, Optional[str]]:
    """
    [{data, media_type}] z FE → [(base64, media_type)]. Druhá hodnota je kód
    chyby (`image_invalid` / `too_many_images`) alebo None.
    `data` môže byť aj data URL („data:image/jpeg;base64,…“).
    """
    if not raw:
        return [], None
    if not isinstance(raw, list):
        return [], "image_invalid"
    if len(raw) > MAX_IMAGES:
        return [], "too_many_images"

    out: ImageList = []
    for item in raw:
        if not isinstance(item, dict):
            return [], "image_invalid"
        data = str(item.get("data") or "").strip()
        media = str(item.get("media_type") or "").strip().lower()
        if data.startswith("data:"):
            head, _, data = data.partition(",")
            media = media or head[5:].split(";")[0].lower()
        if media == "image/jpg":
            media = "image/jpeg"
        if media not in _MAGIC or not data:
            return [], "image_invalid"
        try:
            blob = base64.b64decode(data, validate=True)
        except (binascii.Error, ValueError):
            return [], "image_invalid"
        if not blob or len(blob) > MAX_IMAGE_BYTES:
            return [], "image_invalid"
        if not any(blob.startswith(m) for m in _MAGIC[media]):
            return [], "image_invalid"
        out.append((data, media))
    return out, None


def ai_photos_from_request(ctx: Any, raw: Any) -> Tuple[ImageList, Optional[str]]:
    """
    Fotky z requestu pre route: bez fotiek nič nekontroluje. S fotkami overí
    prepínač ai_photos (FE skrytie je len vzhľad) a tvar fotiek.
    """
    if not raw:
        return [], None
    from Modules.Supabase.ownership import caller_user_id
    from Services.features import service_feature_enabled

    if not service_feature_enabled(caller_user_id(ctx), "ai_photos"):
        return [], "feature_disabled"
    return normalize_images(raw)


def images_rule(count: int) -> str:
    """Pravidlo do promptu, keď user priložil fotky."""
    if count <= 0:
        return ""
    return (
        f"- ATTACHED IMAGES: the athlete attached {count} image(s) (e.g. a chart or screenshot from "
        "their watch/app, a photo). Use what is clearly visible and relevant to their question; say "
        "briefly if something is unreadable. Never invent numbers that are not clearly visible. If "
        "the image contradicts CONTEXT DATA, trust CONTEXT DATA and mention the difference. Do not "
        "describe the image itself unless it helps the answer.\n"
    )
