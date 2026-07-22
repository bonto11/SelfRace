# Services/AI/body_scan/main.py
from __future__ import annotations

import base64
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx

from Services.AI.body_scan.generate import generate_body_scan_extraction
from Services.AI.utils.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    is_user_over_token_quota,
    get_user_monthly_usage_tokens,
)
from DB.body_scans import (
    db_insert_body_scan,
    db_get_body_scan_by_id,
    db_get_latest_body_scan,
    db_get_body_scans_for_user,
    db_update_body_scan,
    db_confirm_body_scan,
    db_delete_body_scan,
)

STORAGE_BUCKET = "body-scans"

# Stĺpce v body_scans, ktoré sa priamo mapujú z AI extrakcie (mimo
# segmental_analysis, ktoré ide osobitne ako vlastný JSONB stĺpec)
_DIRECT_FIELDS = (
    "weight_kg",
    "height_cm",
    "total_body_water_l",
    "protein_kg",
    "mineral_kg",
    "body_fat_mass_kg",
    "skeletal_muscle_mass_kg",
    "bmi",
    "pbf_percent",
    "waist_hip_ratio",
    "visceral_fat_level",
    "basal_metabolic_rate_kcal",
    "inbody_score",
    "obesity_degree_percent",
    "smi",
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_direct_fields(extracted: Dict[str, Any]) -> Dict[str, Any]:
    """Vyberie len tie polia z AI výstupu, ktoré priamo zodpovedajú DB stĺpcom."""
    return {k: extracted.get(k) for k in _DIRECT_FIELDS if k in extracted}


def _upload_image_to_storage(
    *,
    user_id: int,
    image_bytes: bytes,
    content_type: str,
    ctx: AuthCtx,
) -> Optional[str]:
    """
    Nahrá fotku do Supabase Storage bucketu 'body-scans' pod cestou
    {user_id}/{uuid}.{ext}. Vracia storage path (nie plnú URL - tá sa
    generuje on-demand cez signed URL pri čítaní, kvôli súkromiu).
    """
    ext = "jpg" if "jpeg" in content_type or "jpg" in content_type else "png"
    path = f"{user_id}/{uuid.uuid4().hex}.{ext}"

    try:
        sb = get_sb(ctx, caller="body_scan.upload_image")
        sb.storage.from_(STORAGE_BUCKET).upload(
            path,
            image_bytes,
            {"content-type": content_type},
        )
        return path
    except Exception as e:
        print(f"❌ [BODY_SCAN] storage upload failed: {repr(e)}")
        return None


# ============================================================
# UPLOAD + EXTRACT (draft, čaká na potvrdenie usera)
# ============================================================

def service_upload_and_extract_body_scan(
    *,
    user_id: int,
    image_bytes: bytes,
    content_type: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Hlavný service pre nahratie fotky body scan reportu a AI extrakciu dát.
    Fotka sa nahrá do Supabase Storage, extrahuje sa cez Claude vision, a
    výsledok sa uloží ako NEPOTVRDENÝ draft riadok (confirmed_by_user=False)
    - used si ho musí na FE prezrieť/opraviť a explicitne potvrdiť, inak sa
    nezapočíta do trendov (db_get_body_scans_for_user defaultne filtruje
    len potvrdené).
    """
    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "used_tokens_this_month": used,
        }

    image_path = _upload_image_to_storage(
        user_id=user_id, image_bytes=image_bytes, content_type=content_type, ctx=ctx
    )

    image_b64 = base64.b64encode(image_bytes).decode("ascii")
    media_type = content_type if content_type.startswith("image/") else "image/jpeg"

    extracted, trace, err_msg = generate_body_scan_extraction(
        image_base64=image_b64,
        image_media_type=media_type,
    )

    if not extracted:
        print(f"❌ [BODY_SCAN] extraction failed: {err_msg}")
        return {"ok": False, "code": "ai_extraction_failed", "message": err_msg}

    # Billing
    usage = extract_usage_from_trace(trace, model_fallback=trace.get("ok_model"))
    if usage:
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="body_scan.extract",
                source="user",
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "provider": trace.get("ok_provider"),
                    "model": trace.get("ok_model"),
                },
                ctx=ctx,
            )
        except Exception as e:
            print(f"❌ [AI_BILLING] body_scan error: {repr(e)}")

    scan_date = extracted.get("scan_date") or datetime.now(timezone.utc).date().isoformat()
    direct_fields = _extract_direct_fields(extracted)
    segmental = extracted.get("segmental_analysis")

    row = db_insert_body_scan(
        user_id,
        scan_date=scan_date,
        fields=direct_fields,
        scan_source="inbody",
        segmental_analysis=segmental,
        raw_extraction=extracted,
        source_image_path=image_path,
        ai_model_used=trace.get("ok_model"),
        confirmed_by_user=False,
        ctx=ctx,
    )

    if not row:
        return {"ok": False, "code": "db_insert_failed"}

    return {
        "ok": True,
        "scan": row,
        "extraction_confidence": extracted.get("extraction_confidence"),
        "unreadable_fields": extracted.get("unreadable_fields") or [],
    }


# ============================================================
# CONFIRM (po review na FE)
# ============================================================

def service_confirm_body_scan(
    *,
    user_id: int,
    scan_id: int,
    corrections: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Potvrdí scan po tom, čo si ho used prezrel na FE. Ak 'corrections'
    obsahuje opravené hodnoty (used opravil AI chybu pred potvrdením),
    najprv sa aplikujú ako update (manually_edited=True), potom sa scan
    označí ako potvrdený.
    """
    if corrections:
        ok = db_update_body_scan(
            user_id, scan_id, fields=corrections, mark_manually_edited=True, ctx=ctx
        )
        if not ok:
            return {"ok": False, "code": "update_failed"}

    ok = db_confirm_body_scan(user_id, scan_id, ctx=ctx)
    if not ok:
        return {"ok": False, "code": "confirm_failed"}

    scan = db_get_body_scan_by_id(user_id, scan_id, ctx=ctx)
    return {"ok": True, "scan": scan}


# ============================================================
# EDIT (kedykoľvek po potvrdení, ručná korekcia)
# ============================================================

def service_edit_body_scan(
    *,
    user_id: int,
    scan_id: int,
    fields: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """Ručná úprava ľubovoľných polí existujúceho (aj už potvrdeného) scanu."""
    if not fields:
        return {"ok": False, "code": "empty_fields"}

    ok = db_update_body_scan(user_id, scan_id, fields=fields, mark_manually_edited=True, ctx=ctx)
    if not ok:
        return {"ok": False, "code": "update_failed"}

    scan = db_get_body_scan_by_id(user_id, scan_id, ctx=ctx)
    return {"ok": True, "scan": scan}


# ============================================================
# READ
# ============================================================

def service_get_body_scan(
    *,
    user_id: int,
    scan_id: int,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    return db_get_body_scan_by_id(user_id, scan_id, ctx=ctx)


def service_get_latest_body_scan(
    *,
    user_id: int,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    return db_get_latest_body_scan(user_id, ctx=ctx)


def service_get_body_scans_for_trend(
    *,
    user_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """Zoznam potvrdených scanov pre trend graf, zoradený vzostupne podľa dátumu."""
    rows = db_get_body_scans_for_user(
        user_id, start_date=start_date, end_date=end_date, only_confirmed=True, ctx=ctx
    )
    return {"ok": True, "scans": rows}


# ============================================================
# DELETE
# ============================================================

def service_delete_body_scan(
    *,
    user_id: int,
    scan_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    ok = db_delete_body_scan(user_id, scan_id, ctx=ctx)
    return {"ok": ok}