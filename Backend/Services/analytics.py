from __future__ import annotations

from typing import Any, Dict, List, Optional

from DB.activities_summary import (
    db_get_activity_summary_one,
    db_get_last_activity_summary,
    db_get_activities_summary_today,
)
from DB.activities_laps import db_get_activity_laps, db_get_activity_laps_batch
from DB.activities_splits import db_get_activity_splits, db_get_activity_splits_batch
from DB.activities_enrichment import db_get_enrichment_for_activities
from DB.activities_streams import db_get_streams_batch
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


# -------------------------------------------------------------------
# Last activity / Today's activities bundle
# (summary + enrichment + streams + laps + splits) - pre WidgetLastActivity
# a jeho detail stránku.
#
# POZOR: na rozdiel od service_get_activity_extras_cached_or_fetch vyššie,
# tieto dve funkcie NEROBIA fallback re-fetch zo Stravy, keď laps/splits
# v DB chýbajú (napr. expirovali) - len čítajú, čo tam reálne je. Pre
# "today" by re-fetch pre viac aktivít naraz bol zbytočne drahý (N volaní
# na Stravu naraz); pre "last" by sa to dalo doplniť rovnakým vzorom ako
# service_get_activity_extras_cached_or_fetch, ak to budeš chcieť aj tu.
# -------------------------------------------------------------------


def _build_activity_bundles(
    user_id: int,
    summaries: List[Dict[str, Any]],
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Spoločné jadro pre last/today - vezme zoznam summary riadkov a
    dotiahne k nim enrichment/streams/laps/splits JEDNÝM DB callom na typ
    dát (nie po jednom na aktivitu v cykle).
    """
    if not summaries:
        return []

    activity_ids = [
        int(r["activity_id"]) for r in summaries if r.get("activity_id") is not None
    ]

    enrichment_rows = db_get_enrichment_for_activities(user_id, activity_ids, ctx=ctx)
    enrichment_by_id = {int(r["activity_id"]): r for r in enrichment_rows}

    streams_by_id = db_get_streams_batch(user_id, activity_ids, ctx=ctx)
    laps_by_id = db_get_activity_laps_batch(user_id, activity_ids, ctx=ctx)
    splits_by_id = db_get_activity_splits_batch(user_id, activity_ids, ctx=ctx)

    bundles: List[Dict[str, Any]] = []
    for s in summaries:
        aid = s.get("activity_id")
        if aid is None:
            continue
        aid = int(aid)
        bundles.append(
            {
                "summary": s,
                "enrichment": enrichment_by_id.get(aid),
                "streams": streams_by_id.get(aid),
                "laps": laps_by_id.get(aid, []),
                "splits": splits_by_id.get(aid, []),
            }
        )
    return bundles


def service_get_last_activity_bundle(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Balík (summary + enrichment + streams + laps + splits) pre POSLEDNÚ
    aktivitu daného usera. Vracia None, ak user ešte nemá žiadnu aktivitu.
    """
    last = db_get_last_activity_summary(ctx, user_id)
    if not last:
        return None
    bundles = _build_activity_bundles(user_id, [last], ctx=ctx)
    return bundles[0] if bundles else None


def service_get_today_activities_bundle(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Zoznam balíkov (rovnaký tvar ako service_get_last_activity_bundle) pre
    VŠETKY aktivity daného usera z dnešného dňa.
    """
    todays = db_get_activities_summary_today(ctx, user_id)
    return _build_activity_bundles(user_id, todays, ctx=ctx)
