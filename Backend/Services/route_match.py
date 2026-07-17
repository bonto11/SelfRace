# Services/route_match.py
from __future__ import annotations

from statistics import median
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx
from DB.activities_enrichment import (
    db_get_matched_routes_for_sport,
    db_get_distinct_route_names_for_sport,
    db_get_activities_for_route_match,
    db_set_route_auto_match,
    db_set_route_match,
)
from DB.activities_summary import db_get_summary_one

# Tolerancie pre auto-match (percentuálne, relatívne k novej aktivite)
DISTANCE_TOLERANCE_PCT = 0.05   # ±5%
ELEVATION_TOLERANCE_PCT = 0.15  # ±15%

# Športy, pre ktoré má route matching zmysel (distance/elevation identifikujú trasu)
ELIGIBLE_SPORTS = {"run", "ride", "swim"}


# ============================================================
# HELPERS
# ============================================================

def _pct_diff(value: float, reference: float) -> Optional[float]:
    """Relatívna odchýlka |value - reference| / reference. None ak reference <= 0."""
    if reference is None or reference <= 0:
        return None
    if value is None:
        return None
    return abs(value - reference) / reference


def _group_candidates_by_name(
    candidates: List[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    """
    Zoskupí kandidátov (activity_id, route_match, distance_m, elevation_gain_m)
    podľa route_match názvu, spočíta medián distance_m a elevation_gain_m pre
    každú skupinu — to je referenčný "profil trate" na porovnanie.
    """
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for c in candidates:
        name = c.get("route_match")
        if not name:
            continue
        grouped.setdefault(name, []).append(c)

    out: Dict[str, Dict[str, Any]] = {}
    for name, rows in grouped.items():
        distances = [
            float(r["distance_m"]) for r in rows
            if r.get("distance_m") is not None
        ]
        elevations = [
            float(r["elevation_gain_m"]) for r in rows
            if r.get("elevation_gain_m") is not None
        ]
        if not distances:
            continue
        out[name] = {
            "route_match": name,
            "median_distance_m": median(distances),
            "median_elevation_gain_m": median(elevations) if elevations else None,
            "sample_count": len(rows),
        }
    return out


# ============================================================
# AUTO-MATCH (volané z webhooku pri novej aktivite)
# ============================================================

def service_auto_match_route_for_activity(
    *,
    user_id: int,
    activity_id: int,
    ctx: AuthCtx,
) -> Optional[str]:
    """
    Po uložení novej aktivity nájde najlepšieho kandidáta medzi existujúcimi
    potvrdenými trasami (route_match) toho istého športu, v tolerancii
    DISTANCE_TOLERANCE_PCT / ELEVATION_TOLERANCE_PCT voči mediánu danej trate.
    Ak nájde zhodu, nastaví route_auto_match (len návrh, nič nepotvrdzuje).
    Vracia nastavený názov (alebo None, ak sa nič nenašlo/nedá).

    Volať synchrónne priamo z webhook handleru po uložení activities_summary
    riadku — je to lacný SELECT + porovnanie, nie AI/queue operácia.
    """
    activity = db_get_summary_one(ctx, int(activity_id))
    if not activity:
        return None

    sport = str(
        activity.get("sport_type_fe") or activity.get("sport_type") or ""
    ).lower()
    if sport not in ELIGIBLE_SPORTS:
        return None

    # Ak už má aktivita POTVRDENÝ route_match, nič neprepočítavame - je to
    # finálne rozhodnutie usera a re-sync (napr. Strava opravila dáta) ho
    # nesmie ticho zmeniť.
    from DB.activities_enrichment import db_get_enrichment_for_activity

    existing_enrichment = db_get_enrichment_for_activity(user_id, int(activity_id), ctx=ctx)
    if existing_enrichment and existing_enrichment.get("route_match"):
        return None

    distance_m = activity.get("distance_m")
    elevation_gain_m = activity.get("elevation_gain_m")
    if distance_m is None:
        return None

    try:
        distance_m = float(distance_m)
        elevation_gain_m = float(elevation_gain_m) if elevation_gain_m is not None else None
    except (TypeError, ValueError):
        return None

    candidates = db_get_matched_routes_for_sport(user_id, sport, ctx=ctx)
    # Nepočítaj samu seba, ak by už (nezvyčajne) mala route_match
    candidates = [c for c in candidates if int(c.get("activity_id", -1)) != int(activity_id)]

    if not candidates:
        return None

    profiles = _group_candidates_by_name(candidates)
    if not profiles:
        return None

    best_name: Optional[str] = None
    best_score: Optional[float] = None

    for name, profile in profiles.items():
        dist_diff = _pct_diff(distance_m, profile["median_distance_m"])
        if dist_diff is None or dist_diff > DISTANCE_TOLERANCE_PCT:
            continue

        # Elevation tolerancia sa vyhodnocuje len ak máme dáta na oboch stranách;
        # ak elevation chýba (nová aktivita alebo referenčný profil), berieme to
        # ako "neprekáža" a rozhoduje čisto distance.
        elev_diff = 0.0
        if elevation_gain_m is not None and profile["median_elevation_gain_m"] is not None:
            computed = _pct_diff(elevation_gain_m, profile["median_elevation_gain_m"])
            if computed is None or computed > ELEVATION_TOLERANCE_PCT:
                continue
            elev_diff = computed

        score = dist_diff + elev_diff
        if best_score is None or score < best_score:
            best_score = score
            best_name = name

    if best_name is None:
        return None

    db_set_route_auto_match(user_id, int(activity_id), best_name, ctx=ctx)
    return best_name


# ============================================================
# CONFIRM / REJECT / REMOVE
# ============================================================

def service_check_route_name_exists(
    *,
    user_id: int,
    sport_type_fe: str,
    name: str,
    ctx: AuthCtx,
) -> bool:
    """
    Case-insensitive kontrola, či daný názov trate už existuje pre tento šport
    (aby 'Kamzík' a 'kamzík' neboli považované za dve rôzne trate).
    """
    existing = db_get_distinct_route_names_for_sport(user_id, sport_type_fe, ctx=ctx)
    target = name.strip().lower()
    return any(e.strip().lower() == target for e in existing)


def service_confirm_route_match(
    *,
    user_id: int,
    activity_id: int,
    route_name: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Potvrdí (uloží) route_match pre danú aktivitu — či už ide o prijatie
    auto-match návrhu, výber iného existujúceho názvu zo zoznamu, alebo
    úplne nový názov. Vyčistí route_auto_match (už netreba, je potvrdené).

    Ak sa 'route_name' zhoduje case-insensitive s existujúcim názvom, uloží
    sa PRESNE ten existujúci názov (nie nová varianta veľkosti písmen), aby
    sa predišlo tichému vzniku duplicitných "rovnakých" trás s iným casingom.
    """
    name = (route_name or "").strip()
    if not name:
        return {"ok": False, "code": "empty_name"}

    activity = db_get_summary_one(ctx, int(activity_id))
    if not activity:
        return {"ok": False, "code": "activity_not_found"}

    sport = str(
        activity.get("sport_type_fe") or activity.get("sport_type") or ""
    ).lower()

    existing = db_get_distinct_route_names_for_sport(user_id, sport, ctx=ctx)
    canonical = next(
        (e for e in existing if e.strip().lower() == name.lower()), None
    )
    final_name = canonical or name

    ok1 = db_set_route_match(user_id, int(activity_id), final_name, ctx=ctx)
    ok2 = db_set_route_auto_match(user_id, int(activity_id), None, ctx=ctx)

    if not ok1:
        return {"ok": False, "code": "save_failed"}

    return {
        "ok": True,
        "route_match": final_name,
        "was_existing": canonical is not None,
        "auto_match_cleared": ok2,
    }


def service_reject_route_auto_match(
    *,
    user_id: int,
    activity_id: int,
    ctx: AuthCtx,
) -> bool:
    """Zamietne (vymaže) len navrhnutý auto-match, bez potvrdenia route_match."""
    return db_set_route_auto_match(user_id, int(activity_id), None, ctx=ctx)


def service_remove_route_match(
    *,
    user_id: int,
    activity_id: int,
    ctx: AuthCtx,
) -> bool:
    """Zruší (odparuje) potvrdené priradenie trate pre danú aktivitu."""
    return db_set_route_match(user_id, int(activity_id), None, ctx=ctx)


# ============================================================
# READ / FE SUPPORT
# ============================================================

def service_get_route_options_for_activity(
    *,
    user_id: int,
    activity_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vráti dáta potrebné pre FE na zobrazenie priraďovacieho UI pre danú
    aktivitu: navrhnutý auto_match (ak existuje), aktuálne potvrdený
    route_match (ak existuje), a zoznam VŠETKÝCH existujúcich potvrdených
    názvov pre tento šport (pre select list vrátane možnosti "nová trasa").

    Používa sa jednotne aj pre bežné priradenie (aktivita čerstvo prišla,
    má auto_match), aj pre SPÄTNÉ priradenie staršej aktivity, ktorá auto_match
    nikdy nedostala (napr. bola uložená pred zavedením tejto funkcie) — v tom
    prípade je 'auto_match' None, ale 'existing_route_names' je stále plný
    zoznam, z ktorého si user môže vybrať, alebo založiť nový.
    """
    activity = db_get_summary_one(ctx, int(activity_id))
    if not activity:
        return {"ok": False, "code": "activity_not_found"}

    sport = str(
        activity.get("sport_type_fe") or activity.get("sport_type") or ""
    ).lower()

    from DB.activities_enrichment import db_get_enrichment_for_activity

    enrichment = db_get_enrichment_for_activity(user_id, int(activity_id), ctx=ctx)
    auto_match = (enrichment or {}).get("route_auto_match")
    current_match = (enrichment or {}).get("route_match")

    existing_names = db_get_distinct_route_names_for_sport(user_id, sport, ctx=ctx)

    return {
        "ok": True,
        "sport": sport,
        "auto_match": auto_match,
        "current_match": current_match,
        "existing_route_names": existing_names,
        "distance_m": activity.get("distance_m"),
        "elevation_gain_m": activity.get("elevation_gain_m"),
    }


def service_get_comparison_for_route(
    *,
    user_id: int,
    route_match: str,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Vráti všetky aktivity priradené k danému potvrdenému route_match názvu,
    zoradené od najnovšej, pre "podobné behy" widget/porovnávací detail.
    """
    rows = db_get_activities_for_route_match(user_id, route_match, ctx=ctx)
    if not rows:
        return {"ok": True, "route_match": route_match, "activities": []}

    distances = [float(r["distance_m"]) for r in rows if r.get("distance_m") is not None]
    elevations = [
        float(r["elevation_gain_m"]) for r in rows if r.get("elevation_gain_m") is not None
    ]

    return {
        "ok": True,
        "route_match": route_match,
        "activities": rows,
        "stats": {
            "count": len(rows),
            "median_distance_m": median(distances) if distances else None,
            "median_elevation_gain_m": median(elevations) if elevations else None,
            "best_time_s": min(
                (r["moving_time_s"] for r in rows if r.get("moving_time_s") is not None),
                default=None,
            ),
        },
    }


def service_list_route_names_for_sport(
    *,
    user_id: int,
    sport_type_fe: str,
    ctx: AuthCtx,
) -> List[str]:
    """
    Jednoduchý zoznam existujúcich názvov trás pre daný šport — pre prípady,
    keď FE nepotrebuje celý service_get_route_options_for_activity kontext
    (napr. samostatný "Moje trate" prehľad, alebo spätné priradenie bez
    konkrétnej otvorenej aktivity).
    """
    return db_get_distinct_route_names_for_sport(user_id, sport_type_fe, ctx=ctx)

def service_get_route_overview(
    *,
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Prehľad všetkých pomenovaných tratí usera (naprieč športmi), zoradený
    od najviac použitej. Pre widget (top N) a "Moje trate" zoznam stránku.
    """
    from DB.activities_enrichment import db_get_route_match_counts

    rows = db_get_route_match_counts(user_id, ctx=ctx)
    return {"ok": True, "routes": rows}