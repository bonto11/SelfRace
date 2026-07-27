from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, date

from Modules.Supabase.auth import AuthCtx
from DB.activities_summary import db_get_activity_summary_one
from Services.time import hhmmss_to_seconds, seconds_to_hhmmss
from DB.user_bests import (
    db_fetch_user_bests,
    db_upsert_user_best,
    db_delete_user_best,
)

# Povolené vzdialenosti podľa športu.
# MUSÍ zodpovedať DISTANCE_OPTIONS_BY_SPORT vo FE
# (src/app/features/bests/utils/bests.ts) — len čísla (m), bez labelov.
STD_DISTANCES_BY_SPORT: dict[str, list[int]] = {
    "run": [400, 1000, 5000, 10000, 20000, 21097, 30000, 42195, 50000],
    "ride": [10000, 20000, 40000, 50000, 90000, 100000, 160934, 180000],
    "swim": [100, 400, 750, 1000, 1500, 1900, 3800, 5000],
    "triathlon": [25750, 51500, 113000, 226000],
    # strength/hyrox nie sú vzdialenosti, ale interné kódy cvikov/formátov
    # (1RM, max reps, atď.) — rovnaká konvencia ako vo FE.
    "strength": [1, 2, 3, 4, 5, 6, 7],
    "ocr": [5000, 10000, 21000, 50000],
    "hyrox": [1, 2, 3, 4],
    "skate": [],  # zatiaľ bez pevného zoznamu -> allowed_distances() neobmedzuje
}

# Hranica "aktuálny" vs "potenciál/expired" pre osobné rekordy.
# MUSÍ zodpovedať PB_VALID_DAYS v Services/AI/athlete_state/prompts.py,
# aby FE aj AI videli rovnakú vec.
PB_VALID_DAYS = 180


def allowed_distances(sport: str) -> List[int]:
    return STD_DISTANCES_BY_SPORT.get(sport, [])


def _days_ago_from_date(date_str: Optional[str]) -> Optional[int]:
    """Vypočíta počet dní od zadaného ISO dátumu po dnešok."""
    if not date_str:
        return None
    try:
        d = date.fromisoformat(str(date_str)[:10])
        return (date.today() - d).days
    except Exception:
        return None


def _pb_freshness(date_str: Optional[str]) -> Tuple[Optional[int], bool]:
    """
    Vráti (days_ago, is_expired) pre daný dátum PB.
    Chýbajúci/nevalidný dátum sa FAIL-SAFE považuje za is_expired=True
    (nikdy nechceme, aby neznámy vek dopadol ako "čerstvý").
    """
    days_ago = _days_ago_from_date(date_str)
    is_expired = days_ago is None or days_ago > PB_VALID_DAYS
    return days_ago, is_expired


def service_fetch_user_bests(
    user_id: int,
    ctx: AuthCtx,
    sport: str = "run",
) -> List[Dict[str, Any]]:
    """
    Vysoko-úrovňový fetch:
      - zavolá DB vrstvu
      - dopočíta time_str z best_time_s
      - dopočíta days_ago a is_expired (pre FE badge "starý rekord")
    """

    rows = db_fetch_user_bests(user_id, sport, ctx=ctx)
    for r in rows:
        best_time_s = r.get("best_time_s") or 0
        r["time_str"] = seconds_to_hhmmss(best_time_s)

        date_str = r.get("achieved_at") or r.get("updated_at")
        days_ago, is_expired = _pb_freshness(date_str)
        r["days_ago"] = days_ago
        r["is_expired"] = is_expired
    return rows


