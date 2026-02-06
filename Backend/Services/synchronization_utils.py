#Services/synchronization_utils
from __future__ import annotations

import statistics
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from Services.sport_type import infer_sport_type_fe
from Services.activities_streams import fetch_and_optionally_store_batch
from Services.activity_zones import (
    preview_zones_for_activities,
    upsert_enrichment_minutes,
)

from Routes_DB.activities_summary import (
    db_get_recent_activity_ids,
)
from Configs.config import (
FIRST_SYNC_DAYS, FIRST_SYNC_MAX,RECONNECT_DAYS, RECONNECT_MAX, QUICK_DAYS, QUICK_MAX, MANUAL_DAYS, MANUAL_MAX
)

from Modules.Supabase.auth import AuthCtx

from dataclasses import dataclass


@dataclass(frozen=True)
class SyncPlan:
    kind: str            # "first" | "reconnect" | "quick"
    days_back: int
    max_activities: int
    reason: str


def decide_sync_plan(
    *,
    last_activity_dt: Optional[datetime],
    ever_synced_at: Optional[datetime],
) -> SyncPlan:
    if (last_activity_dt is None) and (ever_synced_at is None):
        return SyncPlan(
            kind="first",
            days_back=FIRST_SYNC_DAYS,
            max_activities=FIRST_SYNC_MAX,
            reason="no activities in DB",
        )

    if (last_activity_dt is None) and (ever_synced_at is not None):
        return SyncPlan(
            kind="reconnect",
            days_back=RECONNECT_DAYS,
            max_activities=RECONNECT_MAX,
            reason="strava reconnected",
        )

    if (last_activity_dt is not None) and (ever_synced_at is not None):
        return SyncPlan(
            kind="manual",
            days_back=MANUAL_DAYS,
            max_activities=MANUAL_MAX,
            reason="manual import from FE",
        )

    # panel_init / quick / default
    return SyncPlan(
        kind="quick",
        days_back=QUICK_DAYS,
        max_activities=QUICK_MAX,
        reason="quick",
    )

# ---------------------------------------------------------------------
# Pomocné konverzie
# ---------------------------------------------------------------------
def to_int(v, default=None):
    if v is None or v == "":
        return default
    try:
        return int(round(float(v)))
    except Exception:
        return default


def to_float(v, default=None):
    if v is None or v == "":
        return default
    try:
        return float(v)
    except Exception:
        return default


def clamp_int(v: int | None, lo: int = -32768, hi: int = 32767) -> int | None:
    if v is None:
        return None
    return max(lo, min(hi, v))


def to_int_rounded(v, default=None, clamp_smallint: bool = False):
    if v is None or v == "":
        return default
    try:
        n = int(round(float(v)))
        return clamp_int(n) if clamp_smallint else n
    except Exception:
        return default


def to_str(v, default: str = "") -> str:
    return str(v) if v is not None else default


def iso_to_timestamptz_str(iso: Optional[str]) -> Optional[str]:
    """
    "2025-09-06T20:03:35Z"        -> "2025-09-06 20:03:35+00"
    "2025-09-06T20:03:35+01:00"   -> "2025-09-06 19:03:35+00" (UTC)
    """
    if not iso:
        return None
    try:
        s = iso.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y-%m-%d %H:%M:%S+00")
    except Exception:
        return None


def _num(v) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _extract_dt_pairs_from_laps(
    laps_raw: List[Dict[str, Any]],
) -> List[Tuple[float, float]]:
    out: List[Tuple[float, float]] = []
    for L in laps_raw:
        d = _num(L.get("distance") or L.get("distance_m"))
        t = _num(L.get("moving_time") or L.get("moving_time_s"))
        if d > 0 and t > 0:
            out.append((d, t))
    return out


def _extract_dt_pairs_from_splits(
    splits_raw: List[Dict[str, Any]],
) -> List[Tuple[float, float]]:
    out: List[Tuple[float, float]] = []
    for S in splits_raw:
        d = _num(S.get("distance") or S.get("distance_m"))
        t = _num(S.get("moving_time") or S.get("moving_time_s"))
        if d > 0 and t > 0:
            out.append((d, t))
    return out


