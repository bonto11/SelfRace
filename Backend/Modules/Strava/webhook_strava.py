#Modules/Strava/webhook_strava
from __future__ import annotations

import os
import hmac
import hashlib
import json
import asyncio
from urllib.parse import urlencode

from datetime import datetime, timezone
from typing import Any, Mapping, Sequence, Optional, List, Dict, Literal
from pydantic import BaseModel, Field

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse

from Modules.Supabase.client import get_service_client
from Modules.Strava.webhook_strava_processor import _process_single_event

# Supabase client – service role (mimo RLS, admin veci)
supabase = get_service_client()

router = APIRouter(prefix="/api/strava", tags=["strava"])

# --- KONŠTANTY PRE URL (všetko HTTPS) ---
API_BASE_URL = "https://api-dev.patrikmbontar.eu"
FRONTEND_URL = "https://dev.patrikmbontar.eu"  # kam po úspešnom / neúspešnom pripojení


class StravaWebhookEventIn(BaseModel):
    aspect_type: Literal["create", "update", "delete"]
    event_time: int
    object_id: int
    object_type: Literal["activity", "athlete"]
    owner_id: int
    subscription_id: Optional[int] = None
    updates: Dict[str, Any] = Field(default_factory=dict)
# =================================================
# HELPERY NA ENV (ID/SECRET/TOKEN nechaj v ENV)
# =================================================


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

# =================================================
# HELPERY NA Redirect
# =================================================

CONNECTED_APPS_PATH = "/connectedApps"  # toto je tvoja FE route

def _fe_redirect(status: str, reason: str | None = None) -> RedirectResponse:
    params = {"strava": status}
    if reason:
        params["reason"] = reason
    url = f"{FRONTEND_URL}{CONNECTED_APPS_PATH}?{urlencode(params)}"
    return RedirectResponse(url, status_code=302)

# =================================================
# 1) WEBHOOK – VERIFY
# =================================================


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
            status_code=400,
            detail="invalid mode",
        )

    if hub_verify_token != verify_token:
        raise HTTPException(
            status_code=403,
            detail="invalid verify_token",
        )

    return JSONResponse({"hub.challenge": hub_challenge})


# OPTIONS na /webhook – nech preflight nepadá na 400
@router.options("/webhook")
async def strava_webhook_options() -> JSONResponse:
    return JSONResponse({"ok": True})


# =================================================
# 2) SIGNATURE HELPER
# =================================================


async def verify_strava_signature(
    request: Request,
    secret: str,
) -> bytes:
    """
    Overí X-Strava-Signature HMAC SHA256 a vráti raw body.

    DEV režim:
    - ak podpis chýba alebo nesedí, len to zaloguje a pokračuje,
      NEvyhadzuje 400/403 (aby sme neblokli Stravu).
    """
    raw_body = await request.body()

    sent_signature = request.headers.get("X-Strava-Signature")
    if not sent_signature:
        print("[STRAVA] missing X-Strava-Signature, skipping verification")
        return raw_body

    computed = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(computed, sent_signature):
        print(
            "[STRAVA] invalid signature – continuing in DEV mode",
            {"sent": sent_signature, "computed": computed},
        )
        return raw_body

    return raw_body


def _insert_event_from_dict(data: dict) -> dict:
    """
    Spoločná logika: validácia payloadu + insert do strava_webhook_events.

    Vracia vložený riadok (dict).
    """
    event = StravaWebhookEventIn(**data)

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
                "status": "pending",
                "error": None,
                "processed_at": None,
            }
        )
        .execute()
    )

    rows = getattr(resp, "data", None) or []
    err = getattr(resp, "error", None)

    print("[STRAVA] insert resp.data:", rows)
    print("[STRAVA] insert resp.error:", err)

    if err or not rows:
        raise RuntimeError(str(err or "insert failed"))

    return rows[0]


# =================================================
# 3) PROCESSOR CORE (shared: background + manuálna route)
# =================================================


async def _process_pending_events_core(limit: int = 20) -> dict:
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

    return {
        "ok": True,
        "fetched": len(rows),
        "processed": processed,
        "errors": errors,
    }


# =================================================
# 4) OSTRÝ WEBHOOK (s podpisom)
# =================================================


