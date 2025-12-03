# Modules/Services/compute_zones.py
from __future__ import annotations

from typing import Dict, Any, List, Optional, cast
from datetime import datetime, timedelta, timezone

from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_ACTIVITIES_STREAMS,
    TABLE_ACTIVITIES_ENRICHMENT,
    TABLE_ACTIVITIES_SUMMARY,
)
from Services.users import service_get_user_uid
from Services.user_zones import service_load_user_zones, ZonesOut  # typ + loader
from Modules.API.Strava.streams import (
    fetch_and_optionally_store_batch,
    cache_streams_for_activities,
)

sb = get_client()

# ------------------------- utils -------------------------

def _to_int(v: Any) -> Optional[int]:
    try:
        if v is None:
            return None
        return int(v)
    except Exception:
        try:
            return int(round(float(v)))
        except Exception:
            return None


def _rows(resp) -> List[Dict[str, Any]]:
    return cast(List[Dict[str, Any]], resp.data or [])


def _iso_utc_months_ago(months: int) -> str:
    now = datetime.now(timezone.utc)
    dt = now - timedelta(days=30 * max(1, months))
    return dt.strftime("%Y-%m-%d")


def _to_int_min(x) -> int:
    try:
        return int(round(float(x)))
    except Exception:
        return 0


def _canon_sport(s: Optional[str]) -> str:
    if not s:
        return "other"
    x = str(s).strip().lower()
    if x in {"run", "running"}:
        return "running"
    if x in {"ride", "bike", "cycling"}:
        return "cycling"
    return "other"


# -------------------- DB loaders (summary/streams) --------------------

def _load_activity_ids_since(user_id: int, since_iso_date: str) -> List[int]:
    out: List[int] = []
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("activity_id,date")
        .eq("user_id", user_id)
        .gte("date", since_iso_date)
        .order("date", desc=True)
        .execute()
    )
    for r in _rows(res):
        aid = _to_int(r.get("activity_id"))
        if aid is not None:
            out.append(aid)
    return out


def _load_summary_map(user_id: int, ids: List[int]) -> dict[int, dict]:
    if not ids:
        return {}
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select(
            "activity_id, average_heartrate_bpm, moving_time_s, distance_m, sport_type_fe"
        )
        .eq("user_id", user_id)
        .in_("activity_id", ids)
        .execute()
    )
    mp: dict[int, dict] = {}
    for r in (res.data or []):
        try:
            aid = int(r["activity_id"])
        except Exception:
            continue
        mp[aid] = {
            "avg_hr_bpm": r.get("average_heartrate_bpm"),
            "moving_time_s": r.get("moving_time_s"),
            "distance_m": r.get("distance_m"),
            "sport_type_fe": _canon_sport(r.get("sport_type_fe")),
        }
    return mp


def _load_streams_row(user_id: int, activity_id: int) -> Optional[Dict[str, Any]]:
    r = (
        sb.table(TABLE_ACTIVITIES_STREAMS)
        .select("time_s, heartrate_bpm")
        .eq("user_id", user_id)
        .eq("activity_id", activity_id)
        .limit(1)
        .execute()
    )
    row = (r.data or [None])[0]
    
    return row


# -------------------- zónové helpery --------------------

def _zones_out_to_numeric(z: ZonesOut) -> Dict[str, int]:
    """
    ZonesOut -> numerické hranice.
    Doplňuje chýbajúce hodnoty reťazovo. Ak stále chýbajú, použije fallback
    podľa % HRmax (ak je) a logne to.
    """
    def n(key: str, default: Optional[int] = None) -> Optional[int]:
        v = z.get(key)  # type: ignore[index]
        try:
            if v is None:
                return default
            return int(round(float(v)))
        except Exception:
            return default

    hrmax = n("hr_max")
    z1_min = n("z1_min", 0)
    z1_max = n("z1_max")
    z2_min = n("z2_min", z1_max + 1 if z1_max is not None else None)
    z2_max = n("z2_max")
    z3_min = n("z3_min", z2_max + 1 if z2_max is not None else None)
    z3_max = n("z3_max")
    z4_min = n("z4_min", z3_max + 1 if z3_max is not None else None)
    z4_max = n("z4_max")
    z5_min = n("z5_min", z4_max + 1 if z4_max is not None else None)

    # Fallback: ak stále chýba časť párov, skús percentá z HRmax
    need_fallback = any(v is None for v in [z1_max, z2_min, z2_max, z3_min, z3_max, z4_min, z4_max, z5_min])
    if need_fallback and hrmax:
        z1_max = int(round(hrmax * 0.60))
        z2_min = int(round(hrmax * 0.60)); z2_max = int(round(hrmax * 0.70))
        z3_min = int(round(hrmax * 0.70)); z3_max = int(round(hrmax * 0.80))
        z4_min = int(round(hrmax * 0.80)); z4_max = int(round(hrmax * 0.90))
        z5_min = int(round(hrmax * 0.90))

    out = {
        "z1_min": int(z1_min or 0),
        "z1_max": int(z1_max or (z2_min - 1 if z2_min else (hrmax * 0.60 if hrmax else 120))),
        "z2_min": int(z2_min or ((z1_max or 119) + 1)),
        "z2_max": int(z2_max or (z3_min - 1 if z3_min else (hrmax * 0.70 if hrmax else 140))),
        "z3_min": int(z3_min or ((z2_max or 139) + 1)),
        "z3_max": int(z3_max or (z4_min - 1 if z4_min else (hrmax * 0.80 if hrmax else 160))),
        "z4_min": int(z4_min or ((z3_max or 159) + 1)),
        "z4_max": int(z4_max or (z5_min - 1 if z5_min else (hrmax * 0.90 if hrmax else 180))),
        "z5_min": int(z5_min or ((z4_max or 179) + 1)),
    }

    return out


