# Services/synchronization_single.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Mapping
from datetime import datetime, timezone
import os
import requests

from Modules.Strava.activities import StravaActivitiesClient
from Modules.Supabase.client import get_service_client

from DB.activities_summary import (
    db_upsert_activities_summary,
    db_get_activity_summary_one,
)
from DB.activities_laps import (
    db_delete_laps_for_activity,
    db_upsert_lap,
)
from DB.activities_splits import (
    db_delete_splits_for_activity,
    db_upsert_split,
)

from Services.synchronization_utils import (
    normalize_summary,
    _normalize_lap,
    _normalize_split,
    _decide_laps_or_splits,
)
from Modules.Supabase.auth import AuthCtx

from DB.account import mark_strava_ever_synced_now
from Services.synchronization_utils import enrich_activities_for_ids
from Configs.config import (
    TABLE_STRAVA_ACCOUNTS
)

from Services.AI.weekly_plan.main import service_sync_weekly_volume_for_date
from Services.notifications import service_notify_new_activity
from Services.records_check import service_check_activity_records


# -------------------------------------------------------------------
# STRAVA TOKENS – helpery (čisto DB + OAuth refresh, žiadny legacy súbor)
# -------------------------------------------------------------------

_supabase_service = get_service_client()


def _get_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"{name} is not set")
    return v


def _get_strava_client_id() -> str:
    return _get_env("STRAVA_CLIENT_ID")


def _get_strava_client_secret() -> str:
    return _get_env("STRAVA_CLIENT_SECRET")


def _refresh_strava_tokens_for_user(user_id: int, row: Mapping[str, Any]) -> Optional[str]:
    refresh_token = row.get("refresh_token")
    if not refresh_token:
        print(f"[SYNC:tokens] user_id={user_id} missing refresh_token")
        return None

    try:
        resp = requests.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": _get_strava_client_id(),
                "client_secret": _get_strava_client_secret(),
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            timeout=15,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:tokens] refresh request failed for user_id={user_id}: {e}")
        return None

    if resp.status_code != 200:
        print(
            f"[SYNC:tokens] refresh bad status for user_id={user_id}:",
            resp.status_code,
            resp.text,
        )
        return None

    data = resp.json() or {}
    access_token = data.get("access_token")
    new_refresh = data.get("refresh_token")
    expires_at_ts = data.get("expires_at")

    if not access_token:
        print(f"[SYNC:tokens] refresh response missing access_token for user_id={user_id}")
        return None

    expires_at_iso = None
    if isinstance(expires_at_ts, (int, float)):
        expires_at_iso = datetime.fromtimestamp(
            expires_at_ts, tz=timezone.utc
        ).isoformat()

    try:
        _supabase_service.table(TABLE_STRAVA_ACCOUNTS).update(
            {
                "access_token": access_token,
                "refresh_token": new_refresh or refresh_token,
                "expires_at": expires_at_iso,
            }
        ).eq("user_id", user_id).execute()
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:tokens] failed to update strava_accounts for user_id={user_id}: {e}")

    return access_token


def _get_access_token_for_user(user_id: int) -> Optional[str]:
    try:
        resp = (
            _supabase_service.table(TABLE_STRAVA_ACCOUNTS)
            .select("*")
            .eq("user_id", user_id)
            .is_("deauthorized_at", None)
            .limit(1)
            .execute()
        )
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:tokens] failed to fetch strava_accounts for user_id={user_id}: {e}")
        return None

    rows: Sequence[Mapping[str, Any]] = resp.data or []
    if not rows:
        print(f"[SYNC:tokens] no strava_accounts row for user_id={user_id}")
        return None

    row = rows[0]
    access_token = row.get("access_token")
    expires_at_raw = row.get("expires_at")

    needs_refresh = False
    if isinstance(expires_at_raw, str):
        try:
            if expires_at_raw.endswith("Z") and "+" not in expires_at_raw:
                exp_dt = datetime.fromisoformat(
                    expires_at_raw.replace("Z", "+00:00")
                )
            else:
                exp_dt = datetime.fromisoformat(expires_at_raw)
            if exp_dt <= datetime.now(timezone.utc):
                needs_refresh = True
        except Exception:
            needs_refresh = True
    else:
        needs_refresh = True

    if not access_token or needs_refresh:
        return _refresh_strava_tokens_for_user(user_id, row)

    return access_token


# -------------------------------------------------------------------
# TYPING FIX: Mapping/Sequence -> List[Dict[str, Any]]
# -------------------------------------------------------------------

def _to_list_of_dicts(items: Any) -> List[Dict[str, Any]]:
    if not items:
        return []
    out: List[Dict[str, Any]] = []
    if isinstance(items, list):
        for x in items:
            if isinstance(x, dict):
                out.append(x)
            elif isinstance(x, Mapping):
                out.append(dict(x))
        return out

    if isinstance(items, Sequence):
        for x in items:
            if isinstance(x, dict):
                out.append(x)
            elif isinstance(x, Mapping):
                out.append(dict(x))
    return out


# -------------------------------------------------------------------
# HLAVNÁ FUNKCIA – SYNC SINGLE ACTIVITY
# -------------------------------------------------------------------

