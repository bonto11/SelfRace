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

_DIRECT_FIELDS = (
    "weight_kg",
    "height_cm",
    "total_body_water_l",
    "total_body_water_range_min",
    "total_body_water_range_max",
    "protein_kg",
    "mineral_kg",
    "body_fat_mass_kg",
    "skeletal_muscle_mass_kg",
    "weight_percent",
    "weight_scale_min",
    "weight_scale_max",
    "smm_percent",
    "smm_scale_min",
    "smm_scale_max",
    "body_fat_mass_percent",
    "body_fat_mass_scale_min",
    "body_fat_mass_scale_max",
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
    return {k: extracted.get(k) for k in _DIRECT_FIELDS if k in extracted}


def _upload_image_to_storage(
    *,
    user_id: int,
    image_bytes: bytes,
    content_type: str,
    ctx: AuthCtx,
) -> Optional[str]:
    ext = "jpg" if "jpeg" in content_type or "jpg" in content_type else "png"
    path = f"{user_id}/{uuid.uuid4().hex}.{ext}"

    print(f"🟡 [BODY_SCAN][storage] uploading to bucket='{STORAGE_BUCKET}' path='{path}' size={len(image_bytes)} bytes")

    try:
        sb = get_sb(ctx, caller="body_scan.upload_image")
        sb.storage.from_(STORAGE_BUCKET).upload(
            path,
            image_bytes,
            {"content-type": content_type},
        )
        print(f"✅ [BODY_SCAN][storage] upload OK path='{path}'")
        return path
    except Exception as e:
        print(f"❌ [BODY_SCAN][storage] upload FAILED: {repr(e)}")
        import traceback
        traceback.print_exc()
        return None


def service_upload_and_extract_body_scan(
    *,
    user_id: int,
    image_bytes: bytes,
    content_type: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:

    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        print(f"❌ [BODY_SCAN][service] quota exceeded, used={used}")
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

    try:
        extracted, trace, err_msg = generate_body_scan_extraction(
            image_base64=image_b64,
            image_media_type=media_type,
        )
    except Exception as e:
        print(f"❌ [BODY_SCAN][service] generate_body_scan_extraction RAISED: {repr(e)}")
        import traceback
        traceback.print_exc()
        return {"ok": False, "code": "ai_extraction_exception", "message": str(e)}

    print(f"🟡 [BODY_SCAN][service] extraction result: extracted={'YES' if extracted else 'NO'} err_msg={err_msg} trace_keys={list(trace.keys()) if trace else None}")

    if not extracted:
        print(f"❌ [BODY_SCAN][service] extraction failed: {err_msg}")
        return {"ok": False, "code": "ai_extraction_failed", "message": err_msg}

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

    try:
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
    except Exception as e:
        print(f"❌ [BODY_SCAN][service] db_insert_body_scan RAISED: {repr(e)}")
        import traceback
        traceback.print_exc()
        return {"ok": False, "code": "db_insert_exception", "message": str(e)}

    if not row:
        return {"ok": False, "code": "db_insert_failed"}

    print(f"✅ [BODY_SCAN][service] DONE, scan id={row.get('id')}")

    return {
        "ok": True,
        "scan": row,
        "extraction_confidence": extracted.get("extraction_confidence"),
        "unreadable_fields": extracted.get("unreadable_fields") or [],
    }


def service_confirm_body_scan(
    *,
    user_id: int,
    scan_id: int,
    corrections: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
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


def service_edit_body_scan(
    *,
    user_id: int,
    scan_id: int,
    fields: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    if not fields:
        return {"ok": False, "code": "empty_fields"}

    ok = db_update_body_scan(user_id, scan_id, fields=fields, mark_manually_edited=True, ctx=ctx)
    if not ok:
        return {"ok": False, "code": "update_failed"}

    scan = db_get_body_scan_by_id(user_id, scan_id, ctx=ctx)
    return {"ok": True, "scan": scan}


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
    rows = db_get_body_scans_for_user(
        user_id, start_date=start_date, end_date=end_date, only_confirmed=True, ctx=ctx
    )
    return {"ok": True, "scans": rows}


def service_delete_body_scan(
    *,
    user_id: int,
    scan_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    ok = db_delete_body_scan(user_id, scan_id, ctx=ctx)
    return {"ok": ok}

def service_create_manual_body_scan(
    *,
    user_id: int,
    scan_date: str,
    fields: Dict[str, Any],
    segmental_analysis: Optional[Dict[str, Any]] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vytvorí body scan záznam priamo z ručne zadaných hodnôt, bez AI vision
    extrakcie a bez fotky. Rovno POTVRDENÝ (confirmed_by_user=True), keďže
    used ho zadáva vedome sám - žiadny draft/review krok netreba.
    'fields' obsahuje len platné stĺpce tabuľky (rovnaký filter ako pri
    AI extrakcii - _DIRECT_FIELDS).
    """
    direct_fields = {k: v for k, v in fields.items() if k in _DIRECT_FIELDS}

    row = db_insert_body_scan(
        user_id,
        scan_date=scan_date,
        fields=direct_fields,
        scan_source="manual",
        segmental_analysis=segmental_analysis,
        raw_extraction=None,
        source_image_path=None,
        ai_model_used=None,
        confirmed_by_user=True,
        manually_edited=True,
        ctx=ctx,
    )

    if not row:
        return {"ok": False, "code": "db_insert_failed"}

    return {"ok": True, "scan": row}