# Modules/Strava/webhook_strava.py
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Literal, Mapping, Optional, Sequence
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from Configs.config import BACKEND_URL, FRONTEND_URL
from Modules.Strava.webhook_strava_processor import _process_single_event
from Modules.Supabase.client import get_service_client

supabase = get_service_client()
router = APIRouter(prefix="/api/strava", tags=["strava"])

class StravaWebhookEventIn(BaseModel):
    aspect_type: Literal["create", "update", "delete"]
    event_time: int
    object_id: int
    object_type: Literal["activity", "athlete"]
    owner_id: int
    subscription_id: Optional[int] = None
    updates: Dict[str, Any] = Field(default_factory=dict)


# =================================================
# ENV HELPERS
# =================================================
def _get_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"{name} is not set")
    return v


def _get_env_opt(name: str) -> Optional[str]:
    v = os.getenv(name)
    if v is None:
        return None
    v = v.strip()
    return v or None


def _get_env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "y", "on")


def get_verify_token() -> str:
    # Strava webhook subscription verify_token (tvoj vlastný random string)
    return _get_env("STRAVA_VERIFY_TOKEN")


def get_strava_client_id() -> str:
    return _get_env("STRAVA_CLIENT_ID")


def get_strava_client_secret() -> str:
    # Strava app CLIENT_SECRET
    return _get_env("STRAVA_CLIENT_SECRET")


def get_oauth_state_secret() -> str:
    # tvoj HMAC secret pre OAuth state
    return _get_env("STRAVA_OAUTH_STATE_SECRET")


def is_strict_signature() -> bool:
    """
    strict=true:
      - ak signature header príde a je zlá -> 403
      - ak signature header nepríde -> NEBLOKUJEME (Strava negarantuje), len označíme event ako unverified
    strict=false:
      - nikdy neblokujeme, len logujeme
    """
    return _get_env_bool("STRAVA_WEBHOOK_STRICT_SIGNATURE", default=False)


def get_expected_subscription_id() -> Optional[int]:
    """
    Odporúčané anti-spam:
    Ak nastavíš STRAVA_SUBSCRIPTION_ID, tak eventy s iným subscription_id označíme ako ignored.
    """
    v = _get_env_opt("STRAVA_SUBSCRIPTION_ID")
    if not v:
        return None
    try:
        return int(v)
    except ValueError as e:
        raise RuntimeError("STRAVA_SUBSCRIPTION_ID must be an integer") from e


# =================================================
# Redirect helper
# =================================================
def _fe_redirect(status: str, reason: str | None = None) -> RedirectResponse:
    params: Dict[str, str] = {"strava": status}
    if reason:
        params["reason"] = reason
    url = f"{FRONTEND_URL}/connectedApps?{urlencode(params)}"
    return RedirectResponse(url, status_code=302)


# =================================================
# OAuth state (HMAC) helpers
# =================================================
def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("utf-8").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def make_oauth_state(user_id: int, ttl_seconds: int = 600) -> str:
    now = int(time.time())
    payload = {"uid": int(user_id), "iat": now, "exp": now + int(ttl_seconds), "v": 1}

    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = _b64url_encode(payload_bytes)

    sig = hmac.new(
        get_oauth_state_secret().encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    return f"{payload_b64}.{_b64url_encode(sig)}"


def parse_oauth_state(state: str) -> int:
    try:
        payload_b64, sig_b64 = state.split(".", 1)
    except Exception as e:
        raise ValueError("bad_state_format") from e

    expected = hmac.new(
        get_oauth_state_secret().encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    if not hmac.compare_digest(_b64url_encode(expected), sig_b64):
        raise ValueError("bad_state_signature")

    payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    now = int(time.time())

    exp = int(payload.get("exp", 0) or 0)
    uid = payload.get("uid", None)

    if now > exp:
        raise ValueError("state_expired")
    if uid is None:
        raise ValueError("state_missing_uid")

    return int(uid)


# =================================================
# 1) WEBHOOK – VERIFY (subscription handshake)
# =================================================
@router.get("/webhook")
async def strava_webhook_verify(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    verify_token: str = Depends(get_verify_token),
):
    if hub_mode != "subscribe":
        raise HTTPException(status_code=400, detail="invalid_mode")
    if hub_verify_token != verify_token:
        raise HTTPException(status_code=403, detail="invalid_verify_token")
    return JSONResponse({"hub.challenge": hub_challenge})


#@router.options("/webhook")
#async def strava_webhook_options() -> JSONResponse:
#   return JSONResponse({"ok": True})


# =================================================
# 2) SIGNATURE VERIFICATION (optional header)
# =================================================
async def verify_optional_signature(request: Request, secret: str) -> tuple[bytes, bool, bool]:
    """
    Vracia: (raw_body, signature_present, signature_valid)

    - Ak header nie je: present=False, valid=False (unverified)
    - Ak header je a sedí: present=True, valid=True
    - Ak header je a nesedí:
        strict=true  -> 403
        strict=false -> allow, present=True, valid=False
    """
    raw = await request.body()
    sent = request.headers.get("X-Strava-Signature")
    strict = is_strict_signature()

    if not sent:
        if strict:
            print("[STRAVA] signature missing (strict=true) -> allowing but marking unverified")
        return raw, False, False

    computed = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed, sent):
        if strict:
            raise HTTPException(status_code=403, detail="invalid_signature")
        print("[STRAVA] invalid signature (strict=false) -> allowing", {"sent": sent, "computed": computed})
        return raw, True, False

    return raw, True, True


def _insert_event_from_dict(
    data: dict,
    *,
    signature_present: bool,
    signature_valid: bool,
) -> dict:
    event = StravaWebhookEventIn(**data)
    dt = datetime.fromtimestamp(event.event_time, tz=timezone.utc).isoformat()

    expected_sub_id = get_expected_subscription_id()
    status = "pending"
    error: Optional[str] = None

    # Anti-spam: subscription_id filter (ak je nastavený)
    if expected_sub_id is not None:
        if event.subscription_id is None or int(event.subscription_id) != int(expected_sub_id):
            status = "ignored"
            error = "unexpected_subscription_id"

    # Audit flag: ak podpis nie je valid -> pending_unverified
    if status == "pending" and (not signature_present or not signature_valid):
        status = "pending_unverified"

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
                "status": status,
                "error": error,
                "processed_at": None,
            }
        )
        .execute()
    )

    rows = getattr(resp, "data", None) or []
    err = getattr(resp, "error", None)
    if err or not rows:
        raise RuntimeError(str(err or "insert_failed"))
    return rows[0]


