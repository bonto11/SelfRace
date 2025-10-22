from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Set, List, Dict, Any
from Modules.SQL.db_handler import get_client

from ..config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_STREAMS,
    TABLE_ACTIVITIES_SPLITS,
    TABLE_ACTIVITIES_LAPS,
)

supabase = get_client()


# =============================
# Pomocné konverzné funkcie
# =============================
def _to_float(x: Any, default: float | None = None) -> float | None:
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def _to_int(x: Any, default: int | None = None) -> int | None:
    try:
        return int(x)
    except (TypeError, ValueError):
        return default


def _compute_pace_seconds_per_km(
    distance_m: int | float | None, moving_time_s: int | float | None
) -> int | None:
    if not distance_m or not moving_time_s or distance_m <= 0 or moving_time_s <= 0:
        return None
    seconds = float(moving_time_s) / (float(distance_m) / 1000.0)
    return int(round(seconds))


def _arr(streams: Dict[str, Any], key: str) -> List[Any]:
    return (streams.get(key) or {}).get("data") or []


# =============================
# Čítanie z DB
# =============================
def load_activities_from_db(user_id: int) -> List[Dict[str, Any]]:
    try:
        response = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        return response.data or []
    except Exception as e:
        print(f"Chyba pri načítaní aktivít: {e}")
        return []


def get_last_timestamp_from_db(user_id: int) -> Optional[datetime]:
    """
    Vráti posledný (max) čas 'date' pre daného usera z activities_summary.
    """
    response = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
        .select("date")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )

    rows = response.data or []
    if not rows:
        return None

    value = rows[0].get("date")
    if not value:
        return None

    if isinstance(value, str):
        # Supabase vracia ISO8601, niekedy s 'Z'
        if value.endswith("Z"):
            value = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(value)
    else:
        dt = value

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    return dt


def get_existing_activities_ids_from_db(user_id: int) -> Set[int]:
    """
    Načíta všetky už uložené Strava activity_id pre daného usera z activities_summary.
    """
    response = (
        supabase.table(TABLE_ACTIVITIES_SUMMARY)
        .select("activity_id")
        .eq("user_id", user_id)
        .execute()
    )

    return {
        int(row["activity_id"])
        for row in (response.data or [])
        if row.get("activity_id") is not None
    }


# =============================
# SUMMARY (FULL JSON -> SI)
# =============================
def upsert_activity_summary_from_full(user_id: int, full: Dict[str, Any]) -> bool:
    """
    Uloží/aktualizuje riadok v activities_summary zo Strava FULL JSONu v SI jednotkách.
    Očakáva polia ako v tvojom vzorku: distance (m), moving_time (s), average_speed (m/s), atď.
    """
    try:
        activity_id = _to_int(full.get("id"))
        if activity_id is None:
            raise ValueError("FULL JSON neobsahuje 'id' aktivity.")

        distance_m = _to_int(round(full.get("distance") or 0))
        moving_time_s = _to_int(full.get("moving_time") or 0)
        elapsed_time_s = _to_int(full.get("elapsed_time") or 0)

        payload = {
            "activity_id": activity_id,
            "user_id": user_id,
            "name": full.get("name"),
            "date": full.get("start_date_local"),
            "timezone": full.get("timezone"),
            "utc_offset_s": _to_int(full.get("utc_offset")),
            "distance_m": distance_m,
            "moving_time_s": moving_time_s,
            "elapsed_time_s": elapsed_time_s,
            "elevation_gain_m": _to_int(round(full.get("total_elevation_gain") or 0)),
            "average_speed_mps": _to_float(full.get("average_speed")),
            "max_speed_mps": _to_float(full.get("max_speed")),
            "average_cadence_rpm": _to_float(full.get("average_cadence")),
            "average_temp_c": _to_float(full.get("average_temp")),
            "average_watts": _to_float(full.get("average_watts")),
            "max_watts": _to_float(full.get("max_watts")),
            "average_heartrate_bpm": (
                _to_int(round(full.get("average_heartrate") or 0))
                if full.get("average_heartrate") is not None
                else None
            ),
            "max_heartrate_bpm": _to_int(full.get("max_heartrate")),
            "elev_high_m": _to_float(full.get("elev_high")),
            "elev_low_m": _to_float(full.get("elev_low")),
            "achievement_count": _to_int(full.get("achievement_count")),
            "pr_count": _to_int(full.get("pr_count")),
            "calories_kcal": _to_int(full.get("calories")),
            "sport_type": full.get("sport_type") or full.get("type"),
            "description": full.get("description"),
            "gear_id": (full.get("gear") or {}).get("id"),
            "gear_name": (full.get("gear") or {}).get("name"),
            "pace_seconds_per_km": _compute_pace_seconds_per_km(
                distance_m, moving_time_s
            ),
        }

        supabase.table(TABLE_ACTIVITIES_SUMMARY).upsert(payload).execute()
        return True

    except Exception as e:
        print("❌ upsert_activity_summary_from_full error:", e)
        return False


