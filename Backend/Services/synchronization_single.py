from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Mapping
from datetime import datetime, timezone
import os
import requests

from Modules.Strava.activities import StravaActivitiesClient
from Modules.Supabase.client import get_service_client

from Routes_DB.activities_summary import (
    db_upsert_activities_summary,
    db_get_activity_summary_one,
)
from Routes_DB.activities_laps import (
    db_delete_laps_for_activity,
    db_upsert_lap,
)
from Routes_DB.activities_splits import (
    db_delete_splits_for_activity,
    db_upsert_split,
)

from Services.synchronization_utils import (
    _normalize_summary,
    _normalize_lap,
    _normalize_split,
    _decide_laps_or_splits,
)
from Services.synchronization_utils import enrich_activities_for_ids


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
    """
    Refreshne Strava token pre daného usera na základe refresh_tokenu v strava_accounts
    a updatne riadok v DB. Vracia nový access_token alebo None.
    """
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
        _supabase_service.table("strava_accounts").update(
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
    """
    Vytiahne access_token zo strava_accounts pre daného usera.
    Ak je expirovaný, skúsi refresh a vráti nový token.
    """
    try:
        resp = (
            _supabase_service.table("strava_accounts")
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
    """
    Strava klient často vracia list[dict], ale typovo to vie byť Sequence[Mapping].
    Pre Pylance a naše helpery z toho spravíme List[Dict[str, Any]].
    """
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
    fetch_details: bool = True,
    user_jwt: Optional[str] = None,
) -> Dict[str, int]:
    """
    Sync JEDNEJ Strava aktivity – pre webhook (user_jwt=None → service client)
    aj manuálne použitie (user_jwt != None → RLS).

    PRODUKCIA:
      - access_token sa vždy berie z tabuľky strava_accounts pre daného usera.
    """
    access_token = _get_access_token_for_user(user_id)
    if not access_token:
        print(
            f"[SYNC:single] no valid Strava access_token for user_id={user_id}, "
            f"activity_id={strava_activity_id}"
        )
        return {"imported": 0, "updated": 0, "skipped": 1, "fetched": 0}

    client = StravaActivitiesClient(access_token=access_token)

    imported = 0
    updated = 0
    skipped = 0
    fetched = 0

    aid = int(strava_activity_id)

    service_mode = user_jwt is None

    # ---------- 1) DETAIL AKTIVITY ----------
    try:
        detail = client.fetch_activity_detail(aid)
        fetched += 1
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] failed to fetch activity id={aid}: {e}")
        return {"imported": 0, "updated": 0, "skipped": 1, "fetched": 0}

    # ---------- 2) SUMMARY ROW ----------
    row = _normalize_summary(user_id, detail)
    if not row.get("activity_id"):
        print(f"[SYNC:single] missing activity_id for id={aid}")
        return {"imported": 0, "updated": 0, "skipped": 1, "fetched": 0}

    row["deleted_at"] = None

    try:
        existing_row = db_get_activity_summary_one(
            activity_id=aid,
            user_jwt=user_jwt,
            service=service_mode,
        )
        exists = bool(existing_row)
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] check existing failed id={aid}: {e}")
        exists = False

    try:
        db_upsert_activities_summary(
            [row],
            user_jwt=user_jwt,
            service=service_mode,
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

        # ✅ TYPING FIX: prehoď na List[Dict[str, Any]] kvôli _decide/_normalize
        laps_raw: List[Dict[str, Any]] = _to_list_of_dicts(laps_raw_any)
        splits_raw: List[Dict[str, Any]] = _to_list_of_dicts(splits_raw_any)

        mode = _decide_laps_or_splits(laps_raw, splits_raw)

        try:
            if mode == "splits":
                db_delete_laps_for_activity(
                    aid,
                    user_jwt=user_jwt,
                    service=service_mode,
                )

                split_rows = [
                    _normalize_split(S, user_id, aid, idx)
                    for idx, S in enumerate(splits_raw, start=1)
                ]
                for s_row in split_rows:
                    db_upsert_split(
                        s_row,
                        user_jwt=user_jwt,
                        service=service_mode,
                    )

            elif mode == "laps":
                db_delete_splits_for_activity(
                    aid,
                    user_jwt=user_jwt,
                    service=service_mode,
                )

                # ✅ teraz L je Dict[str, Any], Pylance OK
                lap_rows = [_normalize_lap(L, user_id, aid) for L in laps_raw]
                for l_row in lap_rows:
                    db_upsert_lap(
                        l_row,
                        user_jwt=user_jwt,
                        service=service_mode,
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
            user_jwt=user_jwt,
            service=service_mode,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] enrichment failed id={aid}: {e}")

    print(
        f"[SYNC:single] done id={aid}: imported={imported} "
        f"updated={updated} skipped={skipped} fetched={fetched}"
    )

    return {
        "imported": int(imported),
        "updated": int(updated),
        "skipped": int(skipped),
        "fetched": int(fetched),
    }