# =================================================
# 3) PROCESSOR CORE (shared)
# =================================================
async def _process_pending_events_core(limit: int = 20) -> dict:
    resp = (
        supabase.table("strava_webhook_events")
        .select("*")
        .is_("processed_at", None)
        .in_("status", ["pending", "pending_unverified"])
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
            print(f"[STRAVA] HTTPException pri spracovaní eventu {row.get('id')}: {e}")
            errors += 1
        except Exception as e:  # noqa: BLE001
            print(f"[STRAVA] Chyba pri spracovaní eventu {row.get('id')}: {e}")
            errors += 1

    return {"ok": True, "fetched": len(rows), "processed": processed, "errors": errors}


# =================================================
# 4) WEBHOOK HANDLER
# =================================================
@router.post("/webhook")
async def strava_webhook_handler(
    request: Request,
    secret: str = Depends(get_strava_client_secret),
):
    # Strava chce rýchlo 200 OK; ťažké veci async.
    raw_body, sig_present, sig_valid = await verify_optional_signature(request, secret)

    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print("[STRAVA] invalid json:", repr(e))
        raise HTTPException(status_code=400, detail="invalid_json")

    try:
        _insert_event_from_dict(data, signature_present=sig_present, signature_valid=sig_valid)
    except Exception as e:  # noqa: BLE001
        print("[STRAVA] insert failed:", repr(e))
        # 500 -> Strava retry (a ty vidíš chybu)
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)

    async def _bg():
        try:
            res = await _process_pending_events_core(limit=5)
            print("[STRAVA] bg process_pending:", res)
        except Exception as e:  # noqa: BLE001
            print("[STRAVA] bg process_pending failed:", repr(e))

    asyncio.create_task(_bg())
    return JSONResponse({"ok": True})


# =================================================
# 5) MANUÁLNY PROCESSOR TRIGGER (fallback)
# =================================================
@router.post("/webhook/process-pending")
async def process_pending_events(limit: int = 20):
    return JSONResponse(await _process_pending_events_core(limit=limit))


# =================================================
# 6) OAUTH FLOW: START + CALLBACK
# =================================================
@router.get("/oauth/start")
async def strava_oauth_start(
    user_id: int = Query(..., description="SelfRace user_id"),
):
    client_id = get_strava_client_id()
    callback_url = f"{BACKEND_URL}/api/strava/oauth/callback"
    state = make_oauth_state(user_id=user_id, ttl_seconds=600)

    # ✅ Tvoje finálne scope:
    # - read (basic)
    # - activity:read_all (private activities)
    # - nepouzivane - profile:read_all (profilové info)
    params = {
        "client_id": client_id,
        "redirect_uri": callback_url,
        "response_type": "code",
        "approval_prompt": "auto",
        "scope": "read,activity:read_all",
        "state": state,
    }

    url = "https://www.strava.com/oauth/authorize?" + urlencode(params)
    return RedirectResponse(url, status_code=302)


