# Services/records_check.py
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from Modules.Supabase.auth import AuthCtx
from DB.user_bests import db_fetch_user_bests, db_upsert_user_best
from DB.activities_enrichment import db_upsert_enrichment_rows_merge


# =====================================================================
# KONŠTANTY
# =====================================================================

# distance_m = 0 je sentinel riadok pre celkové rekordy
# (najdlhšia vzdialenosť + najdlhší čas)
TOTALS_SENTINEL_DISTANCE = 0

# (label, cieľová vzdialenosť v m, stĺpec v enrichment) — beh
RUN_SEGMENTS: List[Tuple[str, int, str]] = [
    ("1km",      1_000,  "best_1k_s"),
    ("5km",      5_000,  "best_5k_s"),
    ("10km",     10_000, "best_10k_s"),
    ("21.1km",   21_098, "best_half_s"),
    ("42.2km",   42_195, "best_marathon_s"),
    ("50km",     50_000, "best_50k_s"),
]

# plávanie — bazénové klasické dĺžky, žiadny enrichment stĺpec (zatiaľ len users_bests)
SWIM_SEGMENTS: List[Tuple[str, int, str]] = [
    ("50m",    50,    "best_50m_s"),
    ("100m",   100,   "best_100m_s"),
    ("200m",   200,   "best_200m_s"),
    ("400m",   400,   "best_400m_s"),
    ("800m",   800,   "best_800m_s"),
    ("1500m",  1_500, "best_1500m_s"),
]

# bicykel — klasické vzdialenostné segmenty, žiadny enrichment stĺpec
RIDE_SEGMENTS: List[Tuple[str, int, str]] = [
    ("5km",   5_000,   "best_ride_5k_s"),
    ("10km",  10_000,  "best_ride_10k_s"),
    ("20km",  20_000,  "best_ride_20k_s"),
    ("40km",  40_000,  "best_ride_40k_s"),
    ("100km", 100_000, "best_ride_100k_s"),
]

RUN_SPORTS = ("run", "trail_run", "trailrun", "virtualrun")
SWIM_SPORTS = ("swim", "openwaterswim")
RIDE_SPORTS = ("ride", "virtualride", "gravelride", "mountainbikeride", "ebikeride", "handcycle", "velomobile")


# =====================================================================
# POMOCNÉ FUNKCIE
# =====================================================================

def _fmt_time(seconds: float) -> str:
    s = int(round(seconds))
    h = s // 3600
    m = (s % 3600) // 60
    sec = s % 60
    if h > 0:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m}:{sec:02d}"


