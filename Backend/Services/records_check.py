# Services/records_check.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from Modules.Supabase.auth import AuthCtx


# =====================================================================
# POMOCNÉ FUNKCIE
# =====================================================================

def _rolling_best(splits: List[Dict[str, Any]], window: int) -> Optional[float]:
    """
    Nájde najrýchlejší rolling window N splitov.
    Vracia najmenší súčet time_s pre okno veľkosti N.
    """
    times = [s.get("moving_time_s") or s.get("elapsed_time_s") for s in splits]
    times = [t for t in times if t is not None]

    if len(times) < window:
        return None

    best = None
    for i in range(len(times) - window + 1):
        total = sum(times[i:i + window])
        if best is None or total < best:
            best = total
    return best


def _fmt_time(seconds: float) -> str:
    s = int(round(seconds))
    h = s // 3600
    m = (s % 3600) // 60
    sec = s % 60
    if h > 0:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m}:{sec:02d}"


# =====================================================================
# HLAVNÁ FUNKCIA
# =====================================================================

def service_check_activity_records(
    user_id: int,
    activity: Dict[str, Any],
    splits: List[Dict[str, Any]],
    all_activities: List[Dict[str, Any]],
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """
    Porovná metriky novej aktivity s historickými maximami.
    Zatiaľ len print výstupy – DB zápis a notifikácie prídu neskôr.

    Vracia list nových rekordov: [{"type": ..., "value": ..., "prev": ...}]
    """
    sport = activity.get("sport_type") or activity.get("type") or ""
    sport = sport.lower()

    # Len bežecké aktivity pre teraz
    if sport not in ("run", "trail_run", "virtualrun"):
        print(f"[RECORDS] ⏭ Preskakujem sport={sport}, rekordy len pre beh")
        return []

    new_records: List[Dict[str, Any]] = []
    activity_id = activity.get("activity_id") or activity.get("id")

    # Historické aktivity bez tejto novej
    history = [
        a for a in all_activities
        if (a.get("activity_id") or a.get("id")) != activity_id
        and (a.get("sport_type") or a.get("type") or "").lower()
        in ("run", "trail_run", "virtualrun")
    ]

    # ---------------------------------------------------------------
    # 1) NAJDLHŠIA VZDIALENOSŤ
    # ---------------------------------------------------------------
    new_dist = activity.get("distance_m") or activity.get("distance") or 0
    hist_max_dist = max(
        (a.get("distance_m") or a.get("distance") or 0 for a in history),
        default=0,
    )
    if new_dist and new_dist > hist_max_dist:
        new_records.append({
            "type": "longest_distance",
            "value_m": new_dist,
            "prev_m": hist_max_dist,
        })
        print(
            f"[RECORDS] 🏆 NOVÝ REKORD – Najdlhšia vzdialenosť: "
            f"{new_dist/1000:.2f} km (predtým {hist_max_dist/1000:.2f} km)"
        )

    # ---------------------------------------------------------------
    # 2) NAJDLHŠÍ ČAS
    # ---------------------------------------------------------------
    new_time = activity.get("moving_time_s") or activity.get("moving_time") or 0
    hist_max_time = max(
        (a.get("moving_time_s") or a.get("moving_time") or 0 for a in history),
        default=0,
    )
    if new_time and new_time > hist_max_time:
        new_records.append({
            "type": "longest_time",
            "value_s": new_time,
            "prev_s": hist_max_time,
        })
        print(
            f"[RECORDS] 🏆 NOVÝ REKORD – Najdlhší čas: "
            f"{_fmt_time(new_time)} (predtým {_fmt_time(hist_max_time)})"
        )

    # ---------------------------------------------------------------
    # 3) SEGMENTOVÉ REKORDY ZO SPLITOV (1k/5k/10k/21k/42k/50k)
    # ---------------------------------------------------------------
    if not splits:
        print(f"[RECORDS] ⚠ Žiadne splits pre activity_id={activity_id}, preskakujem segmenty")
        return new_records

    # Zoradíme splits podľa split_index
    sorted_splits = sorted(splits, key=lambda s: s.get("split_index", 0))
    n_splits = len(sorted_splits)

    SEGMENTS: List[Tuple[str, int]] = [
        ("1km",  1),
        ("5km",  5),
        ("10km", 10),
        ("21km", 21),
        ("42km", 42),
        ("50km", 50),
    ]

    for label, window in SEGMENTS:
        if n_splits < window:
            print(f"[RECORDS] ⏭ {label}: nedostatok splitov ({n_splits}/{window}), preskakujem")
            continue

        new_best = _rolling_best(sorted_splits, window)
        if new_best is None:
            continue

        # TODO: Tu načítame historické best pre daný segment z DB
        # Zatiaľ simulujeme že neexistuje historický rekord
        hist_best: Optional[float] = None  # db_get_segment_record(user_id, label, ctx)

        if hist_best is None or new_best < hist_best:
            new_records.append({
                "type": f"segment_{label}",
                "value_s": new_best,
                "prev_s": hist_best,
            })
            prev_str = _fmt_time(hist_best) if hist_best else "—"
            print(
                f"[RECORDS] 🏆 NOVÝ REKORD – {label}: "
                f"{_fmt_time(new_best)} (predtým {prev_str})"
            )
        else:
            print(
                f"[RECORDS] ✅ {label}: {_fmt_time(new_best)} "
                f"(rekord je {_fmt_time(hist_best)})"
            )

    return new_records