def _match_ratio(
    laps_dt: List[Tuple[float, float]],
    splits_dt: List[Tuple[float, float]],
    tol_m: float = 20.0,
    tol_s: float = 10.0,
) -> float:
    """
    Spáruje splits s najbližšími lapmi. Vráti pomer úspešne spárovaných párov.
    """
    if not laps_dt or not splits_dt:
        return 0.0

    used = set()
    matches = 0
    for sd, st in splits_dt:
        best_i = None
        best_err = 1e18
        for i, (ld, lt) in enumerate(laps_dt):
            if i in used:
                continue
            err = abs(ld - sd) + 3 * abs(lt - st)
            if err < best_err:
                best_err = err
                best_i = i
        if best_i is None:
            continue
        ld, lt = laps_dt[best_i]
        if abs(ld - sd) <= tol_m and abs(lt - st) <= tol_s:
            matches += 1
            used.add(best_i)

    denom = max(1, min(len(laps_dt), len(splits_dt)))
    return matches / denom


def _median_dist(laps_dt: List[Tuple[float, float]]) -> Optional[float]:
    if not laps_dt:
        return None
    try:
        return float(statistics.median([d for (d, _) in laps_dt]))
    except Exception:
        return None


# ---------------------------------------------------------------------
# Normalizácia na tvoje tabuľky
# ---------------------------------------------------------------------
def _normalize_summary(user_id: int, a: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mapuje Strava activity JSON → presne tvoje stĺpce v activities_summary.
    """
    start_utc_iso = a.get("start_date")
    start_local_iso = a.get("start_date_local")
    date_for_db = iso_to_timestamptz_str(start_utc_iso) or iso_to_timestamptz_str(
        start_local_iso
    )

    distance_m = to_int(a.get("distance"))
    moving_s = to_int(a.get("moving_time"))
    elapsed_s = to_int(a.get("elapsed_time"))
    avg_speed = to_float(a.get("average_speed"))
    max_speed = to_float(a.get("max_speed"))
    elev_gain_m = to_int(a.get("total_elevation_gain"))
    elev_high_m = to_float(a.get("elev_high"))
    elev_low_m = to_float(a.get("elev_low"))

    avg_hr = to_float(a.get("average_heartrate"))
    max_hr = to_float(a.get("max_heartrate"))

    avg_cad_rpm = to_float(a.get("average_cadence"))
    avg_temp = to_int(a.get("average_temp"))
    avg_watts = to_float(a.get("average_watts") or a.get("weighted_average_watts"))
    max_watts = to_int(a.get("max_watts"))

    pace_s_per_km = None
    if distance_m and moving_s and distance_m > 0:
        pace_s_per_km = int(round(moving_s / (distance_m / 1000.0)))

    tz_label = to_str(a.get("timezone"))
    utc_offset_s = to_int(a.get("utc_offset"))

    calories_kcal = to_int(a.get("calories"))
    if calories_kcal is None:
        kj = to_float(a.get("kilojoules"))
        if kj is not None:
            calories_kcal = int(round(kj * 0.239006))  # 1 kJ ≈ 0.239 kcal

    sport_type = to_str(a.get("sport_type") or a.get("type"))
    name = to_str(a.get("name"))
    sport_type_fe = infer_sport_type_fe(sport_type, name, distance_m, moving_s)

    return {
        "user_id": user_id,
        "activity_id": to_int(a.get("id")),
        "name": name,
        "date": date_for_db,
        "timezone": tz_label,
        "utc_offset_s": utc_offset_s,
        "distance_m": distance_m,
        "moving_time_s": moving_s,
        "elapsed_time_s": elapsed_s,
        "average_speed_mps": avg_speed,
        "max_speed_mps": max_speed,
        "pace_seconds_per_km": pace_s_per_km,
        "elevation_gain_m": elev_gain_m,
        "elev_high_m": elev_high_m,
        "elev_low_m": elev_low_m,
        "average_heartrate_bpm": avg_hr,
        "max_heartrate_bpm": max_hr,
        "average_watts": avg_watts,
        "max_watts": max_watts,
        "average_temp_c": avg_temp,
        "average_cadence_rpm": avg_cad_rpm,
        "sport_type": sport_type,
        "sport_type_fe": sport_type_fe,
        "gear_id": to_str(a.get("gear_id")),
        "gear_name": to_str(a.get("gear_name")),
        "description": a.get("description"),
        "comment": None,
        "achievement_count": to_int(a.get("achievement_count")),
        "pr_count": to_int(a.get("pr_count")),
        "calories_kcal": calories_kcal,
        "user_uid": None,
    }


def _normalize_lap(l: Dict[str, Any], user_id: int, activity_id: int) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "activity_id": to_int_rounded(l.get("activity_id") or activity_id),
        "lap_index": to_int_rounded(
            l.get("lap_index"),
            clamp_smallint=True,
        ),
        "start_date_local": l.get("start_date") or l.get("start_date_local"),
        "distance_m": to_int_rounded(l.get("distance")),
        "moving_time_s": to_int_rounded(l.get("moving_time")),
        "elapsed_time_s": to_int_rounded(l.get("elapsed_time")),
        "pace_s_per_km": to_int_rounded(
            l.get("pace_s_per_km"),
            clamp_smallint=True,
        ),
        "total_elev_gain_m": to_float(
            l.get("total_elevation_gain") or l.get("total_elev_gain_m")
        ),
        "avg_speed_mps": to_float(l.get("average_speed") or l.get("avg_speed_mps")),
        "max_speed_mps": to_float(l.get("max_speed") or l.get("max_speed_mps")),
        "avg_cadence_rpm": to_float(
            l.get("average_cadence") or l.get("avg_cadence_rpm")
        ),
        "avg_watts": to_float(l.get("average_watts") or l.get("avg_watts")),
        "avg_hr_bpm": to_int_rounded(
            l.get("average_heartrate") or l.get("avg_hr_bpm"),
            clamp_smallint=True,
        ),
        "max_hr_bpm": to_int_rounded(
            l.get("max_heartrate") or l.get("max_hr_bpm"),
            clamp_smallint=True,
        ),
    }


def _normalize_split(
    s: Dict[str, Any],
    user_id: int,
    activity_id: int,
    idx1: int,
) -> Dict[str, Any]:
    return {
        "user_id": user_id,
        "activity_id": to_int_rounded(
            s.get("activity_id") or activity_id,
        ),
        "split_index": to_int_rounded(
            s.get("split") or s.get("split_index") or idx1,
            clamp_smallint=True,
        ),
        "distance_m": to_int_rounded(s.get("distance")),
        "moving_time_s": to_int_rounded(s.get("moving_time")),
        "elapsed_time_s": to_int_rounded(s.get("elapsed_time")),
        "pace_s_per_km": to_int_rounded(
            s.get("pace_s_per_km"),
            clamp_smallint=True,
        ),
        "elevation_diff_m": to_float(
            s.get("elevation_difference") or s.get("elevation_diff_m")
        ),
        "avg_speed_mps": to_float(s.get("average_speed") or s.get("avg_speed_mps")),
        "avg_gap_mps": to_float(
            s.get("average_grade_adjusted_speed") or s.get("avg_gap_mps")
        ),
        "avg_hr_bpm": to_int_rounded(
            s.get("average_heartrate") or s.get("avg_hr_bpm"),
            clamp_smallint=True,
        ),
    }


def _decide_laps_or_splits(
    laps_raw: List[Dict[str, Any]],
    splits_raw: List[Dict[str, Any]],
) -> str:
    """
    Vráti 'splits' | 'laps' | 'none' podľa podobnosti.
    """
    if not laps_raw and not splits_raw:
        return "none"
    if laps_raw and not splits_raw:
        return "laps"
    if splits_raw and not laps_raw:
        return "splits"

    laps_dt = _extract_dt_pairs_from_laps(laps_raw)
    splits_dt = _extract_dt_pairs_from_splits(splits_raw)

    if not laps_dt and not splits_dt:
        return "none"
    if laps_dt and not splits_dt:
        return "laps"
    if splits_dt and not laps_dt:
        return "splits"

    ratio = _match_ratio(laps_dt, splits_dt, tol_m=20.0, tol_s=10.0)
    if ratio >= 0.70:
        return "splits"

    med = _median_dist(laps_dt)
    if med is not None and 900.0 <= med <= 1100.0 and ratio >= 0.50:
        return "splits"

    return "laps"

# -----------------------------------------------------------------------------
# Spoločná enrichment logika (streams + zóny + plan_match)
# -----------------------------------------------------------------------------

def enrich_activities_for_ids(
    user_id: int,
    activity_ids: List[int],
    *,
    ctx: AuthCtx,
) -> None:
    """
    Enrichment pipeline pre zoznam aktivít:
      - dotiahne / uloží streams,
      - spočíta minutáž v zónach,
      - skúsi plan_match cez async job.

    - ak service=False → RLS režim, vyžaduje JWT
    - ak service=True  → používame service klientov, JWT len forwardneme (typicky None)
    """
    if not activity_ids:
        print("[SYNC] enrich: no activity ids, skipping")
        return


    try:
        print(f"[SYNC] streams: fetching & storing for {len(activity_ids)} ids …")
        streams_res = fetch_and_optionally_store_batch(
            user_id,
            activity_ids,
            store=True,
            ctx=ctx,
        )
        print(
            f"[SYNC] streams: stored={streams_res.get('stored')} / "
            f"total={streams_res.get('count')}"
        )

        print("[SYNC] zones: computing minutes from cached streams …")
        prev = preview_zones_for_activities(
            user_id,
            activity_ids,
            fetch_if_missing=False,
            ctx=ctx,
        )

        to_save = [
            it for it in (prev.get("items") or []) if it.get("ok") and it.get("minutes")
        ]
        saved = upsert_enrichment_minutes(
            user_id,
            to_save,
            ctx=ctx,
        )
        print(f"[SYNC] zones: enrichment upsert saved rows = {saved.get('saved', 0)}")


        try:

            from Services.async_jobs import service_enqueue_job, service_run_job_now
            
            enqueue = service_enqueue_job(
                user_id=user_id,
                job_type="plan_match",
                payload={
                    "activity_ids": activity_ids,
                    "days_window": 1,
                    "score_threshold": 0.55,
                },
                priority=90,
                max_attempts=1,
                dedupe_key=None,
                ctx=ctx,
            )

            job = (enqueue or {}).get("job")
            if not job:
                print("[SYNC] plan auto-mapping: enqueue_failed")
            else:
                run = service_run_job_now(
                    user_id=user_id,
                    job_id=int(job["id"]),
                    worker_id="sync_auto_map",
                    ctx=ctx,
                )

                job_row = run.get("job") or {}
                result = job_row.get("result") or {}

                print(
                    "[SYNC] plan auto-mapping (job): "
                    f"candidates={result.get('candidates')} "
                    f"mapped={result.get('mapped')} "
                    f"skipped={result.get('skipped')} "
                    f"processed={result.get('processed')} "
                    f"error={run.get('error')}"
                )

        except Exception as e:
            print(f"[SYNC] plan auto-mapping via job failed: {e}")

    except Exception as e:
        print(f"[SYNC] zones enrichment failed: {e}")

def _enrich_activities_after_import(
    user_id: int,
    since_iso_for_scan: str,
    *,
    ctx: AuthCtx,
) -> None:
    """
    Wrapper: vyberie recent IDs od since_iso_for_scan a pustí enrichment.
    (Používa sa len pri manuálnom syncu z FE – RLS režim.)
    """
    try:
        ids_recent = db_get_recent_activity_ids(
            user_id=user_id,
            since_iso_date=since_iso_for_scan,
            limit=500,
            ctx=ctx,
        )

        if not ids_recent:
            print("[SYNC] enrich: no recent activity ids, skipping")
            return

        enrich_activities_for_ids(
            user_id=user_id,
            activity_ids=ids_recent,
            ctx=ctx,
        )
    except Exception as e:
        print(f"[SYNC] enrich wrapper failed: {e}")

def decide_use_laps_or_generate_splits(
    laps_raw: List[Dict[str, Any]],
) -> str:
    """
    Vráti:
      - "laps"   → intervalový tréning (použijeme laps)
      - "splits" → long run / auto-lap (vygenerujeme splits)
      - "none"   → nič nemá zmysel
    """
    if not laps_raw or len(laps_raw) < 2:
        return "splits"

    laps_dt = _extract_dt_pairs_from_laps(laps_raw)
    if len(laps_dt) < 2:
        return "splits"

    distances = [d for d, _ in laps_dt]
    mean = statistics.mean(distances)
    spread = max(abs(d - mean) for d in distances) / mean

    # intervaly: rovnaké úseky
    if len(distances) >= 3 and spread <= 0.05:
        return "laps"

    return "splits"

def generate_splits_from_laps(
    *,
    user_id: int,
    activity_id: int,
    laps: list[dict],
    ctx: AuthCtx,
) -> list[dict]:
    """
    Z laps spraví 1–km splits (alebo lap-based fallback).
    """
    out = []
    for i, L in enumerate(laps):
        out.append(
            {
                "user_id": user_id,
                "activity_id": activity_id,
                "split_index": i + 1,
                "distance_m": L.get("distance_m"),
                "moving_time_s": L.get("moving_time_s"),
                "elapsed_time_s": L.get("elapsed_time_s"),
                "pace_s_per_km": L.get("pace_s_per_km"),
                "avg_speed_mps": L.get("avg_speed_mps"),
                "avg_hr_bpm": L.get("avg_hr_bpm"),
            }
        )
    return out