def service_upsert_user_best(
    user_id: int,
    payload: Dict[str, Any],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Validácia + normalizácia payloadu a následný UPSERT do DB.
    """
    sport = str(payload.get("sport") or "run").lower()

    # --- distance ---
    raw_dist = payload.get("distance_m")
    if raw_dist is None or (isinstance(raw_dist, str) and not raw_dist.strip()):
        raise ValueError("Missing distance_m")
    try:
        distance_m = int(str(raw_dist))
    except Exception:
        raise ValueError("distance_m must be an integer")

    if allowed_distances(sport) and distance_m not in allowed_distances(sport):
        raise ValueError("Unsupported distance for sport")

    # --- time ---
    if payload.get("time_sec") is not None:
        try:
            time_sec = int(str(payload["time_sec"]))
        except Exception:
            raise ValueError("time_sec must be an integer")
    else:
        time_sec = hhmmss_to_seconds(
            payload.get("time_str")
            if isinstance(payload.get("time_str"), str)
            else None
        )

    if not time_sec:
        raise ValueError("Missing/invalid time (time_sec/time_str)")

    # --- základ, ktoré vždy posielame ---
    row: Dict[str, Any] = {
        "user_id": user_id,
        "sport": sport,
        "distance_m": distance_m,
        "best_time_s": int(time_sec),
        "updated_at": datetime.utcnow().isoformat(),
    }

    # --- voliteľné polia: pridaj IBA ak prišli (neprepisuj na NULL) ---
    act = payload.get("activity_id", "__MISSING__")
    if act != "__MISSING__":
        try:
            row["activity_id"] = int(str(act)) if str(act).strip() else None
        except Exception:
            row["activity_id"] = None

    act_name = payload.get("activity_name", "__MISSING__")
    if act_name != "__MISSING__":
        v = (act_name or "").strip()
        row["activity_name"] = v if v else None

    ach = payload.get("achieved_at", "__MISSING__")
    if ach != "__MISSING__":
        row["achieved_at"] = ach if (isinstance(ach, str) and ach.strip()) else None

    # ✅ PRIDANÉ PRE WIDGET (Toto už máš)
    tot_dist = payload.get("total_distance_m", "__MISSING__")
    if tot_dist != "__MISSING__":
        try:
            row["total_distance_m"] = int(str(tot_dist)) if str(tot_dist).strip() else None
        except Exception:
            row["total_distance_m"] = None

    tot_time = payload.get("total_time_s", "__MISSING__")
    if tot_time != "__MISSING__":
        try:
            row["total_time_s"] = int(str(tot_time)) if str(tot_time).strip() else None
        except Exception:
            row["total_time_s"] = None

    # Ak máme activity_id, ale frontend nám neposlal total_distance_m alebo total_time_s
    act_id = row.get("activity_id")
    if act_id and (row.get("total_distance_m") is None or row.get("total_time_s") is None):
        # Pylance potrebuje istotu, že act_id je int
        summary = db_get_activity_summary_one(ctx, int(act_id))
        if summary:
            if row.get("total_distance_m") is None:
                row["total_distance_m"] = int(summary.get("distance_m") or 0) or None

            if row.get("total_time_s") is None:
                # Uprednostníme moving_time, ak nie je, vezmeme elapsed
                row["total_time_s"] = int(summary.get("moving_time_s") or summary.get("elapsed_time_s") or 0) or None
    # Uloženie do DB
    saved = db_upsert_user_best(row, ctx=ctx)

    best_time_s = saved.get("best_time_s") or row["best_time_s"]
    saved["time_str"] = seconds_to_hhmmss(best_time_s)

    date_str = saved.get("achieved_at") or saved.get("updated_at")
    days_ago, is_expired = _pb_freshness(date_str)
    saved["days_ago"] = days_ago
    saved["is_expired"] = is_expired

    return saved


def service_delete_user_best(
    user_id: int,
    sport: str,
    distance_m: int,
    ctx: AuthCtx,
) -> int:
    """
    Tenšia obálka okolo DB delete – kvôli konzistencii service vrstvy.
    """

    return db_delete_user_best(user_id, sport, distance_m, ctx=ctx)


def service_build_bests_block_for_analysis(
    user_id: int,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Minimalizované PB pre AI, pre všetky športy zo STD_DISTANCES_BY_SPORT.
    Do výstupu sa pridá kľúč pre daný šport IBA ak má user reálne aspoň
    jeden záznam — žiadne prázdne "ride": [] navyše v kontexte pre AI.

    Každý záznam obsahuje days_ago a is_expired (rovnaká logika ako FE),
    aby ich AI (Services/AI/athlete_state/prompts.py) vedela odlíšiť
    aktuálny stav od starého potenciálu.

    Režimy:
      - service=False: RLS (require_jwt + RLS klient).
      - service=True: service DB klient (user_jwt forward, bez require_jwt).
    """

    out: Dict[str, List[Dict[str, Any]]] = {}

    for sport in STD_DISTANCES_BY_SPORT.keys():
        try:
            rows = db_fetch_user_bests(user_id, sport, ctx=ctx)
        except Exception:
            # šport zatiaľ nemá DB podporu / iný problém -> preskoč, nezhoď celý request
            continue

        if not rows:
            continue

        sport_bests: List[Dict[str, Any]] = []
        for r in rows:
            best_time_s = r.get("best_time_s") or 0
            time_str = seconds_to_hhmmss(best_time_s)
            date_str = r.get("achieved_at") or r.get("updated_at")
            days_ago, is_expired = _pb_freshness(date_str)

            sport_bests.append(
                {
                    "distance_m": r.get("distance_m"),
                    "best_time_s": best_time_s,
                    "time_str": time_str,
                    "date": date_str,
                    "days_ago": days_ago,
                    "is_expired": is_expired,
                }
            )

        if sport_bests:
            out[sport] = sport_bests

    return out