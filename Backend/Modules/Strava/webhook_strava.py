# Modules/Strava/webhook_strava.py
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Literal, Mapping, Optional
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from Configs.config import (
    BACKEND_URL,
    FRONTEND_URL,
    STRAVA_RECONNECT_COOLDOWN_SECONDS,
)
from Modules.Supabase.auth import service_ctx

from Routes_DB.activities_summary import db_get_last_activity_start
from Services.synchronization_utils import decide_sync_plan
from Services.async_jobs import service_enqueue_job

from Modules.Strava.strava_disconnect_helpers import disconnect_strava_account
from Modules.Supabase.client import get_service_client
from Modules.Supabase.auth import get_auth_ctx, require_user
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


def get_verify_token() -> str:
    return _get_env("STRAVA_VERIFY_TOKEN")


def get_strava_client_id() -> str:
    return _get_env("STRAVA_CLIENT_ID")


def get_strava_client_secret() -> str:
    return _get_env("STRAVA_CLIENT_SECRET")


def get_oauth_state_secret() -> str:
    return _get_env("STRAVA_OAUTH_STATE_SECRET")


def get_expected_subscription_id() -> Optional[int]:
    v = _get_env_opt("STRAVA_SUBSCRIPTION_ID")
    if not v:
        return None
    try:
        return int(v)
    except ValueError as e:
        raise RuntimeError("STRAVA_SUBSCRIPTION_ID must be an integer") from e


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# =================================================
# Reconnect / policy knobs
# =================================================
def _parse_iso_dt(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        s = str(v)
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except Exception:
        return None


def _calc_reconnect_after(deauthorized_at: Any) -> Optional[str]:
    dt = _parse_iso_dt(deauthorized_at)
    if not dt:
        return None
    after = dt + timedelta(seconds=STRAVA_RECONNECT_COOLDOWN_SECONDS)
    if after.tzinfo is None:
        after = after.replace(tzinfo=timezone.utc)
    return after.astimezone(timezone.utc).isoformat()


def _can_connect_now(row: Optional[Mapping[str, Any]]) -> tuple[bool, Optional[str]]:
    if not row:
        return True, None
    deauth_at = row.get("deauthorized_at")
    if not deauth_at:
        return True, None

    after_iso = _calc_reconnect_after(deauth_at)
    if not after_iso:
        return True, None

    now = datetime.now(timezone.utc)
    after_dt = _parse_iso_dt(after_iso)
    if not after_dt:
        return True, None

    if now >= after_dt:
        return True, None

    return False, after_iso


# =================================================
# Redirect helper
# =================================================
def _fe_redirect(
    status: str,
    reason: str | None = None,
    extra: Optional[Dict[str, str]] = None,
) -> RedirectResponse:
    params: Dict[str, str] = {"strava": status}
    if reason:
        params["reason"] = reason
    if extra:
        for k, v in extra.items():
            if v is None:
                continue
            params[str(k)] = str(v)
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
# WEBHOOK – VERIFY
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


# =================================================
# WEBHOOK – INSERT AUDIT ROW
# =================================================
def _insert_webhook_audit_row(
    *,
    event: StravaWebhookEventIn,
    payload: dict,
    status: str,
    error: Optional[str],
) -> Optional[dict]:
    """
    Audit-only insert. Never blocks webhook success if it fails.
    """
    try:
        dt = datetime.fromtimestamp(event.event_time, tz=timezone.utc).isoformat()
    except Exception:
        dt = _utc_now_iso()

    try:
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
                    "payload": payload,
                    "status": status,
                    "error": error,
                    "processed_at": _utc_now_iso(),  # webhook ends here by design
                }
            )
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        return rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        print("[STRAVA][audit] insert failed:", repr(e))
        return None


# =================================================
# WEBHOOK – HANDLER (ONE ENQUEUE)
# =================================================
@router.post("/webhook")
async def strava_webhook_handler(request: Request):

    ctx = service_ctx("Webhook.Strava")

    raw_body = await request.body()
    if not raw_body:
        raise HTTPException(status_code=400, detail="empty_body")

    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print("[STRAVA] invalid json:", repr(e))
        raise HTTPException(status_code=400, detail="invalid_json")

    # Validate payload shape
    try:
        event = StravaWebhookEventIn(**data)
    except Exception as e:  # noqa: BLE001
        print("[STRAVA] invalid payload:", repr(e))
        raise HTTPException(status_code=400, detail="invalid_payload")

    # Only activity events are supported (ignore athlete events)
    if event.object_type != "activity":
        _insert_webhook_audit_row(event=event, payload=data, status="ignored", error="object_type_not_activity")
        return JSONResponse({"ok": True, "ignored": True})

    # Subscription id filtering (if configured)
    expected_sub_id = get_expected_subscription_id()
    if expected_sub_id is not None:
        if event.subscription_id is None or int(event.subscription_id) != int(expected_sub_id):
            _insert_webhook_audit_row(event=event, payload=data, status="ignored", error="unexpected_subscription_id")
            return JSONResponse({"ok": True, "ignored": True})

    # Find linked Strava account (active only)
    try:
        acc_resp = (
            supabase.table("strava_accounts")
            .select("user_id, athlete_id")
            .eq("athlete_id", int(event.owner_id))
            .is_("deauthorized_at", None)
            .limit(1)
            .execute()
        )
        rows = getattr(acc_resp, "data", None) or []
        account = rows[0] if rows else None
    except Exception as e:  # noqa: BLE001
        _insert_webhook_audit_row(event=event, payload=data, status="error", error=f"account_lookup_failed:{e}")
        # Strava expects 2xx typically; returning 200 prevents retries storms on transient DB issues
        return JSONResponse({"ok": True, "note": "account_lookup_failed"})

    if not account:
        _insert_webhook_audit_row(event=event, payload=data, status="orphan", error="no_strava_account_or_deauthorized")
        return JSONResponse({"ok": True, "orphan": True})

    user_id = int(account["user_id"])
    activity_id = int(event.object_id)

    # One enqueue, nothing else
    try:
        if event.aspect_type == "delete":
            service_enqueue_job(
                user_id=user_id,
                job_type="mark_activity_deleted",
                payload={"activity_id": activity_id},
                priority=60,
                dedupe_key=f"mark_activity_deleted:{user_id}:{activity_id}",
                ctx=ctx,
            )
            _insert_webhook_audit_row(event=event, payload=data, status="processed", error=None)
            return JSONResponse({"ok": True})

        if event.aspect_type in ("create", "update"):
            service_enqueue_job(
                user_id=user_id,
                job_type="strava_sync_activity",
                payload={
                    "activity_id": activity_id,
                    "fetch_details": True,
                    # worker pipeline will schedule autoadjust/review; keep webhook dumb
                    "autoadjust_delay_sec": 120,
                },
                priority=120,
                dedupe_key=f"strava_sync_activity:{user_id}:{activity_id}",
                ctx=ctx,
            )
            _insert_webhook_audit_row(event=event, payload=data, status="processed", error=None)
            return JSONResponse({"ok": True})

        _insert_webhook_audit_row(event=event, payload=data, status="ignored", error="unknown_aspect_type")
        return JSONResponse({"ok": True, "ignored": True})

    except Exception as e:  # noqa: BLE001
        _insert_webhook_audit_row(event=event, payload=data, status="error", error=f"enqueue_failed:{e}")
        # Again: 200 to avoid Strava retry storms; your queue/worker can recover separately.
        return JSONResponse({"ok": True, "note": "enqueue_failed"})


