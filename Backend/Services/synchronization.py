from __future__ import annotations

import statistics
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, cast

import requests

from Modules.API.Strava.streams import fetch_and_optionally_store_batch
from Modules.API.Strava.auth import get_access_token
from Services.activity_zones import (
    preview_zones_for_activities,
    upsert_enrichment_minutes,
)
from Services.sport_type import infer_sport_type_fe
from Services.async_jobs import service_enqueue_job, service_run_job_now

from Routes_DB.activities_summary import (
    db_upsert_activities_summary,
    db_get_last_activity_start,
    db_get_existing_activity_ids_since,
    db_get_recent_activity_ids,
    db_get_activity_summary_one,  # predpoklad: má voliteľné user_jwt
)

from Routes_DB.activities_laps import (
    db_delete_laps_for_activity,
    db_upsert_lap,
)
from Routes_DB.activities_splits import (
    db_delete_splits_for_activity,
    db_upsert_split,
)
from Configs.config import STRAVA_BASE

# Koľko detailov (laps/splits) max dotiahnuť v jednej synchronizácii
MAX_FULL_DETAILS_PER_RUN = 150


# -----------------------------------------------------------------------------
# Pomocné konverzie (bezpečné – Strava posiela občas čísla ako stringy)
# -----------------------------------------------------------------------------
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
    "2025-09-06T20:03:35+01:00"   -> "2025-09-06 19:03:35+00" (prevedené do UTC)
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
    laps_raw: List[Dict[str, Any]]
) -> List[tuple[float, float]]:
    out: List[tuple[float, float]] = []
    for L in laps_raw:
        d = _num(L.get("distance") or L.get("distance_m"))
        t = _num(L.get("moving_time") or L.get("moving_time_s"))
        if d > 0 and t > 0:
            out.append((d, t))
    return out


def _extract_dt_pairs_from_splits(
    splits_raw: List[Dict[str, Any]]
) -> List[tuple[float, float]]:
    out: List[tuple[float, float]] = []
    for S in splits_raw:
        d = _num(S.get("distance") or S.get("distance_m"))
        t = _num(S.get("moving_time") or S.get("moving_time_s"))
        if d > 0 and t > 0:
            out.append((d, t))
    return out


