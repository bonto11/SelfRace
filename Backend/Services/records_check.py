# Services/records_check.py
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple


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

    Algoritmus: two-pointer sliding window s lineárnou interpoláciou
    na presnú hranicu okna. Zložitosť O(n) – pre 50km beh (~18k vzoriek)
    beží v milisekundách.

    Pre každý koncový bod j nájdeme presný čas, v ktorom bežec
    bol vo vzdialenosti (dist[j] - target). Ten leží medzi vzorkami
    i a i+1 → interpolujeme.
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

        # Posuň i tak, aby dist[i] <= window_start_dist < dist[i+1]
        while i + 1 < j and dist_m[i + 1] <= window_start_dist:
            i += 1

        # Lineárna interpolácia času na presnej hranici okna
        d0, d1 = dist_m[i], dist_m[i + 1]
        t0, t1 = time_s[i], time_s[i + 1]

        if d1 <= d0:
            t_start = t0  # zastavený GPS bod – bez interpolácie
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


# =====================================================================
# HLAVNÁ FUNKCIA
# =====================================================================

SEGMENTS: List[Tuple[str, float]] = [
    ("1km",  1_000.0),
    ("5km",  5_000.0),
    ("10km", 10_000.0),
    ("21km", 21_097.5),
    ("42km", 42_195.0),
    ("50km", 50_000.0),
]


def service_check_activity_records(
    activity: Dict[str, Any],
    splits: List[Dict[str, Any]],
    streams: Optional[Dict[str, List[float]]] = None,
) -> List[Dict[str, Any]]:
    """
    Vypočíta najlepšie segmentové časy aktivity + celkové metriky.

    Zatiaľ len print výstupy – porovnanie s historickými rekordami
    a DB zápis prídu v ďalšom kroku.

    streams: {"time": [...], "distance": [...]} – ak sú k dispozícii,
             použije sa presný stream algoritmus, inak fallback na splits.

    Vracia list: [{"type": ..., "value_s"/"value_m": ...}]
    """
    t_start = time.perf_counter()

    sport = (activity.get("sport_type") or activity.get("type") or "").lower()
    activity_id = activity.get("activity_id") or activity.get("id")

    if sport not in ("run", "trail_run", "trailrun", "virtualrun"):
        print(f"[RECORDS] ⏭ Preskakujem sport={sport}, rekordy len pre beh")
        return []

    results: List[Dict[str, Any]] = []

    # ---------------------------------------------------------------
    # 1) CELKOVÉ METRIKY AKTIVITY
    # ---------------------------------------------------------------
    dist = activity.get("distance_m") or activity.get("distance") or 0
    dur = activity.get("moving_time_s") or activity.get("moving_time") or 0

    if dist:
        results.append({"type": "total_distance", "value_m": dist})
        print(f"[RECORDS] 📏 Vzdialenosť aktivity: {dist/1000:.2f} km")
    if dur:
        results.append({"type": "total_time", "value_s": dur})
        print(f"[RECORDS] ⏱ Trvanie aktivity: {_fmt_time(dur)}")

    # ---------------------------------------------------------------
    # 2) SEGMENTOVÉ ČASY
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

    for label, target_m in SEGMENTS:
        best: Optional[float] = None

        if use_streams:
            best = _best_time_for_distance_streams(time_stream, dist_stream, target_m)
        elif sorted_splits:
            window = max(1, round(target_m / 1000))
            best = _best_time_for_distance_splits(sorted_splits, window)

        if best is None:
            print(f"[RECORDS] ⏭ {label}: aktivita je kratšia, preskakujem")
            continue

        pace_s_per_km = best / (target_m / 1000)
        results.append({
            "type": f"segment_{label}",
            "value_s": best,
        })
        print(
            f"[RECORDS] 🏁 Best {label}: {_fmt_time(best)} "
            f"(tempo {_fmt_time(pace_s_per_km)}/km)"
        )

    elapsed_ms = (time.perf_counter() - t_start) * 1000
    print(f"[RECORDS] ⚡ Výpočet trval {elapsed_ms:.1f} ms")

    return results