@router.post("/webhook")
async def strava_webhook_handler(
    request: Request,
    secret: str = Depends(get_webhook_secret),
):
    """
    Strava POST webhook (ostrý):
    - overí (resp. zaloguje) podpis
    - naparsuje payload
    - uloží do strava_webhook_events (queue)
    - NA POZADÍ spustí spracovanie pending eventov
    """
    print("[STRAVA] incoming headers:", dict(request.headers))

    raw_body = await verify_strava_signature(request, secret)

    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print("[STRAVA] invalid json:", e, "raw_body=", raw_body)
        raise HTTPException(
            status_code=400,
            detail="invalid json",
        )

    print("[STRAVA] parsed payload:", data)

    try:
        _insert_event_from_dict(data)
    except Exception as e:  # noqa: BLE001
        print("[STRAVA] insert failed:", e)
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)

    # ***** background spracovanie – neblokuje Stravu *****
    async def _bg():
        try:
            res = await _process_pending_events_core(limit=5)
            print("[STRAVA] bg process_pending result:", res)
        except Exception as e:  # noqa: BLE001
            print("[STRAVA] bg process_pending failed:", e)

    asyncio.create_task(_bg())
    # *****************************************************

    return JSONResponse({"ok": True})


# =================================================
# 5) MANUÁLNY PROCESSOR TRIGGER (fallback)
# =================================================


@router.post("/webhook/process-pending")
async def process_pending_events(
    limit: int = 20,
):
    """
    Manuálna route:
    Stiahne prvých N 'pending' eventov zo strava_webhook_events
    a postupne ich spracuje.
    """
    result = await _process_pending_events_core(limit=limit)
    return JSONResponse(result)


# =================================================
# 6) OAUTH FLOW: CONNECT + CALLBACK
# =================================================
@router.get("/oauth/callback", name="strava_oauth_callback")
async def strava_oauth_callback(
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
):
    # 1) user zrušil / Strava poslala error
    if error:
        print("[STRAVA OAUTH] error param:", error)
        return _fe_redirect("error", "strava_denied")

    # 2) missing params
    if not code or not state:
        print("[STRAVA OAUTH] missing code/state", {"code": bool(code), "state": bool(state)})
        return _fe_redirect("error", "missing_code_or_state")

    # 3) state -> user_id
    try:
        user_id = int(state)
    except Exception:
        print("[STRAVA OAUTH] invalid state:", state)
        return _fe_redirect("error", "invalid_state")

    client_id = get_strava_client_id()
    client_secret = get_webhook_secret()  # STRAVA_CLIENT_SECRET

    # 4) exchange code -> tokens
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
        print("[STRAVA OAUTH] token exchange error:", repr(e))
        return _fe_redirect("error", "token_exchange_failed")

    if resp.status_code != 200:
        print("[STRAVA OAUTH] token exchange bad status:", resp.status_code, resp.text)
        # Strava limit býva často ešte pred callbackom, ale pre istotu:
        if "Limit of connected athletes exceeded" in (resp.text or ""):
            return _fe_redirect("error", "strava_athlete_limit")
        return _fe_redirect("error", "token_exchange_bad_status")

    token_data = resp.json()
    print("[STRAVA OAUTH] token response:", token_data)

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_at_ts = token_data.get("expires_at")
    athlete = token_data.get("athlete") or {}
    athlete_id = athlete.get("id")

    scope_raw = token_data.get("scope") or ""
    if isinstance(scope_raw, str):
        scopes = [s.strip() for s in scope_raw.split(",") if s.strip()]
    elif isinstance(scope_raw, list):
        scopes = [str(s) for s in scope_raw]
    else:
        scopes = []

    if not access_token or not refresh_token or not athlete_id:
        print("[STRAVA OAUTH] invalid_token_response", {"access": bool(access_token), "refresh": bool(refresh_token), "athlete_id": athlete_id})
        return _fe_redirect("error", "invalid_token_response")

    expires_at_iso = None
    if isinstance(expires_at_ts, (int, float)):
        expires_at_iso = datetime.fromtimestamp(expires_at_ts, tz=timezone.utc).isoformat()

    athlete_id_int = int(athlete_id)

    # 5) athlete_id už existuje u iného usera -> pekná chyba (nie 500)
    try:
        existing = (
            supabase.table("strava_accounts")
            .select("user_id")
            .eq("athlete_id", athlete_id_int)
            .limit(1)
            .execute()
        )
        row = (getattr(existing, "data", None) or [None])[0]
        if row and int(row.get("user_id")) != user_id:
            print("[STRAVA OAUTH] athlete already linked", {"athlete_id": athlete_id_int, "existing_user": row.get("user_id"), "wanted_user": user_id})
            return _fe_redirect("error", "athlete_already_linked")
    except Exception as e:  # noqa: BLE001
        print("[STRAVA OAUTH] athlete check failed:", repr(e))
        return _fe_redirect("error", "db_error")

    # 6) UPSERT podľa user_id
    upsert_row = {
        "user_id": user_id,
        "athlete_id": athlete_id_int,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": expires_at_iso,
        "scope": scopes,
        "deauthorized_at": None,
    }

    try:
        upsert_resp = (
            supabase.table("strava_accounts")
            .upsert(upsert_row, on_conflict="user_id")
            .execute()
        )

        print("[STRAVA OAUTH] upsert data:", getattr(upsert_resp, "data", None))
        err = getattr(upsert_resp, "error", None)
        print("[STRAVA OAUTH] upsert error:", err)

        # ak by supabase klient vrátil error vo fielde
        if err:
            return _fe_redirect("error", "upsert_failed")

    except Exception as e:  # noqa: BLE001
        msg = str(e)
        print("[STRAVA OAUTH] upsert exception:", repr(e))

        low = msg.lower()
        if "duplicate key value" in low or "athlete_id_key" in low:
            return _fe_redirect("error", "athlete_already_linked")

        return _fe_redirect("error", "upsert_failed")

    # 7) success
    return _fe_redirect("ok")