# =================================================
# OAUTH FLOW: START + CALLBACK
# =================================================
@router.get("/oauth/start")
async def strava_oauth_start(user_id: int = Query(..., description="SelfRace user_id")):
    # ✅ PRECHECK cooldown (server-side)
    try:
        st = (
            supabase.table("strava_accounts")
            .select("user_id, deauthorized_at")
            .eq("user_id", int(user_id))
            .limit(1)
            .execute()
        )
        row = (getattr(st, "data", None) or [None])[0]
    except Exception as e:  # noqa: BLE001
        print("[STRAVA OAUTH START] status select failed:", repr(e))
        return _fe_redirect("error", "db_error")

    allowed, reconnect_after = _can_connect_now(row)
    if not allowed:
        return _fe_redirect("error", "reconnect_cooldown", extra={"reconnect_after": reconnect_after or ""})

    client_id = get_strava_client_id()
    callback_url = f"{BACKEND_URL}/api/strava/oauth/callback"
    state = make_oauth_state(user_id=user_id, ttl_seconds=600)

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
# STATUS
# =================================================
@router.get("/status")
async def strava_status(req: Request, user_id: int = Query(..., description="SelfRace user_id"), ):


    ctx = require_user(get_auth_ctx(req))

    try:
        resp = (
            supabase.table("strava_accounts")
            .select("athlete_id, scope, expires_at, deauthorized_at, access_token, refresh_token, ever_synced_at")
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
        return {
            "connected": False,
            "athlete_id": None,
            "scopes": [],
            "expires_at": None,
            "disconnected_at": None,
            "reconnect_after": None,
            "can_connect": True,
            "can_manual_import": False,
            "sync_import_window_days": 0,
            "sync_import_max_activities": 0,
        }

    ever_synced_at = row.get("ever_synced_at")
    deauth_at = row.get("deauthorized_at")
    has_tokens = bool(row.get("access_token")) and bool(row.get("refresh_token"))
    connected = (not bool(deauth_at)) and has_tokens

    reconnect_after = _calc_reconnect_after(deauth_at) if deauth_at else None

    if connected:
        can_connect = False
    else:
        allowed, _after = _can_connect_now(row)
        can_connect = bool(allowed)

    can_manual_import = bool(connected)

    sync_days = None
    sync_max = None

    if connected:
        last_dt = db_get_last_activity_start(user_id=user_id, ctx=ctx)
        plan = decide_sync_plan(last_activity_dt=last_dt, ever_synced_at=ever_synced_at)
        sync_days = int(plan.days_back)
        sync_max = int(plan.max_activities)

    return {
        "connected": connected,
        "athlete_id": row.get("athlete_id"),
        "scopes": row.get("scope") or [],
        "expires_at": row.get("expires_at"),
        "disconnected_at": deauth_at,
        "reconnect_after": reconnect_after,
        "can_connect": can_connect,
        "can_manual_import": can_manual_import,
        "sync_import_window_days": sync_days,
        "sync_import_max_activities": sync_max,
    }


# =================================================
# DISCONNECT (+ DRY RUN)
# =================================================
class DisconnectBody(BaseModel):
    consent: bool = Field(default=False)
    reason: Optional[str] = Field(default=None, max_length=64)


@router.post("/disconnect")
async def strava_disconnect(
    user_id: int = Query(..., description="SelfRace user_id"),
    dry_run: bool = Query(False, description="If true: do not deauthorize, purge, or update DB"),
    body: Optional[DisconnectBody] = None,
):
    if body is None or body.consent is not True:
        raise HTTPException(status_code=400, detail="consent_required")

    res = disconnect_strava_account(
        user_id=int(user_id),
        reason=body.reason or "user_disconnect",
        purge_data=True,
        dry_run=bool(dry_run),
    )

    if not res.get("ok"):
        raise HTTPException(status_code=500, detail="disconnect_failed")

    return res