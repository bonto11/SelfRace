# DB/activities_enrichment.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone
from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx
from Configs.config import TABLE_ACTIVITIES_ENRICHMENT

# =========================
# GET
# =========================


def db_get_enrichment_for_activities(
    user_id: int,
    activity_ids: List[int],
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    if not activity_ids:
        return []

    sb = get_sb(ctx, caller="activities_enrichment.db_get_enrichment_for_activities")

    fields = (
        "activity_id,"
        "z1_min,z2_min,z3_min,z4_min,z5_min,"
        "sport_type_fe,avg_hr_bpm,moving_time_s,distance_m,"
        "ai_review_thread,"
        "best_400m_s,best_1k_s,best_5k_s,best_10k_s,best_20k_s,"
        "best_half_s,best_30k_s,best_marathon_s,best_50k_s,"
        "best_swim_100m_s,best_swim_400m_s,best_swim_750m_s,best_swim_1k_s,"
        "best_swim_1500m_s,best_swim_1900m_s,best_swim_3800m_s,best_swim_5k_s,"
        "best_ride_10k_s,best_ride_20k_s,best_ride_40k_s,best_ride_50k_s,"
        "best_ride_90k_s,best_ride_100k_s,best_ride_100mi_s,best_ride_180k_s,"
        "updated_at"
    )

    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select(fields)
        .eq("user_id", int(user_id))
        .in_("activity_id", list(set(int(x) for x in activity_ids)))
        .execute()
    )
    return res.data or []


def db_get_enrichment_for_activity(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    rows = db_get_enrichment_for_activities(
        user_id=user_id,
        activity_ids=[activity_id],
        ctx=ctx,
    )
    return rows[0] if rows else None


def db_get_review_thread(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """Vráti celý review thread (assistant/user entries) pre danú aktivitu."""
    sb = get_sb(ctx, caller="activities_enrichment.db_get_review_thread")
    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select("ai_review_thread")
        .eq("user_id", int(user_id))
        .eq("activity_id", int(activity_id))
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return []
    thread = rows[0].get("ai_review_thread")
    return thread if isinstance(thread, list) else []


# =========================
# UPSERT (MERGE NON-NULL)
# =========================


def _strip_none(d: Dict[str, Any]) -> Dict[str, Any]:
    """Remove keys with None values so they don't overwrite existing DB values."""
    return {k: v for k, v in (d or {}).items() if v is not None}


def db_upsert_enrichment_rows_merge(
    rows: List[Dict[str, Any]],
    *,
    ctx: AuthCtx,
) -> int:
    """
    Upsert rows into activities_enrichment but NEVER overwrite existing values with None.
    - If row exists (user_id, activity_id): update only provided (non-None) fields.
    - If row doesn't exist: insert (can be partial).
    """
    if not rows:
        return 0

    sb = get_sb(ctx, caller="activities_enrichment.db_upsert_enrichment_rows_merge")

    saved = 0
    BATCH = 200

    for i in range(0, len(rows), BATCH):
        chunk_in = rows[i : i + BATCH]

        chunk: List[Dict[str, Any]] = []
        for r in chunk_in:
            if not isinstance(r, dict):
                continue
            if r.get("user_id") is None or r.get("activity_id") is None:
                continue

            clean = _strip_none(dict(r))
            clean["user_id"] = int(clean["user_id"])
            clean["activity_id"] = int(clean["activity_id"])
            chunk.append(clean)

        if not chunk:
            continue

        res = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
            .upsert(
                chunk,
                on_conflict="user_id,activity_id",
            )
            .execute()
        )

        err = getattr(res, "error", None)
        if err:
            print("❌ [ENRICH][upsert] error:", err)

        saved += len(chunk)

    return saved


# =========================
# AI REVIEW THREAD (APPEND)
# =========================
def db_append_review_thread_entries(
    *,
    user_id: int,
    activity_id: int,
    entries: List[Dict[str, Any]],
    ctx: AuthCtx,
) -> bool:
    """
    Pripojí nové entries (user/assistant) na koniec existujúceho threadu.
    Read-modify-write — pre jednu aktivitu sa nepredpokladá konkurentný zápis.
    """
    if not entries:
        return True

    sb = get_sb(ctx, caller="activities_enrichment.db_append_review_thread_entries")
    now_iso = datetime.now(timezone.utc).isoformat()

    current_thread = db_get_review_thread(
        user_id=user_id, activity_id=activity_id, ctx=ctx
    )
    new_thread = [*current_thread, *entries]

    row: Dict[str, Any] = {
        "user_id": int(user_id),
        "activity_id": int(activity_id),
        "ai_review_thread": new_thread,
        "updated_at": now_iso,
    }

    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .upsert(row, on_conflict="user_id,activity_id")
        .execute()
    )

    err = getattr(res, "error", None)
    if err:
        print("❌ [ENRICH][thread append] error:", err)
        return False

    return True


