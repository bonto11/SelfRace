from __future__ import annotations

from typing import Any, Dict

from DB.activities_summary import db_get_activity_summary_one
from DB.activities_laps import db_get_activity_laps
from DB.activities_splits import db_get_activity_splits
from Modules.Supabase.auth import AuthCtx

# -------------------------------------------------------------------
# FE detail aktivity (summary + laps + splits) - len DB read
# -------------------------------------------------------------------
def service_get_activity_detail(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Detail aktivity pre FE (summary + laps + splits).
    """

    summary = db_get_activity_summary_one(
        activity_id=activity_id,
        ctx=ctx,
    )

    laps = db_get_activity_laps(
        user_id=user_id,
        activity_id=activity_id,
        ctx=ctx,
    )

    splits = db_get_activity_splits(
        user_id=user_id,
        activity_id=activity_id,
        ctx=ctx,
    )

    return {"summary": summary, "laps": laps or [], "splits": splits or []}


# -------------------------------------------------------------------
# Extras cache/fetch: v DB má byť vždy LEN laps alebo LEN splits
# -------------------------------------------------------------------
def service_get_activity_extras_cached_or_fetch(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vracia laps + splits z DB. 
    Ak neexistujú (napr. boli vymazané po 7 dňoch), zavolá hlavný sync na ich dotiahnutie.
    """

    # 1) DB READ
    laps = db_get_activity_laps(ctx=ctx, user_id=user_id, activity_id=activity_id) or []
    splits = db_get_activity_splits(ctx=ctx, user_id=user_id, activity_id=activity_id) or []

    # 2) CACHE HIT -> máme dáta, vraciame ich
    if laps or splits:
        return {
            "laps": laps,
            "splits": splits,
            "source": "db",
            "fetched": False,
        }

    # 3) FETCH LAPS/SPLITS ZO STRAVY CEZ HLAVNÝ SYNC
    # Použijeme už existujúcu hlavnú funkciu, ktorá sa správne rozhodne (cez _match_ratio),
    # či sa majú uložiť laps alebo splits.
    from Services.synchronization_single import service_sync_single_activity
    
    try:
        service_sync_single_activity(
            user_id=user_id,
            strava_activity_id=activity_id,
            ctx=ctx,
            fetch_details=True
        )
    except Exception as e:
        print(f"[EXTRAS] Failed to re-fetch details via sync for id={activity_id}: {e}")

    # 4) ZNOVA NAČÍTAME Z DB (sync ich už správne uložil)
    laps = db_get_activity_laps(ctx=ctx, user_id=user_id, activity_id=activity_id) or []
    splits = db_get_activity_splits(ctx=ctx, user_id=user_id, activity_id=activity_id) or []

    return {
        "laps": laps,
        "splits": splits,
        "source": "strava",
        "fetched": True,
    }