@router.get("/oauth/callback", name="strava_oauth_callback")
async def strava_oauth_callback(
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
):
    if error:
        return _fe_redirect("error", "strava_denied")

    if not code or not state:
        return _fe_redirect("error", "missing_code_or_state")

    try:
        user_id = parse_oauth_state(state)
    except Exception as e:  # noqa: BLE001
        print("[STRAVA OAUTH] invalid state:", repr(e))
        return _fe_redirect("error", "invalid_state")

    try:
        resp = requests.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": get_strava_client_id(),
                "client_secret": get_strava_client_secret(),
                "code": code,
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
    except Exception as e:  # noqa: BLE001
        print("[STRAVA OAUTH] token exchange error:", repr(e))
        return _fe_redirect("error", "token_exchange_failed")

    if resp.status_code != 200:
        txt = resp.text or ""
        print("[STRAVA OAUTH] token exchange bad status:", resp.status_code, txt)
        if "Limit of connected athletes exceeded" in txt:
            return _fe_redirect("error", "strava_athlete_limit")
        return _fe_redirect("error", "token_exchange_bad_status")

    token_data = resp.json()

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
        return _fe_redirect("error", "invalid_token_response")

    expires_at_iso = None
    if isinstance(expires_at_ts, (int, float)):
        expires_at_iso = datetime.fromtimestamp(expires_at_ts, tz=timezone.utc).isoformat()

    athlete_id_int = int(athlete_id)

    # athlete_id už existuje u iného usera
    try:
        existing = (
            supabase.table("strava_accounts")
            .select("user_id")
            .eq("athlete_id", athlete_id_int)
            .limit(1)
            .execute()
        )
        row = (getattr(existing, "data", None) or [None])[0]
        if row and int(row.get("user_id")) != int(user_id):
            return _fe_redirect("error", "athlete_already_linked")
    except Exception as e:  # noqa: BLE001
        print("[STRAVA OAUTH] athlete check failed:", repr(e))
        return _fe_redirect("error", "db_error")

    upsert_row = {
        "user_id": int(user_id),
        "athlete_id": athlete_id_int,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": expires_at_iso,
        "scope": scopes,
        "deauthorized_at": None,
    }

    try:
        upsert_resp = supabase.table("strava_accounts").upsert(upsert_row, on_conflict="user_id").execute()
        err = getattr(upsert_resp, "error", None)
        if err:
            return _fe_redirect("error", "upsert_failed")
    except Exception as e:  # noqa: BLE001
        msg = str(e).lower()
        if "duplicate key value" in msg or "athlete_id_key" in msg:
            return _fe_redirect("error", "athlete_already_linked")
        return _fe_redirect("error", "upsert_failed")

    return _fe_redirect("ok")


# =================================================
# 7) STATUS
# =================================================
@router.get("/status")
async def strava_status(
    user_id: int = Query(..., description="SelfRace user_id"),
):
    try:
        resp = (
            supabase.table("strava_accounts")
            .select("athlete_id, scope, expires_at, deauthorized_at")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:  # noqa: BLE001
        print("[STRAVA STATUS] DB error:", repr(e))
        raise HTTPException(status_code=500, detail="db_error")

    rows = getattr(resp, "data", None) or []
    row = rows[0] if rows else None

    if not row:
        return {"connected": False, "athlete_id": None, "scopes": [], "expires_at": None}

    connected = not bool(row.get("deauthorized_at"))
    return {
        "connected": connected,
        "athlete_id": row.get("athlete_id"),
        "scopes": row.get("scope") or [],
        "expires_at": row.get("expires_at"),
    }


# =================================================
# 8) DISCONNECT (tvoj funkčný kód – bez zmeny logiky)
# =================================================
@router.post("/disconnect")
async def strava_disconnect(
    user_id: int = Query(..., description="SelfRace user_id"),
):
    try:
        resp = (
            supabase.table("strava_accounts")
            .select("user_id, athlete_id, access_token, deauthorized_at")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:  # noqa: BLE001
        print("[STRAVA DISCONNECT] select failed:", repr(e))
        raise HTTPException(status_code=500, detail="db_select_failed")

    row = (getattr(resp, "data", None) or [None])[0]
    if not row:
        return {"ok": True, "already": True}

    access_token = row.get("access_token")
    deauth_at = row.get("deauthorized_at")

    if access_token and not deauth_at:
        try:
            r = requests.post(
                "https://www.strava.com/oauth/deauthorize",
                data={"access_token": access_token},
                timeout=15,
            )
            if r.status_code not in (200, 201):
                print("[STRAVA DISCONNECT] deauthorize non-200:", r.status_code, r.text)
        except Exception as e:  # noqa: BLE001
            print("[STRAVA DISCONNECT] deauthorize error:", repr(e))

    now_iso = datetime.now(timezone.utc).isoformat()

    payload = {
        "deauthorized_at": now_iso,
        "access_token": None,
        "refresh_token": None,
        "expires_at": None,
        "scope": [],
    }

    try:
        upd = supabase.table("strava_accounts").update(payload).eq("user_id", user_id).execute()
    except Exception as e:  # noqa: BLE001
        print("[STRAVA DISCONNECT] update exception:", repr(e))
        raise HTTPException(status_code=500, detail="db_update_exception")

    err = getattr(upd, "error", None)
    data = getattr(upd, "data", None)

    if err:
        print("[STRAVA DISCONNECT] update error:", err)
        raise HTTPException(status_code=500, detail={"code": "db_update_failed", "error": str(err)})

    return {"ok": True, "updated": len(data or [])}