def db_get_unreviewed_activities_for_push(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Nájde aktivity, ktoré sa skončili (updated_at) pred viac ako 1 hodinou,
    ale menej ako 2 hodinami, a ešte nemajú žiadny review v threade.
    """
    sb = get_sb(
        ctx, caller="activities_enrichment.db_get_unreviewed_activities_for_push"
    )

    now = datetime.now(timezone.utc)
    one_hour_ago = (now - timedelta(hours=1)).isoformat()
    two_hours_ago = (now - timedelta(hours=2)).isoformat()

    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select("activity_id, updated_at, ai_review_thread")
        .eq("user_id", int(user_id))
        .lte("updated_at", one_hour_ago)
        .gte("updated_at", two_hours_ago)
        .execute()
    )

    rows = res.data or []
    return [
        r
        for r in rows
        if not isinstance(r.get("ai_review_thread"), list)
        or len(r["ai_review_thread"]) == 0
    ]


def db_get_zone_minutes_for_ids(
    user_id: int,
    activity_ids: List[int],
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """Zónové minúty pre dané activity_ids."""
    if not activity_ids:
        return []
    sb = get_sb(ctx, caller="activities_enrichment.db_get_zone_minutes_for_ids")
    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select("z1_min,z2_min,z3_min,z4_min,z5_min")
        .eq("user_id", user_id)
        .in_("activity_id", list(set(int(x) for x in activity_ids)))
        .execute()
    )
    return res.data or []
    
# =========================
# ROUTE MATCHING (pomenované trate)
# =========================

def db_get_matched_routes_for_sport(
    user_id: int,
    sport_type_fe: str,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Vráti kandidátov na route matching pre daný šport: activity_id + route_match
    z enrichment (kde je route_match potvrdený), doplnené o distance_m a
    elevation_gain_m z activities_summary. Enrichment nemá elevation_gain_m
    stĺpec vôbec, a jeho distance_m je len denormalizovaná kópia - berieme
    radšej summary ako zdroj pravdy pre oba údaje.
    """
    from DB.activities_summary import db_get_summary_for_activities

    sb = get_sb(ctx, caller="activities_enrichment.db_get_matched_routes_for_sport")
    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select("activity_id, route_match")
        .eq("user_id", int(user_id))
        .eq("sport_type_fe", sport_type_fe)
        .not_.is_("route_match", "null")
        .execute()
    )
    enrich_rows = res.data or []
    if not enrich_rows:
        return []

    activity_ids = [int(r["activity_id"]) for r in enrich_rows]
    summary_rows = db_get_summary_for_activities(ctx, user_id, activity_ids)
    summary_by_id = {int(r["activity_id"]): r for r in summary_rows}

    out: List[Dict[str, Any]] = []
    for r in enrich_rows:
        aid = int(r["activity_id"])
        s = summary_by_id.get(aid)
        if not s:
            continue
        out.append({
            "activity_id": aid,
            "route_match": r["route_match"],
            "distance_m": s.get("distance_m"),
            "elevation_gain_m": s.get("elevation_gain_m"),
        })
    return out


def db_get_distinct_route_names_for_sport(
    user_id: int,
    sport_type_fe: str,
    *,
    ctx: AuthCtx,
) -> List[str]:
    """
    Vráti zoznam unikátnych, potvrdených názvov trás (route_match) používateľa
    pre daný šport — pre FE select list ("vyber z existujúcich alebo napíš nový").
    """
    sb = get_sb(ctx, caller="activities_enrichment.db_get_distinct_route_names_for_sport")
    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select("route_match")
        .eq("user_id", int(user_id))
        .eq("sport_type_fe", sport_type_fe)
        .not_.is_("route_match", "null")
        .execute()
    )
    names = {r["route_match"] for r in (res.data or []) if r.get("route_match")}
    return sorted(names)


