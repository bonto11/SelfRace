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

SEGMENTS: List[Tuple[str, int]] = [
    ("1km",  1_000),
    ("5km",  5_000),
    ("10km", 10_000),
    ("21km", 21_098),
    ("42km", 42_195),
    ("50km", 50_000),
]

SUPPORTED_SPORTS = ("run", "trail_run", "trailrun", "virtualrun")


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


def _best_time_for_distance_streams(
    time_s: List[float],
    dist_m: List[float],
    target_m: float,
) -> Optional[float]:
    """
    Presný výpočet najrýchlejšieho úseku danej dĺžky zo streamov.

    Two-pointer sliding window s lineárnou interpoláciou na presnú
    hranicu okna. Zložitosť O(n) – 50km beh (~18k vzoriek) = ms.
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
    if s in SUPPORTED_SPORTS:
        return "run"
    return s


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
    2) Uloží segmenty do activities_enrichment.best_segments (vždy).
    3) Porovná s users_bests a pri prekonaní upsertne nový rekord.

    Vracia list NOVÝCH rekordov:
    [{"type": "segment_5km"|"total_distance"|"total_time", "value": ..., "prev": ...}]
    """
    t_start = time.perf_counter()

    sport_raw = activity.get("sport_type") or activity.get("type") or ""
    sport = _normalize_sport(sport_raw)
    activity_id = activity.get("activity_id") or activity.get("id")
    activity_name = activity.get("name") or activity.get("activity_name") or ""
    achieved_at = activity.get("date") or activity.get("start_date")

    if sport != "run":
        print(f"[RECORDS] ⏭ Preskakujem sport={sport_raw}, rekordy zatiaľ len pre beh")
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

    computed_segments: Dict[str, float] = {}

    for label, target_m in SEGMENTS:
        best: Optional[float] = None

        if use_streams:
            best = _best_time_for_distance_streams(
                time_stream, dist_stream, float(target_m)
            )
        elif sorted_splits:
            window = max(1, round(target_m / 1000))
            best = _best_time_for_distance_splits(sorted_splits, window)

        if best is None:
            continue

        computed_segments[label] = round(best, 1)
        pace = best / (target_m / 1000)
        print(f"[RECORDS] 🏁 Best {label}: {_fmt_time(best)} (tempo {_fmt_time(pace)}/km)")

    # ---------------------------------------------------------------
    # 2) ULOŽENIE SEGMENTOV DO ENRICHMENT
    # ---------------------------------------------------------------
    if computed_segments:
        try:
            db_upsert_enrichment_rows_merge(
                rows=[{
                    "user_id": int(user_id),
                    "activity_id": int(activity_id),
                    "best_segments": computed_segments,
                    "updated_at": now_iso,
                }],
                ctx=ctx,
            )
            print(f"[RECORDS] 💾 Segmenty uložené do enrichment: {computed_segments}")
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
    # 4) POROVNANIE SEGMENTOV + UPSERT
    # ---------------------------------------------------------------
    for label, target_m in SEGMENTS:
        new_time = computed_segments.get(label)
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
                    "activity_id": int(activity_id),
                    "activity_name": activity_name,
                    "achieved_at": achieved_at,
                    "updated_at": now_iso,
                },
                ctx=ctx,
            )
            prev_str = _fmt_time(float(prev_time)) if prev_time else "—"
            print(f"[RECORDS] 🏆 NOVÝ REKORD {label}: {_fmt_time(new_time)} (predtým {prev_str})")
            new_records.append({
                "type": f"segment_{label}",
                "value": new_time,
                "prev": prev_time,
            })
        except Exception as e:  # noqa: BLE001
            print(f"❌ [RECORDS] upsert best {label} failed: {e}")

    # ---------------------------------------------------------------
    # 5) CELKOVÉ REKORDY (sentinel riadok distance_m = 0)
    # ---------------------------------------------------------------
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
                    "activity_id": int(activity_id),
                    "activity_name": activity_name,
                    "achieved_at": achieved_at,
                    "updated_at": now_iso,
                    "total_distance_m": int(max(new_dist, prev_max_dist)),
                    "total_time_s": int(max(new_time_total, prev_max_time)),
                },
                ctx=ctx,
            )
            if dist_record:
                print(
                    f"[RECORDS] 🏆 NOVÝ REKORD – Najdlhšia vzdialenosť: "
                    f"{new_dist/1000:.2f} km (predtým {prev_max_dist/1000:.2f} km)"
                )
                new_records.append({
                    "type": "total_distance",
                    "value": new_dist,
                    "prev": prev_max_dist,
                })
            if time_record:
                print(
                    f"[RECORDS] 🏆 NOVÝ REKORD – Najdlhší čas: "
                    f"{_fmt_time(new_time_total)} (predtým {_fmt_time(prev_max_time)})"
                )
                new_records.append({
                    "type": "total_time",
                    "value": new_time_total,
                    "prev": prev_max_time,
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
