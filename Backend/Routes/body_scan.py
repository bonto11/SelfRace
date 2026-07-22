# Routes/body_scan.py
from fastapi import APIRouter, Request, UploadFile, File
from typing import Any, Dict, Optional
from pydantic import BaseModel

from Modules.Supabase.auth import get_auth_ctx, require_user
from Services.AI.body_scan.main import (
    service_upload_and_extract_body_scan,
    service_confirm_body_scan,
    service_edit_body_scan,
    service_get_body_scan,
    service_get_latest_body_scan,
    service_get_body_scans_for_trend,
    service_delete_body_scan,
)

router = APIRouter(prefix="/body-scan", tags=["body-scan"])


class ConfirmBodyScanPayload(BaseModel):
    corrections: Optional[Dict[str, Any]] = None


class EditBodyScanPayload(BaseModel):
    fields: Dict[str, Any]


@router.post("/{user_id}/upload")
async def upload_body_scan(
    user_id: int,
    req: Request,
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    """
    Nahrá fotku body scan (InBody) reportu, extrahuje dáta cez AI vision,
    a vráti draft (nepotvrdený) záznam na review pred uložením do trendov.
    """
    print(f"🟡 [ROUTE][body_scan.upload] START user_id={user_id} filename={file.filename} content_type={file.content_type}")

    ctx = require_user(get_auth_ctx(req))
    print(f"🟡 [ROUTE][body_scan.upload] ctx obtained, mode={getattr(ctx, 'mode', None)}")

    try:
        image_bytes = await file.read()
        print(f"🟡 [ROUTE][body_scan.upload] read {len(image_bytes)} bytes")
    except Exception as e:
        print(f"❌ [ROUTE][body_scan.upload] file.read() failed: {repr(e)}")
        return {
            "success": False,
            "data": None,
            "error_code": "file_read_failed",
            "message": str(e),
        }

    content_type = file.content_type or "image/jpeg"

    try:
        out = service_upload_and_extract_body_scan(
            user_id=user_id,
            image_bytes=image_bytes,
            content_type=content_type,
            ctx=ctx,
        )
    except Exception as e:
        print(f"❌ [ROUTE][body_scan.upload] service call raised exception: {repr(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "data": None,
            "error_code": "unhandled_exception",
            "message": str(e),
        }

    print(f"🟡 [ROUTE][body_scan.upload] service result ok={out.get('ok')} code={out.get('code')} message={out.get('message')}")

    if not out.get("ok"):
        return {
            "success": False,
            "data": None,
            "error_code": out.get("code") or "REQUEST_FAILED",
            "message": out.get("message"),
        }

    return {"success": True, "data": out, "error_code": None, "message": None}


@router.post("/{user_id}/{scan_id}/confirm")
def confirm_body_scan(
    user_id: int,
    scan_id: int,
    payload: ConfirmBodyScanPayload,
    req: Request,
) -> Dict[str, Any]:
    """Potvrdí draft scan (voliteľne s opravami) - odteraz sa počíta do trendov."""
    ctx = require_user(get_auth_ctx(req))

    out = service_confirm_body_scan(
        user_id=user_id,
        scan_id=scan_id,
        corrections=payload.corrections,
        ctx=ctx,
    )

    if not out.get("ok"):
        return {
            "success": False,
            "data": None,
            "error_code": out.get("code") or "REQUEST_FAILED",
            "message": None,
        }

    return {"success": True, "data": out, "error_code": None, "message": None}


@router.patch("/{user_id}/{scan_id}")
def edit_body_scan(
    user_id: int,
    scan_id: int,
    payload: EditBodyScanPayload,
    req: Request,
) -> Dict[str, Any]:
    """Ručná úprava ľubovoľných polí existujúceho (aj potvrdeného) scanu."""
    ctx = require_user(get_auth_ctx(req))

    out = service_edit_body_scan(
        user_id=user_id,
        scan_id=scan_id,
        fields=payload.fields,
        ctx=ctx,
    )

    if not out.get("ok"):
        return {
            "success": False,
            "data": None,
            "error_code": out.get("code") or "REQUEST_FAILED",
            "message": None,
        }

    return {"success": True, "data": out, "error_code": None, "message": None}


# 🌟 DÔLEŽITÉ: táto route MUSÍ byť pred "/{user_id}/{scan_id}" nižšie, inak
# FastAPI skúsi "latest" naparsovať ako int scan_id a padne s 422.
@router.get("/{user_id}/latest")
def get_latest_body_scan(
    user_id: int,
    req: Request,
) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    scan = service_get_latest_body_scan(user_id=user_id, ctx=ctx)

    if not scan:
        return {
            "success": False,
            "data": None,
            "error_code": "NOT_FOUND",
            "message": "No body scans found.",
        }

    return {"success": True, "data": scan, "error_code": None, "message": None}


@router.get("/{user_id}/{scan_id}")
def get_body_scan(
    user_id: int,
    scan_id: int,
    req: Request,
) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    scan = service_get_body_scan(user_id=user_id, scan_id=scan_id, ctx=ctx)

    if not scan:
        return {
            "success": False,
            "data": None,
            "error_code": "NOT_FOUND",
            "message": "Body scan not found.",
        }

    return {"success": True, "data": scan, "error_code": None, "message": None}


@router.get("/{user_id}")
def list_body_scans(
    user_id: int,
    req: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Zoznam potvrdených scanov pre trend graf (query params ?start_date=&end_date=)."""
    ctx = require_user(get_auth_ctx(req))
    out = service_get_body_scans_for_trend(
        user_id=user_id, start_date=start_date, end_date=end_date, ctx=ctx
    )
    return {"success": True, "data": out.get("scans") or [], "error_code": None, "message": None}


@router.delete("/{user_id}/{scan_id}")
def delete_body_scan(
    user_id: int,
    scan_id: int,
    req: Request,
) -> Dict[str, Any]:
    ctx = require_user(get_auth_ctx(req))
    out = service_delete_body_scan(user_id=user_id, scan_id=scan_id, ctx=ctx)
    return {
        "success": bool(out.get("ok")),
        "data": {"deleted": bool(out.get("ok"))},
        "error_code": None if out.get("ok") else "REQUEST_FAILED",
        "message": None,
    }