def service_sync_single_activity(
    user_id: int,
    strava_activity_id: int,
    ctx: AuthCtx,
    fetch_details: bool = True,
) -> Dict[str, int]:
    access_token = _get_access_token_for_user(user_id)
    if not access_token:
        return {"imported": 0, "updated": 0, "skipped": 1, "fetched": 0}

    client = StravaActivitiesClient(access_token=access_token)

    imported = 0
    updated = 0
    skipped = 0
    fetched = 0

    aid = int(strava_activity_id)

    # ---------- 1) DETAIL AKTIVITY ----------
    try:
        detail = client.fetch_activity_detail(aid)
        fetched += 1
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] failed to fetch activity id={aid}: {e}")
        return {"imported": 0, "updated": 0, "skipped": 1, "fetched": 0}

    # ---------- 2) SUMMARY ROW ----------
    row = normalize_summary(user_id, detail)
    if not row.get("activity_id"):
        print(f"[SYNC:single] missing activity_id for id={aid}")
        return {"imported": 0, "updated": 0, "skipped": 1, "fetched": 0}

    row["deleted_at"] = None

    try:
        existing_row = db_get_activity_summary_one(
            activity_id=aid,
            ctx=ctx,
        )
        exists = bool(existing_row)
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] check existing failed id={aid}: {e}")
        exists = False

    try:
        db_upsert_activities_summary(
            rows=[row],
            ctx=ctx,
        )
        if exists:
            updated += 1
        else:
            imported += 1
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] summary upsert failed id={aid}: {e}")
        return {"imported": 0, "updated": 0, "skipped": 1, "fetched": fetched}

    # ---------- 3) LAPS / SPLITS (voliteľné) ----------
    if fetch_details:
        try:
            laps_raw_any = client.fetch_activity_laps(aid)
        except Exception as e:  # noqa: BLE001
            print(f"[SYNC:single] laps fetch failed id={aid}: {e}")
            laps_raw_any = []

        splits_raw_any = detail.get("splits_metric") or []

        laps_raw: List[Dict[str, Any]] = _to_list_of_dicts(laps_raw_any)
        splits_raw: List[Dict[str, Any]] = _to_list_of_dicts(splits_raw_any)

        mode = _decide_laps_or_splits(laps_raw, splits_raw)

        try:
            if mode == "splits":
                db_delete_laps_for_activity(
                    aid,
                    ctx=ctx,
                )

                split_rows = [
                    _normalize_split(S, user_id, aid, idx)
                    for idx, S in enumerate(splits_raw, start=1)
                ]
                for s_row in split_rows:
                    db_upsert_split(
                        s_row,
                        ctx=ctx,
                    )

            elif mode == "laps":
                db_delete_splits_for_activity(
                    aid,
                    ctx=ctx,
                )

                lap_rows = [_normalize_lap(L, user_id, aid) for L in laps_raw]
                for l_row in lap_rows:
                    db_upsert_lap(
                        l_row,
                        ctx=ctx,
                    )
            else:
                print(f"[SYNC:single] no usable laps/splits for id={aid}")
        except Exception as e:  # noqa: BLE001
            print(f"[SYNC:single] laps/splits upsert failed id={aid}: {e}")
            skipped += 1

    # ---------- 4) ENRICHMENT pre túto jednu aktivitu ----------
    try:
        enrich_activities_for_ids(
            user_id=user_id,
            activity_ids=[aid],
            ctx=ctx,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] enrichment failed id={aid}: {e}")

    mark_strava_ever_synced_now(ctx=ctx,user_id=user_id)
    
    # ✅ ---------- 5) PREPOČET WEEKLY PLÁNU ----------
    # Vytiahneme dátum aktivity, aby sme vedeli, ktorý týždeň máme prepočítať
    act_date = row.get("date")
    if act_date:
        try:
            print(f"[SYNC:single] Triggering weekly volume recalculation for {act_date}...")
            service_sync_weekly_volume_for_date(
                user_id=user_id, 
                target_date=str(act_date), 
                ctx=ctx
            )
        except Exception as e:
            print(f"[SYNC:single] Weekly volume recalculation failed id={aid}: {e}")

        # ✅ ---------- 6) KONTROLA REKORDOV ----------
    try:
        print(f"[SYNC:single] Checking records for activity_id={aid}...")

        # TODO: streams z DB pre presný výpočet – zatiaľ splits fallback
        service_check_activity_records(
            user_id=user_id,
            activity=row,
            splits=split_rows if fetch_details and mode == "splits" else [],
            ctx=ctx,
            streams=None,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] Records check failed id={aid}: {e}")

    # ✅ ---------- 7) NOTIFIKÁCIA – NOVÁ AKTIVITA ----------
    if imported > 0:
        try:
            service_notify_new_activity(user_id=user_id, ctx=ctx)
        except Exception as e:  # noqa: BLE001
            print(f"[SYNC:single] New activity notification failed id={aid}: {e}")

    return {
        "imported": int(imported),
        "updated": int(updated),
        "skipped": int(skipped),
        "fetched": int(fetched)
    }