def _match_ratio(
    laps_dt: List[tuple[float, float]],
    splits_dt: List[tuple[float, float]],
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
    for (sd, st) in splits_dt:
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


def _median_dist(laps_dt: List[tuple[float, float]]) -> Optional[float]:
    if not laps_dt:
        return None
    try:
        return float(statistics.median([d for (d, _) in laps_dt]))
    except Exception:
        return None


# -----------------------------------------------------------------------------
# Strava session
# -----------------------------------------------------------------------------
def _get_session() -> requests.Session:
    """
    Číta access token z Modules.API.Strava.auth.get_access_token().
    Ak expirovaný, tento modul si ho má sám refreshnúť.
    """
    token = get_access_token()
    if not token:
        raise RuntimeError(
            "Chýba Strava access token. Spusť autorizáciu a /exchange_token."
        )
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# -----------------------------------------------------------------------------
# Normalizácia na tvoju schému (activities_* tabuľky)
# -----------------------------------------------------------------------------
def _normalize_summary(user_id: int, a: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mapuje Strava activity JSON → presne tvoje stĺpce v activities_summary.
    """
    # primárne dátumy
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
        "avg_speed_mps": to_float(
            s.get("average_speed") or s.get("avg_speed_mps")
        ),
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
# Core: import aktivity zo Stravy (summary + detaily)
# -----------------------------------------------------------------------------
def _import_activities_from_strava(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    force_last_days: Optional[int] = 30,
    fetch_details: bool = True,
) -> tuple[Dict[str, int], str]:
    """
    Čisto import aktivity zo Stravy:
      - /athlete/activities (summary)
      - laps/splits pre posledné aktivity

    Vracia:
      - stats dict (imported/updated/skipped/fetched)
      - since_iso_for_scan (odkiaľ ďalej počítať streams/zóny)
    """
    ses = _get_session()

    # AFTER (epoch)
    after_epoch = 0
    since_iso_for_scan = "1970-01-01"

    last_dt = db_get_last_activity_start(user_id, user_jwt=user_jwt)
    if last_dt:
        after_epoch = int(last_dt.timestamp())
        since_iso_for_scan = last_dt.strftime("%Y-%m-%d")
    elif force_last_days is not None:
        after_dt = datetime.now(timezone.utc) - timedelta(days=force_last_days)
        after_epoch = int(after_dt.timestamp())
        since_iso_for_scan = after_dt.strftime("%Y-%m-%d")

    existing = db_get_existing_activity_ids_since(
        user_id,
        since_iso_for_scan,
        user_jwt=user_jwt,
    )

    imported = updated = skipped = fetched = 0
    to_upsert: List[Dict[str, Any]] = []

    print(
        f"[SYNC] user={user_id} after_epoch={after_epoch} "
        f"(since={since_iso_for_scan})"
    )

    page = 1
    while True:
        r = ses.get(
            f"{STRAVA_BASE}/athlete/activities",
            params={"after": after_epoch, "per_page": 100, "page": page},
            timeout=30,
        )
        r.raise_for_status()
        items: List[Dict[str, Any]] = r.json() or []
        if not items:
            break

        fetched += len(items)
        print(f"[SYNC] page={page} fetched={len(items)} (total={fetched})")

        for a in items:
            row = _normalize_summary(user_id, a)
            aid = int(row["activity_id"]) if row.get("activity_id") else None
            if not aid:
                skipped += 1
                continue

            if aid in existing:
                updated += 1
            else:
                imported += 1
                existing.add(aid)

            to_upsert.append(row)

        # dávkuj upserty
        if len(to_upsert) >= 200:
            db_upsert_activities_summary(to_upsert, user_jwt=user_jwt)
            print(f"[SYNC] upsert batch summary rows={len(to_upsert)}")
            to_upsert.clear()

        page += 1
        time.sleep(0.1)  # šetrenie

    if to_upsert:
        db_upsert_activities_summary(to_upsert, user_jwt=user_jwt)
        print(f"[SYNC] upsert remaining summary rows={len(to_upsert)}")
        to_upsert.clear()

    # -------- detaily (laps/splits) --------
    if fetch_details and fetched:
        ids = db_get_recent_activity_ids(
            user_id=user_id,
            since_iso_date=since_iso_for_scan,
            limit=MAX_FULL_DETAILS_PER_RUN,
            user_jwt=user_jwt,
        )

        for i, aid in enumerate(ids, start=1):
            try:
                rl = ses.get(f"{STRAVA_BASE}/activities/{aid}/laps", timeout=30)
                rl.raise_for_status()
                laps_raw = rl.json() or []

                rd = ses.get(f"{STRAVA_BASE}/activities/{aid}", timeout=30)
                rd.raise_for_status()
                detail = rd.json() or {}
                splits_raw = detail.get("splits_metric") or []

                mode = _decide_laps_or_splits(laps_raw, splits_raw)

                if mode == "splits":
                    db_delete_laps_for_activity(aid, user_jwt=user_jwt)
                elif mode == "laps":
                    db_delete_splits_for_activity(aid, user_jwt=user_jwt)

                if mode == "splits":
                    for idx, S in enumerate(splits_raw, start=1):
                        row = _normalize_split(S, user_id, aid, idx)
                        db_upsert_split(row, user_jwt=user_jwt)
                elif mode == "laps":
                    for L in laps_raw:
                        row = _normalize_lap(L, user_id, aid)
                        db_upsert_lap(row, user_jwt=user_jwt)
                else:
                    pass

            except Exception as e:
                skipped += 1
                print(f"[SYNC] details failed id={aid}: {e}")

            time.sleep(0.1)

    stats = {
        "imported": int(imported),
        "updated": int(updated),
        "skipped": int(skipped),
        "fetched": int(fetched),
    }

    print(
        f"[SYNC] import done: imported={imported} "
        f"updated={updated} skipped={skipped} fetched={fetched}"
    )

    return stats, since_iso_for_scan


# -----------------------------------------------------------------------------
# Spoločná enrichment logika (streams + zóny + plan_match)
# -----------------------------------------------------------------------------
def _enrich_activities_for_ids(
    user_id: int,
    activity_ids: List[int],
    *,
    user_jwt: Optional[str] = None,
) -> None:
    if not activity_ids:
        print("[SYNC] enrich: no activity ids, skipping")
        return

    try:
        print(f"[SYNC] streams: fetching & storing for {len(activity_ids)} ids …")
        streams_res = fetch_and_optionally_store_batch(
            user_id,
            activity_ids,
            store=True,
            user_jwt=user_jwt,
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
            user_jwt=user_jwt,
        )

        to_save = [
            it
            for it in (prev.get("items") or [])
            if it.get("ok") and it.get("minutes")
        ]
        saved = upsert_enrichment_minutes(user_id, to_save, user_jwt=user_jwt)
        print(f"[SYNC] zones: enrichment upsert saved rows = {saved.get('saved', 0)}")

        # auto-mapping aktivít na plán cez async job plan_match
        try:
            enqueue = service_enqueue_job(
                user_id=user_id,
                user_uid="",  # v synci nemáš UID, nechávame placeholder
                job_type="plan_match",
                payload={
                    "activity_ids": activity_ids,
                    "days_window": 1,
                    "score_threshold": 0.55,
                },
                priority=90,
                max_attempts=1,
                dedupe_key=None,
                user_jwt=user_jwt,
            )

            job = (enqueue or {}).get("job")
            if not job:
                print("[SYNC] plan auto-mapping: enqueue_failed")
            else:
                run = service_run_job_now(
                    user_id=user_id,
                    job_id=int(job["id"]),
                    worker_id="sync_auto_map",
                    user_jwt=user_jwt,
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
    user_jwt: Optional[str] = None,
) -> None:
    """
    Wrapper: vyberie recent IDs od since_iso_for_scan a pustí enrichment.
    """
    try:
        ids_recent = db_get_recent_activity_ids(
            user_id=user_id,
            since_iso_date=since_iso_for_scan,
            limit=500,
            user_jwt=user_jwt,
        )

        if not ids_recent:
            print("[SYNC] enrich: no recent activity ids, skipping")
            return

        _enrich_activities_for_ids(
            user_id=user_id,
            activity_ids=ids_recent,
            user_jwt=user_jwt,
        )
    except Exception as e:
        print(f"[SYNC] enrich wrapper failed: {e}")


# -----------------------------------------------------------------------------
# Hlavná service funkcia – manuálny import z FE (initial/delta)
# -----------------------------------------------------------------------------
def service_sync_activities(
    user_id: int,
    force_last_days: Optional[int] = 30,
    fetch_details: bool = True,
    user_jwt: Optional[str] = None,
) -> Dict[str, int]:
    """
    Manuálny sync z FE (import zo Stravy):

    - Stiahne aktivity zo Stravy a uloží do Supabase (cez Routes_DB).
    - Dotiahne detaily (laps/splits).
    - Napočíta HR zóny z cached streams.
    - Spustí plan_match job na auto-mapping.

    Tu JWT vyžadujeme – ide o RLS klienta.
    """
    if not user_jwt:
        raise RuntimeError(
            "service_sync_activities: missing user_jwt (RLS/JWT required)"
        )
    jwt = cast(str, user_jwt)

    # 1) čistý import (summary + detaily)
    stats, since_iso_for_scan = _import_activities_from_strava(
        user_id=user_id,
        user_jwt=jwt,
        force_last_days=force_last_days,
        fetch_details=fetch_details,
    )

    # 2) enrichment (streams + zóny + plan_match)
    _enrich_activities_after_import(
        user_id=user_id,
        since_iso_for_scan=since_iso_for_scan,
        user_jwt=jwt,
    )

    return stats


# -----------------------------------------------------------------------------
# Single-activity sync – používané z webhooku alebo manuálne
# -----------------------------------------------------------------------------
def service_sync_single_activity(
    user_id: int,
    strava_activity_id: int,
    fetch_details: bool = True,
    user_jwt: Optional[str] = None,
) -> Dict[str, int]:
    """
    Sync JEDNEJ Strava aktivity – pre webhook (user_jwt=None → service client)
    aj manuálne použitie (user_jwt != None → RLS).

    - detail (/activities/{id})
    - upsert do activities_summary
    - laps/splits do activities_laps / activities_splits
    - enrichment (streams + zóny + plan_match) pre konkrétnu aktivitu
    """
    ses = _get_session()

    imported = 0
    updated = 0
    skipped = 0
    fetched = 0

    aid = int(strava_activity_id)

    # ---------- 1) DETAIL AKTIVITY ----------
    try:
        rd = ses.get(f"{STRAVA_BASE}/activities/{aid}", timeout=30)
        rd.raise_for_status()
        detail = rd.json() or {}
        fetched += 1
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] failed to fetch activity id={aid}: {e}")
        return {
            "imported": 0,
            "updated": 0,
            "skipped": 1,
            "fetched": 0,
        }

    # ---------- 2) SUMMARY ROW ----------
    row = _normalize_summary(user_id, detail)
    if not row.get("activity_id"):
        print(f"[SYNC:single] missing activity_id for id={aid}")
        return {
            "imported": 0,
            "updated": 0,
            "skipped": 1,
            "fetched": 0,
        }

    # ak už bola niekedy soft-deleted, sync ju má "oživiť"
    row["deleted_at"] = None

    # zisti, či už existuje (user_id + activity_id)
    try:
        existing_row = db_get_activity_summary_one(
            activity_id=aid,
            user_jwt=user_jwt,
        )
        exists = bool(existing_row)
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] check existing failed id={aid}: {e}")
        exists = False

    try:
        db_upsert_activities_summary([row], user_jwt=user_jwt)
        if exists:
            updated += 1
        else:
            imported += 1
    except Exception as e:  # noqa: BLE001
        print(f"[SYNC:single] summary upsert failed id={aid}: {e}")
        return {
            "imported": 0,
            "updated": 0,
            "skipped": 1,
            "fetched": fetched,
        }

    # ---------- 3) LAPS / SPLITS (voliteľné) ----------
    if fetch_details:
        try:
            rl = ses.get(f"{STRAVA_BASE}/activities/{aid}/laps", timeout=30)
            rl.raise_for_status()
            laps_raw = rl.json() or []
        except Exception as e:  # noqa: BLE001
            print(f"[SYNC:single] laps fetch failed id={aid}: {e}")
            laps_raw = []

        splits_raw = detail.get("splits_metric") or []
        mode = _decide_laps_or_splits(laps_raw, splits_raw)

        try:
            if mode == "splits":
                # zmaž staré LAPS (keď preferujeme splits)
                db_delete_laps_for_activity(aid, user_jwt=user_jwt)

                split_rows = [
                    _normalize_split(S, user_id, aid, idx)
                    for idx, S in enumerate(splits_raw, start=1)
                ]
                for row in split_rows:
                    db_upsert_split(row, user_jwt=user_jwt)

            elif mode == "laps":
                # zmaž staré SPLITS (keď preferujeme laps)
                db_delete_splits_for_activity(aid, user_jwt=user_jwt)

                lap_rows = [
                    _normalize_lap(L, user_id, aid)
                    for L in laps_raw
                ]
                for row in lap_rows:
                    db_upsert_lap(row, user_jwt=user_jwt)
            else:
                print(f"[SYNC:single] no usable laps/splits for id={aid}")
        except Exception as e:  # noqa: BLE001
            print(f"[SYNC:single] laps/splits upsert failed id={aid}: {e}")
            skipped += 1

    # ---------- 4) ENRICHMENT pre túto jednu aktivitu ----------
    try:
        _enrich_activities_for_ids(
            user_id=user_id,
            activity_ids=[aid],
            user_jwt=user_jwt,
        )
    except Exception as e:
        print(f"[SYNC:single] enrichment failed id={aid}: {e}")

    print(
        f"[SYNC:single] done id={aid}: imported={imported} "
        f"updated={updated} skipped={skipped} fetched={fetched}"
    )

    return {
        "imported": int(imported),
        "updated": int(updated),
        "skipped": int(skipped),
        "fetched": int(fetched),
    }