def _zone_of(hr: Optional[int], Z: Dict[str, int]) -> str:
    if hr is None:
        return "unclassified"
    if Z["z1_min"] <= hr <= Z["z1_max"]:
        return "z1"
    if Z["z2_min"] <= hr <= Z["z2_max"]:
        return "z2"
    if Z["z3_min"] <= hr <= Z["z3_max"]:
        return "z3"
    if Z["z4_min"] <= hr <= Z["z4_max"]:
        return "z4"
    if hr >= Z["z5_min"]:
        return "z5"
    return "unclassified"


# -------------------- fetch ak chýba --------------------

def _fetch_and_store_if_missing(user_id: int, activity_ids: List[int]) -> None:
    fetch_and_optionally_store_batch(user_id, activity_ids, store=True)

# -------------------- výpočet minút --------------------

def _compute_minutes_for_streams(
    stream_row: Dict[str, Any], Z: Dict[str, int]
) -> dict | None:
    time_s = stream_row.get("time_s") or []
    hr = stream_row.get("heartrate_bpm") or []
    if not time_s:
        return None
    if not hr:
        return None

    n = len(time_s)
    buckets = {"z1": 0.0, "z2": 0.0, "z3": 0.0, "z4": 0.0, "z5": 0.0}

    for i in range(n):
        t0 = int(time_s[i] or 0)
        t1 = int(time_s[i + 1]) if i + 1 < n and time_s[i + 1] is not None else (t0 + 1)
        dur = max(0, t1 - t0)
        h = int(hr[i]) if i < len(hr) and hr[i] is not None else None
        if h is None:
            continue
        b = _zone_of(h, Z)
        buckets[b] += float(dur)

    out = {
        "z1_min": round(buckets["z1"] / 60.0, 2),
        "z2_min": round(buckets["z2"] / 60.0, 2),
        "z3_min": round(buckets["z3"] / 60.0, 2),
        "z4_min": round(buckets["z4"] / 60.0, 2),
        "z5_min": round(buckets["z5"] / 60.0, 2),
    }

    return out


# -------------------- public API --------------------

def preview_zones_for_activities(
    user_id: int, activity_ids: List[int], fetch_if_missing: bool = True
) -> Dict[str, Any]:
    # per-sport cache + fallback (running -> latest any)
    zones_cache: dict[str, Optional[Dict[str, int]]] = {}

    def _load_numeric_for(s: Optional[str]) -> Optional[Dict[str, int]]:
        s_key = _canon_sport(s)
        if s_key in zones_cache:
            return zones_cache[s_key]
        z_out = service_load_user_zones(user_id, s_key)  # ZonesOut | None
        if z_out:
            zones_cache[s_key] = _zones_out_to_numeric(z_out)
        else:
            zones_cache[s_key] = None
        return zones_cache[s_key]

    default_z = _load_numeric_for("running") or _load_numeric_for(None)
    if not default_z:
        return {"ok": False, "error": "No zones for user", "items": []}

    # ktoré aktivity nemajú streamy
    missing: List[int] = []
    for aid in activity_ids:
        row = _load_streams_row(user_id, int(aid))
        if not row or not (row.get("time_s") or []):
            missing.append(int(aid))

    if missing and fetch_if_missing:
        _fetch_and_store_if_missing(user_id, missing)

    # summary pre mapping activity_id -> sport
    s_map = _load_summary_map(user_id, [int(x) for x in activity_ids])

    # výpočet s per-sport zónami
    items: List[dict] = []
    have = 0
    for aid in activity_ids:
        aid_i = int(aid)
        row = _load_streams_row(user_id, aid_i)
        if not row or not (row.get("time_s") or []):
            items.append({"activity_id": aid_i, "ok": False, "reason": "no_streams"})
            continue

        sp = _canon_sport((s_map.get(aid_i) or {}).get("sport_type_fe"))
        Z = _load_numeric_for(sp) or _load_numeric_for("running") or default_z

        mins = _compute_minutes_for_streams(row, Z)
        if mins is None:
            items.append({"activity_id": aid_i, "ok": False, "reason": "no_hr"})
            continue

        items.append({"activity_id": aid_i, "ok": True, "minutes": mins})
        have += 1

    return {"ok": True, "user_id": user_id, "zones": default_z, "items": items}