# =============================
# STREAMS (activity_details)
# =============================
# Modules/Streams/store.py (môže byť aj v tvojom existujúcom súbore)


def insert_activity_streams(
    user_id: int, activity_id: int, streams: Dict[str, Any]
) -> bool:
    """
    Očakáva Strava /streams s `key_by_type=true`.
    Uloží len (time_s, heartrate_bpm, distance_m). created_at doplní DB.
    """
    times = _arr(streams, "time")
    hr = _arr(streams, "heartrate")
    dist = _arr(streams, "distance")

    n = max(len(times), len(hr), len(dist))
    if n == 0:
        return True

    rows = []
    for i in range(n):
        t = times[i] if i < len(times) else None
        hb = hr[i] if i < len(hr) else None
        dm = dist[i] if i < len(dist) else None

        # ignoruj prázdne body bez času
        if t is None:
            continue

        rows.append(
            {
                "user_id": user_id,
                "activity_id": activity_id,
                "time_s": int(t),  # seconds from start
                "heartrate_bpm": int(hb) if hb is not None else None,
                "distance_m": float(dm) if dm is not None else None,
            }
        )

    # dávkuj
    BATCH = 2000
    for i in range(0, len(rows), BATCH):
        supabase.table(TABLE_ACTIVITIES_STREAMS).upsert(rows[i : i + BATCH]).execute()
    return True


def replace_activity_streams(
    user_id: int, activity_id: int, streams: Dict[str, Any]
) -> bool:
    supabase.table(TABLE_ACTIVITIES_STREAMS).delete().eq("user_id", user_id).eq(
        "activity_id", activity_id
    ).execute()
    return insert_activity_streams(user_id, activity_id, streams)

# =============================
# SPLITS (auto km/mile Strava)
# =============================
def replace_activity_splits(
    user_id: int, activity_id: int, splits_metric: List[Dict[str, Any]] | None
) -> bool:
    try:
        (
            supabase.table(TABLE_ACTIVITIES_SPLITS)
            .delete()
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .execute()
        )

        if not splits_metric:
            return True

        rows: List[Dict[str, Any]] = []
        for s in splits_metric:
            distance_m = _to_int(round(s.get("distance") or 0), 0)
            moving_time_s = _to_int(s.get("moving_time"), 0)

            rows.append(
                {
                    "activity_id": activity_id,
                    "user_id": user_id,
                    "split_index": _to_int(s.get("split"), 0),
                    "distance_m": distance_m,
                    "moving_time_s": moving_time_s,
                    "elapsed_time_s": _to_int(s.get("elapsed_time"), 0),
                    "elevation_diff_m": _to_float(s.get("elevation_difference")),
                    "avg_speed_mps": _to_float(s.get("average_speed")),
                    "avg_gap_mps": _to_float(s.get("average_grade_adjusted_speed")),
                    "avg_hr_bpm": (
                        _to_int(round(s.get("average_heartrate") or 0))
                        if s.get("average_heartrate") is not None
                        else None
                    ),
                    "pace_s_per_km": _compute_pace_seconds_per_km(
                        distance_m, moving_time_s
                    ),
                }
            )

        if rows:
            supabase.table(TABLE_ACTIVITIES_SPLITS).upsert(rows).execute()
        return True

    except Exception as e:
        print("❌ replace_activity_splits error:", e)
        return False


