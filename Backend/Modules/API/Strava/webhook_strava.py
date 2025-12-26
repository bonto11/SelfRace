import os
import hmac
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

from Modules.API.Strava.webhook_models import StravaWebhookEventIn
from Modules.SQL.db_handler import get_service_client
from Modules.API.Strava.webhook_strava_processor import _process_single_event

# Supabase client – service role (mimo RLS, admin veci)
supabase = get_service_client()

router = APIRouter(prefix="/api/strava", tags=["strava"])


def get_verify_token() -> str:
    token = os.getenv("STRAVA_VERIFY_TOKEN")
    if not token:
        raise RuntimeError("STRAVA_VERIFY_TOKEN is not set")
    return token


def get_webhook_secret() -> str:
    secret = os.getenv("STRAVA_WEBHOOK_SECRET")
    if not secret:
        raise RuntimeError("STRAVA_WEBHOOK_SECRET is not set")
    return secret


# ---------- 1) VERIFICATION (GET) ----------

@router.get("/webhook")
async def strava_webhook_verify(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    verify_token: str = Depends(get_verify_token),
):
    """
    Strava GET verify:
    - overí hub.verify_token
    - vráti {"hub.challenge": "..."} ak sedí
    """
    if hub_mode != "subscribe":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid mode",
        )

    if hub_verify_token != verify_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="invalid verify_token",
        )

    return JSONResponse({"hub.challenge": hub_challenge})


# ---------- 2) EVENTY (POST) ----------

async def verify_strava_signature(
    request: Request,
    secret: str,
) -> bytes:
    """
    Overí X-Strava-Signature HMAC SHA256 a vráti raw body (aby sme ho nemuseli čítať 2×).
    """
    raw_body = await request.body()
    sent_signature = request.headers.get("X-Strava-Signature")
    if not sent_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="missing signature",
        )

    computed = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(computed, sent_signature):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="invalid signature",
        )

    return raw_body


@router.post("/webhook")
async def strava_webhook_handler(
    request: Request,
    secret: str = Depends(get_webhook_secret),
):
    """
    Strava POST webhook:
    - overí podpis
    - naparsuje payload
    - uloží do strava_webhook_events (queue)
    """
    raw_body = await verify_strava_signature(request, secret)

    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid json",
        )

    event = StravaWebhookEventIn(**data)

    # event_time (epoch -> timestamptz ISO string)
    dt = datetime.fromtimestamp(event.event_time, tz=timezone.utc).isoformat()

    # INSERT cez Supabase
    # payload ukladáme ako JSON (dict) – v DB musí byť json/jsonb
    resp = (
        supabase.table("strava_webhook_events")
        .insert(
            {
                "subscription_id": event.subscription_id,
                "object_type": event.object_type,
                "object_id": event.object_id,
                "aspect_type": event.aspect_type,
                "owner_id": event.owner_id,
                "event_time": dt,
                "payload": data,
            }
        )
        .execute()
    )

    if getattr(resp, "error", None):
        # nech to vidíš v logoch, ale Strave aj tak pošleme 2xx
        print("[STRAVA WEBHOOK] insert error:", resp.error)

    return JSONResponse({"ok": True})


@router.post("/webhook/process-pending")
async def process_pending_events(
    limit: int = 20,
):
    """
    Stiahne prvých N 'pending' eventov zo strava_webhook_events
    a postupne ich spracuje.

    POZOR: cez Supabase nevieme FOR UPDATE SKIP LOCKED,
    takže pri viacerých workerkoch je tu malé riziko dvojitého spracovania.
    Pre 1 worker (čo máš teraz) je to OK.
    """
    # fetch pending eventy
    resp = (
        supabase.table("strava_webhook_events")
        .select("*")
        .is_("processed_at", None)
        .order("id", desc=False)
        .limit(limit)
        .execute()
    )

    rows: Sequence[Mapping[str, Any]] = resp.data or []

    processed = 0
    errors = 0

    for row in rows:
        try:
            await _process_single_event(row)
            processed += 1
        except HTTPException as e:
            print(f"[STRAVA WEBHOOK] HTTPException pri spracovaní eventu {row.get('id')}: {e}")
            errors += 1
        except Exception as e:
            print(f"[STRAVA WEBHOOK] Chyba pri spracovaní eventu {row.get('id')}: {e}")
            errors += 1

    return JSONResponse(
        {
            "ok": True,
            "fetched": len(rows),
            "processed": processed,
            "errors": errors,
        }
    )