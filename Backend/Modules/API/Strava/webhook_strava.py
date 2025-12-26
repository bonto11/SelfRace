import os
import hmac
import hashlib
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

from .webhook_models import StravaWebhookEventIn

# tu si natiahni svoj DB klient, prispôsob si podľa toho, čo používaš
from app.db import get_db  # <- adaptuj (Dependency, čo vráti connection / session)


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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid mode")

    if hub_verify_token != verify_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid verify_token")

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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="missing signature")

    computed = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(computed, sent_signature):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid signature")

    return raw_body


@router.post("/webhook")
async def strava_webhook_handler(
    request: Request,
    db = Depends(get_db),             # adaptuj na svoj typ
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid json")

    event = StravaWebhookEventIn(**data)

    # event_time (epoch -> timestamptz)
    dt = datetime.fromtimestamp(event.event_time, tz=timezone.utc)

    # INSERT do strava_webhook_events – adaptuj podľa svojho DB klienta
    # TU predpokladám asyncpg-like API
    await db.execute(
        """
        insert into strava_webhook_events (
            subscription_id,
            object_type,
            object_id,
            aspect_type,
            owner_id,
            event_time,
            payload
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        """,
        event.subscription_id,
        event.object_type,
        event.object_id,
        event.aspect_type,
        event.owner_id,
        dt,
        json.dumps(data),
    )

    # Strava očakáva 2xx – telo im je v zásade jedno
    return JSONResponse({"ok": True})
    
@router.post("/webhook/process-pending")
async def process_pending_events(
    limit: int = 20,
    db: Any = Depends(get_db),
):
    """
    Stiahne prvých N 'pending' eventov zo strava_webhook_events
    a postupne ich spracuje.
    - limit default 20 (môžeš upraviť podľa výkonu)
    - používa FOR UPDATE SKIP LOCKED (bez race conditions pri viacerých workerkoch)
    """
    # Zoberieme batoh eventov
    rows: Sequence[Mapping[str, Any]] = await db.fetch(
        """
        with cte as (
            select id
              from strava_webhook_events
             where processed_at is null
             order by id
             limit $1
             for update skip locked
        )
        select e.*
          from strava_webhook_events e
          join cte on cte.id = e.id
        """,
        limit,
    )

    processed = 0
    errors = 0
    ignored = 0

    for row in rows:
        try:
            await _process_single_event(db, row)
            processed += 1
        except HTTPException:
            # nechceme hádzať von, len započítať ako error
            errors += 1
        except Exception:
            errors += 1

    # sumarizácia pre teba
    return JSONResponse(
        {
            "ok": True,
            "fetched": len(rows),
            "processed": processed,
            "errors": errors,
        }
    )
    