@router.get("/oauth/start")
async def strava_oauth_start(
    user_id: int = Query(..., description="SelfRace user_id"),
):
    """
    Step 1: redirect na Strava /oauth/authorize.

    FE spraví link:
      /api/strava/oauth/start?user_id=1

    `state` = user_id (stačí na dev).
    """
    client_id = get_strava_client_id()

    # Natvrdo HTTPS callback (žiadne http):
    callback_url = f"{API_BASE_URL}/api/strava/oauth/callback"
    print("[STRAVA OAUTH] using callback_url:", callback_url)

    from urllib.parse import urlencode

    params = {
        "client_id": client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "approval_prompt": "auto",
        "scope": "read,activity:read_all,profile:read_all",
        "state": str(user_id),
    }

    url = "https://www.strava.com/oauth/authorize?" + urlencode(params)
    return RedirectResponse(url, status_code=302)


@router.get("/status")
async def strava_status(
    user_id: int = Query(..., description="SelfRace user_id"),
):
    """
    Jednoduchý status – či má user prepojený Strava účet.

    Číta strava_accounts cez service klienta a vráti:
    - connected: bool
    - athlete_id: int | null
    - scopes: list[str]
    - expires_at: ISO timestamp | null
    """
    try:
        resp = (
            supabase.table("strava_accounts")
            .select("athlete_id, scope, expires_at, deauthorized_at")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:  # noqa: BLE001
        print("[STRAVA STATUS] DB error:", e)
        raise HTTPException(status_code=500, detail="db_error")

    rows = getattr(resp, "data", None) or []
    row = rows[0] if rows else None

    if not row:
        return {
            "connected": False,
            "athlete_id": None,
            "scopes": [],
            "expires_at": None,
        }

    deauth = row.get("deauthorized_at")
    connected = not bool(deauth)

    return {
        "connected": connected,
        "athlete_id": row.get("athlete_id"),
        "scopes": row.get("scope") or [],
        "expires_at": row.get("expires_at"),
    }


@router.post("/disconnect")
async def strava_disconnect(
    user_id: int = Query(..., description="SelfRace user_id"),
):
    """
    Odpojí Strava účet (idempotentné):
    - best-effort Strava deauthorize
    - vždy lokálne vyčistí DB
    - NIKDY nepadá 500 kvôli Strave
    """
    try:
        resp = (
            supabase.table("strava_accounts")
            .select("user_id, athlete_id, access_token, deauthorized_at")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        print("[STRAVA DISCONNECT] select failed:", repr(e))
        raise HTTPException(status_code=500, detail="db_read_failed")

    row = (getattr(resp, "data", None) or [None])[0]
    if not row:
        # nič nie je pripojené → OK
        return {"ok": True, "already": True}

    access_token = row.get("access_token")
    deauth_at = row.get("deauthorized_at")

    # --- 1) BEST EFFORT: Strava deauthorize ---
    if access_token and not deauth_at:
        try:
            r = requests.post(
                "https://www.strava.com/oauth/deauthorize",
                data={"access_token": access_token},
                timeout=10,
            )
            print(
                "[STRAVA DISCONNECT] deauthorize status:",
                r.status_code,
                r.text,
            )
        except Exception as e:
            # ❗ NESMIEME padnúť
            print("[STRAVA DISCONNECT] deauthorize error:", repr(e))

    # --- 2) LOKÁLNY CLEANUP (kritické) ---
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        upd = (
            supabase.table("strava_accounts")
            .update(
                {
                    "deauthorized_at": now_iso,
                    "access_token": None,
                    "refresh_token": None,
                    "expires_at": None,
                    # ⚠️ DÔLEŽITÉ:
                    # ak scope NIE JE array → daj None
                    "scope": None,
                }
            )
            .eq("user_id", user_id)
            .execute()
        )

        err = getattr(upd, "error", None)
        if err:
            print("[STRAVA DISCONNECT] db_update error:", err)
            raise RuntimeError(err)

    except Exception as e:
        print("[STRAVA DISCONNECT] db_update failed:", repr(e))
        raise HTTPException(status_code=500, detail="db_update_failed")

    return {"ok": True}