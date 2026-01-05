# Modules/API/Strava/webhook_strava.py
from __future__ import annotations

import os
import hmac
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, RedirectResponse

from Modules.API.Strava.webhook_models import StravaWebhookEventIn
from Modules.SQL.db_handler import get_service_client
from Modules.API.Strava.webhook_strava_processor import _process_single_event

# Supabase client – service role (mimo RLS, admin veci)
supabase = get_service_client()

router = APIRouter(prefix="/api/strava", tags=["strava"])


def _get_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"{name} is not set")
    return v


def get_verify_token() -> str:
    return _get_env("STRAVA_VERIFY_TOKEN")


def get_webhook_secret() -> str:
    """
    Strava podpisuje webhooky pomocou CLIENT_SECRET.
    """
    return _get_env("STRAVA_CLIENT_SECRET")


def get_strava_client_id() -> str:
    return _get_env("STRAVA_CLIENT_ID")


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


# OPTIONS na /webhook – nech preflight nepadá na 400
@router.options("/webhook")
async def strava_webhook_options() -> JSONResponse:
    return JSONResponse({"ok": True})


@router.options("/webhook/test")
async def strava_webhook_test_options() -> JSONResponse:
    return JSONResponse({"ok": True})


# ---------- 2) SIGNATURE HELPER ----------


async def verify_strava_signature(
    request: Request,
    secret: str,
) -> bytes:
    """
    Overí X-Strava-Signature HMAC SHA256 a vráti raw body.
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


def _insert_event_from_dict(data: dict) -> None:
    """
    Spoločná logika: validácia payloadu + insert do strava_webhook_events.
    Používa sa v ostrom webhooku aj v test webhooku.
    """
    event = StravaWebhookEventIn(**data)

    # event_time (epoch -> timestamptz ISO string)
    dt = datetime.fromtimestamp(event.event_time, tz=timezone.utc).isoformat()

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

    print("[STRAVA] insert resp.data:", getattr(resp, "data", None))
    print("[STRAVA] insert resp.error:", getattr(resp, "error", None))

    err = getattr(resp, "error", None)
    if err:
        raise RuntimeError(str(err))


# ---------- 3) OSTRÝ WEBHOOK (s podpisom) ----------


@router.post("/webhook")
async def strava_webhook_handler(
    request: Request,
    secret: str = Depends(get_webhook_secret),
):
    """
    Strava POST webhook (ostrý):
    - overí podpis
    - naparsuje payload
    - uloží do strava_webhook_events (queue)
    """
    raw_body = await verify_strava_signature(request, secret)

    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print("[STRAVA] invalid json:", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid json",
        )

    print("[STRAVA] parsed payload:", data)

    try:
        _insert_event_from_dict(data)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)

    return JSONResponse({"ok": True})


# ---------- 4) TEST WEBHOOK (BEZ PODPISU – LEN PRE TEBE) ----------


@router.post("/webhook/test")
async def strava_webhook_test(request: Request):
    """
    Test endpoint na ručné testovanie z Hoppscotch:
    - NEKONTROLUJE podpis
    - očakáva rovnaký JSON ako Strava
    - uloží do strava_webhook_events
    """
    raw_body = await request.body()

    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print("[STRAVA TEST] invalid json:", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid json",
        )

    print("[STRAVA TEST] parsed payload:", data)

    try:
        _insert_event_from_dict(data)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)

    return JSONResponse({"ok": True, "mode": "test"})


# ---------- 5) PROCESSOR TRIGGER ----------


@router.post("/webhook/process-pending")
async def process_pending_events(
    limit: int = 20,
):
    """
    Stiahne prvých N 'pending' eventov zo strava_webhook_events
    a postupne ich spracuje.
    """
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
        except HTTPException as e:  # noqa: BLE001
            print(f"[STRAVA] HTTPException pri spracovaní eventu {row.get('id')}: {e}")
            errors += 1
        except Exception as e:  # noqa: BLE001
            print(f"[STRAVA] Chyba pri spracovaní eventu {row.get('id')}: {e}")
            errors += 1

    return JSONResponse(
        {
            "ok": True,
            "fetched": len(rows),
            "processed": processed,
            "errors": errors,
        }
    )


# ================================================================
# 6) OAUTH FLOW: CONNECT + CALLBACK (uloženie do strava_accounts)
# ================================================================

@router.get("/oauth/start")
async def strava_oauth_start(
    request: Request,
    user_id: int = Query(..., description="SelfRace user_id"),
):
    """
    Step 1: redirect na Strava /oauth/authorize.

    FE môže spraviť link:
      /api/strava/oauth/start?user_id=1

    `state` = user_id (stačí na dev; neskôr môžeme pridať anti-CSRF token).
    """
    client_id = get_strava_client_id()

    # redirect_uri = callback endpoint na tomto API
    callback_url = str(request.url_for("strava_oauth_callback"))

    params = {
        "client_id": client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "approval_prompt": "auto",
        # scopes: môžeš doladiť podľa toho, čo potrebuješ
        "scope": "read,activity:read_all,profile:read_all",
        "state": str(user_id),
    }

    # manuálne poskladáme URL
    from urllib.parse import urlencode

    url = "https://www.strava.com/oauth/authorize?" + urlencode(params)
    return RedirectResponse(url, status_code=302)


@router.get("/oauth/callback", name="strava_oauth_callback")
async def strava_oauth_callback(
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
):
    """
    Step 2: callback zo Stravy.

    - ak user povolil prístup → máme `code` + `state`
    - vymeníme `code` za access/refresh token
    - uložíme/aktualizujeme `strava_accounts`
    - redirect späť na FE (napr. /coach?strava=ok)
    """
    if error:
        # user klikol "Deny" alebo niečo zlyhalo na Strave
        print("[STRAVA OAUTH] error param:", error)
        return RedirectResponse("api-dev.patrikmbontar.eu?strava=error", status_code=302)

    if not code or not state:
        raise HTTPException(status_code=400, detail="missing code or state")

    try:
        user_id = int(state)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid state")

    client_id = get_strava_client_id()
    client_secret = get_webhook_secret()  # = STRAVA_CLIENT_SECRET

    # ---- EXCHANGE CODE -> TOKENS ----
    try:
        resp = requests.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
    except Exception as e:  # noqa: BLE001
        print("[STRAVA OAUTH] token exchange error:", e)
        raise HTTPException(status_code=502, detail="token_exchange_failed")