def upsert_enrichment_minutes(user_id: int, items: list[dict]) -> dict:
    if not items:
        return {"saved": 0, "skipped": 0}

    ids: List[int] = []
    for it in items:
        if it.get("ok") and it.get("minutes") and it.get("activity_id"):
            try:
                ids.append(int(it["activity_id"]))
            except Exception:
                pass

    s_map = _load_summary_map(user_id, ids)
    now_ts = datetime.now(timezone.utc).isoformat()
    user_uid = service_get_user_uid(user_id)

    rows: List[dict] = []
    skipped = 0
    for it in items:
        aid = it.get("activity_id")
        mins = (it.get("minutes") or {}) if it.get("ok") else None
        if not aid or not mins:
            skipped += 1
            continue
        try:
            aid_i = int(aid)
        except Exception:
            skipped += 1
            continue

        extras = s_map.get(aid_i, {})
        row = {
            "user_id": int(user_id),
            "user_uid": user_uid,
            "activity_id": aid_i,
            "z1_min": _to_int_min(mins.get("z1_min")),
            "z2_min": _to_int_min(mins.get("z2_min")),
            "z3_min": _to_int_min(mins.get("z3_min")),
            "z4_min": _to_int_min(mins.get("z4_min")),
            "z5_min": _to_int_min(mins.get("z5_min")),
            "computed_at": now_ts,
            "avg_hr_bpm": extras.get("avg_hr_bpm"),
            "moving_time_s": extras.get("moving_time_s"),
            "distance_m": extras.get("distance_m"),
            "sport_type_fe": extras.get("sport_type_fe") or "other",
        }
        rows.append(row)

    if not rows:
        return {"saved": 0, "skipped": skipped}

    saved = 0
    BATCH = 200
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        
        resp = sb.table(TABLE_ACTIVITIES_ENRICHMENT).upsert(
            chunk, on_conflict="activity_id"
        ).execute()
        # Nie každý klient vracia count; aspoň logni špičku dát
        saved += len(chunk)

    return {"saved": saved, "skipped": skipped}


def backfill_enrichment_for_period(
    user_id: int,
    months: int = 3,
    fetch_if_missing: bool = True,
    save: bool = True,
    batch: int = 25,
) -> dict:
    since_iso = _iso_utc_months_ago(months)

    ids = _load_activity_ids_since(user_id, since_iso)
    total = len(ids)
    saved = 0
    preview_count = 0
    logs: list[str] = [f"[backfill] user={user_id} since={since_iso} ids={total}"]

    for i in range(0, total, max(1, batch)):
        chunk = ids[i : i + batch]
        logs.append(f"[backfill] chunk {i//batch+1}: {len(chunk)} ids")

        res = preview_zones_for_activities(user_id, chunk, fetch_if_missing=fetch_if_missing)
        items = res.get("items") or []
        preview_count += len(items)

        if save and items:
            u = upsert_enrichment_minutes(user_id, items)
            saved += int(u.get("saved") or 0)

    return {
        "ok": True,
        "user_id": user_id,
        "since": since_iso,
        "found_ids": total,
        "previewed": preview_count,
        "saved": saved if save else 0,
        "saved_enabled": bool(save),
        "fetch_if_missing": bool(fetch_if_missing),
        "batch": batch,
        "logs": logs,
    }


def compute_and_save_enrichment_for_ids(user_id: int, ids: list[int]) -> dict:

    ids = [int(x) for x in ids if x]
    if not ids:
        return {"saved": 0, "items": []}

    # 1) cachni chýbajúce streamy
    missing: list[int] = []
    try:
        res = (
            sb.table(TABLE_ACTIVITIES_STREAMS)
            .select("activity_id")
            .in_("activity_id", ids)
            .execute()
        )
        have = {int(r["activity_id"]) for r in (res.data or [])}
        missing = [aid for aid in ids if aid not in have]
    except Exception as e:
        missing = ids[:]

    if missing:
        cache_streams_for_activities(user_id, missing)

    # 2) výpočet
    prev = preview_zones_for_activities(user_id, ids, fetch_if_missing=False)
    items = prev.get("items") or []

    # 3) uloženie
    saved = upsert_enrichment_minutes(user_id, items).get("saved", 0)
    return {"saved": int(saved), "count": len(ids)}