def db_get_activities_for_route_match(
    user_id: int,
    route_match: str,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Vráti všetky aktivity s daným potvrdeným route_match názvom — pre
    "podobné behy" widget/detail porovnanie. Dopĺňa elevation_gain_m
    z activities_summary rovnakým spôsobom ako db_get_matched_routes_for_sport,
    aby porovnanie dvoch behov s rovnakou vzdialenosťou ale iným prevýšením
    nebolo mätúce.
    """
    from DB.activities_summary import db_get_summary_for_activities

    sb = get_sb(ctx, caller="activities_enrichment.db_get_activities_for_route_match")
    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select(
            "activity_id, route_match, distance_m, moving_time_s, "
            "avg_hr_bpm, sport_type_fe, updated_at"
        )
        .eq("user_id", int(user_id))
        .eq("route_match", route_match)
        .order("updated_at", desc=True)
        .execute()
    )
    enrich_rows = res.data or []
    if not enrich_rows:
        return []

    activity_ids = [int(r["activity_id"]) for r in enrich_rows]
    summary_rows = db_get_summary_for_activities(ctx, user_id, activity_ids)
    elevation_by_id = {
        int(r["activity_id"]): r.get("elevation_gain_m") for r in summary_rows
    }

    for r in enrich_rows:
        r["elevation_gain_m"] = elevation_by_id.get(int(r["activity_id"]))

    return enrich_rows


def db_set_route_auto_match(
    user_id: int,
    activity_id: int,
    route_auto_match: Optional[str],
    *,
    ctx: AuthCtx,
) -> bool:
    """
    Nastaví (alebo vyčistí, ak None) navrhovaný auto-match názov trate.
    Priamy update namiesto merge-upsertu, pretože route_auto_match musí byť
    možné explicitne vynulovať na None (napr. po potvrdení/zamietnutí),
    čo by db_upsert_enrichment_rows_merge (ktorý None hodnoty ignoruje) nevedelo.
    """
    sb = get_sb(ctx, caller="activities_enrichment.db_set_route_auto_match")
    try:
        sb.table(TABLE_ACTIVITIES_ENRICHMENT).update(
            {"route_auto_match": route_auto_match}
        ).eq("user_id", int(user_id)).eq("activity_id", int(activity_id)).execute()
        return True
    except Exception as e:
        print("❌ [ENRICH][set_route_auto_match] error:", repr(e))
        return False


def db_set_route_match(
    user_id: int,
    activity_id: int,
    route_match: Optional[str],
    *,
    ctx: AuthCtx,
) -> bool:
    """
    Nastaví (alebo zruší, ak None) potvrdený názov trate. Po potvrdení sa
    zvyčajne zároveň vyčistí route_auto_match (rieši volajúci v service vrstve).
    """
    sb = get_sb(ctx, caller="activities_enrichment.db_set_route_match")
    try:
        sb.table(TABLE_ACTIVITIES_ENRICHMENT).update(
            {"route_match": route_match}
        ).eq("user_id", int(user_id)).eq("activity_id", int(activity_id)).execute()
        return True
    except Exception as e:
        print("❌ [ENRICH][set_route_match] error:", repr(e))
        return False

def db_get_route_match_counts(
    user_id: int,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Vráti počet aktivít pre každý potvrdený route_match názov (naprieč
    všetkými športmi) daného usera - pre widget/zoznam "moje trate".
    Supabase klient nemá GROUP BY, takže agregujeme v Pythone.
    """
    sb = get_sb(ctx, caller="activities_enrichment.db_get_route_match_counts")
    res = (
        sb.table(TABLE_ACTIVITIES_ENRICHMENT)
        .select("route_match, sport_type_fe, updated_at")
        .eq("user_id", int(user_id))
        .not_.is_("route_match", "null")
        .execute()
    )
    rows = res.data or []

    counts: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        name = r.get("route_match")
        if not name:
            continue
        entry = counts.setdefault(name, {
            "route_match": name,
            "sport_type_fe": r.get("sport_type_fe"),
            "count": 0,
            "last_activity_at": None,
        })
        entry["count"] += 1
        updated = r.get("updated_at")
        if updated and (entry["last_activity_at"] is None or updated > entry["last_activity_at"]):
            entry["last_activity_at"] = updated

    return sorted(counts.values(), key=lambda x: x["count"], reverse=True)