def _fmt_delta(delta_seconds: float) -> str:
    """
    Naformátuje rozdiel v sekundách na čitateľný tvar zlepšenia,
    napr. 83.4 -> "1:23", 4.2 -> "4 s".
    """
    d = abs(delta_seconds)
    if d < 60:
        return f"{d:.0f} s"
    m = int(d // 60)
    s = int(round(d % 60))
    return f"{m}:{s:02d} min"


def _best_time_for_distance_streams(
    time_s: List[float],
    dist_m: List[float],
    target_m: float,
) -> Optional[float]:
    """
    Presný výpočet najrýchlejšieho úseku danej dĺžky zo streamov.

    Two-pointer sliding window s lineárnou interpoláciou na presnú
    hranicu okna. Zložitosť O(n) – 100km cyklo (~desiatky tisíc vzoriek) = ms.
    """
    n = len(dist_m)
    if n < 2 or dist_m[-1] < target_m:
        return None

    best: Optional[float] = None
    i = 0

    for j in range(1, n):
        window_start_dist = dist_m[j] - target_m
        if window_start_dist < dist_m[0]:
            continue

        while i + 1 < j and dist_m[i + 1] <= window_start_dist:
            i += 1

        d0, d1 = dist_m[i], dist_m[i + 1]
        t0, t1 = time_s[i], time_s[i + 1]

        if d1 <= d0:
            t_start = t0
        else:
            ratio = (window_start_dist - d0) / (d1 - d0)
            t_start = t0 + ratio * (t1 - t0)

        elapsed = time_s[j] - t_start
        if elapsed > 0 and (best is None or elapsed < best):
            best = elapsed

    return best


def _best_time_for_distance_splits(
    splits: List[Dict[str, Any]],
    window: int,
) -> Optional[float]:
    """
    Fallback: rolling window cez 1km splity (menej presné –
    hranice okna sú viazané na hranice splitov).
    """
    times = [
        s.get("moving_time_s") or s.get("elapsed_time_s")
        for s in splits
    ]
    times = [t for t in times if t is not None]

    if len(times) < window:
        return None

    best = None
    for k in range(len(times) - window + 1):
        total = sum(times[k:k + window])
        if best is None or total < best:
            best = total
    return best


def _normalize_sport(sport_raw: str) -> str:
    """Mapuje Strava sport_type na náš 'sport' kľúč v users_bests."""
    s = (sport_raw or "").lower()
    if s in RUN_SPORTS:
        return "run"
    if s in SWIM_SPORTS:
        return "swim"
    if s in RIDE_SPORTS:
        return "ride"
    return s


def _segments_for_sport(sport: str) -> List[Tuple[str, int, str]]:
    if sport == "run":
        return RUN_SEGMENTS
    if sport == "swim":
        return SWIM_SEGMENTS
    if sport == "ride":
        return RIDE_SEGMENTS
    return []


# =====================================================================
# HLAVNÁ FUNKCIA
# =====================================================================

def service_check_activity_records(
    user_id: int,
    activity: Dict[str, Any],
    splits: List[Dict[str, Any]],
    ctx: AuthCtx,
    streams: Optional[Dict[str, List[float]]] = None,
) -> List[Dict[str, Any]]:
    """
    1) Vypočíta najlepšie segmentové časy aktivity (streams > splits fallback).
    2) Uloží segmenty do activities_enrichment (best_1k_s, best_5k_s, ...) — len beh.
    3) Porovná s users_bests a pri prekonaní upsertne nový rekord.

    Vracia list NOVÝCH rekordov, pripravený priamo na notifikáciu:
    [{
        "type": "segment_5km",
        "sport": "run",
        "label": "5km",
        "value_s": 1885.0,
        "prev_s": 1968.0,
        "delta_s": 83.0,
        "value_fmt": "31:25",
        "delta_fmt": "1:23 min",
    }, ...]
    """
    t_start = time.perf_counter()

    sport_raw = activity.get("sport_type") or activity.get("type") or ""
    sport = _normalize_sport(sport_raw)
    activity_id = activity.get("activity_id") or activity.get("id")
    activity_name = activity.get("name") or activity.get("activity_name") or ""
    achieved_at = activity.get("date") or activity.get("start_date")

    segments = _segments_for_sport(sport)
    if not segments:
        print(f"[RECORDS] ⏭ Preskakujem sport={sport_raw}, rekordy podporujeme len pre beh, plávanie a bicykel")
        return []

    new_records: List[Dict[str, Any]] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    # ---------------------------------------------------------------
    # 1) VÝPOČET SEGMENTOV
    # ---------------------------------------------------------------
    time_stream = (streams or {}).get("time") or []
    dist_stream = (streams or {}).get("distance") or []
    use_streams = len(time_stream) >= 2 and len(time_stream) == len(dist_stream)

    if use_streams:
        print(f"[RECORDS] 🎯 Používam streams ({len(time_stream)} vzoriek) – presný výpočet")
    elif splits:
        print(f"[RECORDS] ⚠ Streams nedostupné, fallback na splits ({len(splits)} splitov)")
    else:
        print(f"[RECORDS] ⚠ Žiadne streams ani splits pre activity_id={activity_id}")

    sorted_splits = sorted(splits or [], key=lambda s: s.get("split_index", 0))

    # {enrichment_column: best_time_s} — relevantné len pre beh, ostatné športy enrichment nemajú
    computed: Dict[str, float] = {}
    # {distance_m: best_time_s} pre porovnanie s users_bests
    computed_by_dist: Dict[int, float] = {}

    for label, target_m, col in segments:
        best: Optional[float] = None

        if use_streams:
            best = _best_time_for_distance_streams(
                time_stream, dist_stream, float(target_m)
            )
        elif sorted_splits:
            # window v "jednotkách splitu" — Strava splits sú vždy po 1km
            # (metric) alebo 1 míli. Pre beh to sedí priamo, pre bike
            # splits zvyčajne nemáme (Strava ich pre ride negeneruje
            # rovnako), takže fallback bez streamov pri ride reálne nič nenájde.
            window = max(1, round(target_m / 1000)) if sport in ("run", "ride") else None
            if window:
                best = _best_time_for_distance_splits(sorted_splits, window)

        if best is None:
            print(f"[RECORDS] ⏭ {label}: aktivita je kratšia alebo chýbajú dáta, preskakujem")
            continue

        best = round(best, 1)
        computed_by_dist[target_m] = best
        if sport == "run":
            computed[col] = best
        pace = best / (target_m / 1000) if target_m >= 1000 else None
        pace_str = f" (tempo {_fmt_time(pace)}/km)" if pace else ""
        print(f"[RECORDS] 🏁 Best {label}: {_fmt_time(best)}{pace_str}")

    # ---------------------------------------------------------------
    # 2) ULOŽENIE SEGMENTOV DO ENRICHMENT (len beh, samostatné stĺpce)
    # ---------------------------------------------------------------
    if computed:
        try:
            db_upsert_enrichment_rows_merge(
                rows=[{
                    "user_id": int(user_id),
                    "activity_id": activity_id,
                    **computed,
                    "updated_at": now_iso,
                }],
                ctx=ctx,
            )
            print(f"[RECORDS] 💾 Segmenty uložené do enrichment: {computed}")
        except Exception as e:  # noqa: BLE001
            print(f"❌ [RECORDS] enrichment save failed: {e}")

    # ---------------------------------------------------------------
    # 3) NAČÍTANIE EXISTUJÚCICH REKORDOV
    # ---------------------------------------------------------------
    try:
        bests_rows = db_fetch_user_bests(user_id=user_id, sport=sport, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"❌ [RECORDS] fetch user_bests failed: {e}")
        bests_rows = []

    bests_by_dist: Dict[int, Dict[str, Any]] = {
        int(r["distance_m"]): r for r in bests_rows
        if r.get("distance_m") is not None
    }

    # ---------------------------------------------------------------
    # 4) POROVNANIE SEGMENTOV + UPSERT REKORDOV
    # ---------------------------------------------------------------
    for label, target_m, _col in segments:
        new_time = computed_by_dist.get(target_m)
        if new_time is None:
            continue

        existing = bests_by_dist.get(target_m)
        prev_time = existing.get("best_time_s") if existing else None

        if prev_time is not None and new_time >= float(prev_time):
            print(f"[RECORDS] ✅ {label}: {_fmt_time(new_time)} (rekord ostáva {_fmt_time(float(prev_time))})")
            continue

        try:
            db_upsert_user_best(
                row={
                    "user_id": int(user_id),
                    "sport": sport,
                    "distance_m": target_m,
                    "best_time_s": int(round(new_time)),
                    "activity_id": activity_id,
                    "activity_name": activity_name,
                    "achieved_at": achieved_at,
                    "updated_at": now_iso,
                },
                ctx=ctx,
            )

            delta_s = (float(prev_time) - new_time) if prev_time is not None else None
            prev_str = _fmt_time(float(prev_time)) if prev_time else None

            if delta_s is not None:
                print(
                    f"[RECORDS] 🏆 NOVÝ REKORD {label}: {_fmt_time(new_time)} "
                    f"(zlepšenie o {_fmt_delta(delta_s)}, predtým {prev_str})"
                )
            else:
                print(f"[RECORDS] 🏆 NOVÝ REKORD {label}: {_fmt_time(new_time)} (prvý zaznamenaný čas)")

            new_records.append({
                "type": f"segment_{label}",
                "sport": sport,
                "label": label,
                "value_s": new_time,
                "prev_s": prev_time,
                "delta_s": delta_s,
                "value_fmt": _fmt_time(new_time),
                "delta_fmt": _fmt_delta(delta_s) if delta_s is not None else None,
            })
        except Exception as e:  # noqa: BLE001
            print(f"❌ [RECORDS] upsert best {label} failed: {e}")

    # ---------------------------------------------------------------
    # 5) CELKOVÉ REKORDY (sentinel riadok distance_m = 0) — beh + bike
    # ---------------------------------------------------------------
    if sport in ("run", "ride"):
        new_dist = float(activity.get("distance_m") or activity.get("distance") or 0)
        new_time_total = float(activity.get("moving_time_s") or activity.get("moving_time") or 0)

        totals_row = bests_by_dist.get(TOTALS_SENTINEL_DISTANCE)
        prev_max_dist = float(totals_row.get("total_distance_m") or 0) if totals_row else 0.0
        prev_max_time = float(totals_row.get("total_time_s") or 0) if totals_row else 0.0

        dist_record = new_dist > 0 and new_dist > prev_max_dist
        time_record = new_time_total > 0 and new_time_total > prev_max_time

        if dist_record or time_record:
            try:
                db_upsert_user_best(
                    row={
                        "user_id": int(user_id),
                        "sport": sport,
                        "distance_m": TOTALS_SENTINEL_DISTANCE,
                        "best_time_s": None,
                        "activity_id": activity_id,
                        "activity_name": activity_name,
                        "achieved_at": achieved_at,
                        "updated_at": now_iso,
                        "total_distance_m": int(max(new_dist, prev_max_dist)),
                        "total_time_s": int(max(new_time_total, prev_max_time)),
                    },
                    ctx=ctx,
                )
                if dist_record:
                    delta_dist = new_dist - prev_max_dist
                    print(
                        f"[RECORDS] 🏆 NOVÝ REKORD – Najdlhšia vzdialenosť: "
                        f"{new_dist/1000:.2f} km (o {delta_dist/1000:.2f} km viac, predtým {prev_max_dist/1000:.2f} km)"
                    )
                    new_records.append({
                        "type": "total_distance",
                        "sport": sport,
                        "label": "Najdlhšia vzdialenosť",
                        "value_s": None,
                        "value_m": new_dist,
                        "prev_m": prev_max_dist,
                        "delta_m": delta_dist,
                        "value_fmt": f"{new_dist/1000:.2f} km",
                        "delta_fmt": f"{delta_dist/1000:.2f} km",
                    })
                if time_record:
                    delta_time = new_time_total - prev_max_time
                    print(
                        f"[RECORDS] 🏆 NOVÝ REKORD – Najdlhší čas: "
                        f"{_fmt_time(new_time_total)} (o {_fmt_delta(delta_time)} viac, predtým {_fmt_time(prev_max_time)})"
                    )
                    new_records.append({
                        "type": "total_time",
                        "sport": sport,
                        "label": "Najdlhší čas",
                        "value_s": new_time_total,
                        "prev_s": prev_max_time,
                        "delta_s": delta_time,
                        "value_fmt": _fmt_time(new_time_total),
                        "delta_fmt": _fmt_delta(delta_time),
                    })
            except Exception as e:  # noqa: BLE001
                print(f"❌ [RECORDS] upsert totals failed: {e}")
        else:
            print(
                f"[RECORDS] ✅ Celkové rekordy ostávajú "
                f"(max dist {prev_max_dist/1000:.2f} km, max čas {_fmt_time(prev_max_time)})"
            )

    elapsed_ms = (time.perf_counter() - t_start) * 1000
    print(f"[RECORDS] ⚡ Výpočet + DB trval {elapsed_ms:.1f} ms")

    return new_records