def delete_activity_splits(user_id: int, activity_id: int) -> int:
    """
    Zmaže všetky SPLITS pre daného používateľa a aktivitu.
    Vracia počet zmazaných riadkov (ak API vráti data).
    """
    res = (
        supabase.table(TABLE_ACTIVITIES_SPLITS)
        .delete()
        .eq("user_id", int(user_id))
        .eq("activity_id", int(activity_id))
        .execute()
    )
    return len(res.data or [])


# =============================
# LAPS (zariadením/manuálne)
# =============================
def replace_activity_laps(
    user_id: int, activity_id: int, laps: List[Dict[str, Any]] | None
) -> bool:
    try:
        (
            supabase.table(TABLE_ACTIVITIES_LAPS)
            .delete()
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .execute()
        )

        if not laps:
            return True

        rows: List[Dict[str, Any]] = []
        for i, l in enumerate(laps, start=1):
            distance_m = _to_int(round(l.get("distance") or 0), 0)
            moving_time_s = _to_int(l.get("moving_time"), 0)

            rows.append(
                {
                    "activity_id": activity_id,
                    "user_id": user_id,
                    "lap_index": _to_int(l.get("lap_index"), i),
                    "start_date_local": l.get("start_date_local"),
                    "distance_m": distance_m,
                    "moving_time_s": moving_time_s,
                    "elapsed_time_s": _to_int(l.get("elapsed_time"), 0),
                    "total_elev_gain_m": _to_float(l.get("total_elevation_gain")),
                    "avg_speed_mps": _to_float(l.get("average_speed")),
                    "max_speed_mps": _to_float(l.get("max_speed")),
                    "avg_cadence_rpm": _to_float(l.get("average_cadence")),
                    "avg_watts": _to_float(l.get("average_watts")),
                    "avg_hr_bpm": (
                        _to_int(round(l.get("average_heartrate") or 0))
                        if l.get("average_heartrate") is not None
                        else None
                    ),
                    "max_hr_bpm": _to_int(l.get("max_heartrate")),
                    "pace_s_per_km": _compute_pace_seconds_per_km(
                        distance_m, moving_time_s
                    ),
                }
            )

        if rows:
            supabase.table(TABLE_ACTIVITIES_LAPS).upsert(rows).execute()
        return True

    except Exception as e:
        print("❌ replace_activity_laps error:", e)
        return False


def delete_activity_laps(user_id: int, activity_id: int) -> int:
    """
    Zmaže všetky LAPS pre daného používateľa a aktivitu.
    Vracia počet zmazaných riadkov (ak API vráti data).
    """
    res = (
        supabase.table(TABLE_ACTIVITIES_LAPS)
        .delete()
        .eq("user_id", int(user_id))
        .eq("activity_id", int(activity_id))
        .execute()
    )
    return len(res.data or [])


'''
# =============================
# RAW ARCHÍV (voliteľné)
# =============================
def archive_activity_raw(
    user_id: int, activity_id: int, full_payload: Dict[str, Any]
) -> bool:
    try:
        (
            supabase.table(TABLE_ACTIVITIES_RAW)
            .upsert(
                {
                    "activity_id": int(activity_id),
                    "user_id": int(user_id),
                    "payload": full_payload,
                }
            )
            .execute()
        )
        return True
    except Exception as e:
        print("❌ archive_activity_raw error:", e)
        return False


def get_activity_date(user_id: int, activity_id: int) -> str | None:
    """
    Vráti `date` (timestamptz) z activities_summary pre danú aktivitu/usera
    vo formáte ISO8601 (string), alebo None ak nenájde.
    """
    try:
        resp = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("date")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .limit(1)
            .execute()
        )
        row = (resp.data or [None])[0]
        if not row:
            return None
        return row.get("date")
    except Exception as e:
        print(f"❌ get_activity_date error: {e}")
        return None


def get_activity_summary(user_id: int, activity_id: int) -> dict | None:
    try:
        resp = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .limit(1)
            .execute()
        )
        return (resp.data or [None])[0]
    except Exception as e:
        print(f"❌ get_activity_summary error: {e}")
        return None
'''
