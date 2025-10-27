# Modules/Services/compute_zones.py
from __future__ import annotations
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta, timezone
from Modules.SQL.db_handler import get_client
from Modules.config import (
    TABLE_USERS_ZONES,
    TABLE_ACTIVITIES_STREAMS,
    TABLE_ACTIVITIES_ENRICHMENT,
    TABLE_USERS,
    TABLE_ACTIVITIES_SUMMARY,
)

from Modules.API.Strava.streams import fetch_and_optionally_store_batch, cache_streams_for_activities

sb = get_client()

# Services/activity_zones.py
from typing import Any, Dict, List, Optional, cast
from datetime import datetime, timedelta, timezone

from Modules.SQL.db_handler import get_client
from Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_ENRICHMENT,
    TABLE_USERS,  # ← máme v DB
)

sb = get_client()


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
    """Bezpečne pretypuje resp.data na list[dict]."""
    return cast(List[Dict[str, Any]], resp.data or [])


def _iso_utc_months_ago(months: int) -> str:
    now = datetime.now(timezone.utc)
    dt = now - timedelta(days=30 * max(1, months))
    return dt.strftime("%Y-%m-%d")


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

def _to_int_min(x) -> int:
    try:
        return int(round(float(x)))
    except Exception:
        return 0

def _load_user_zones(user_id: int) -> Optional[Dict[str, int]]:
    """
    Zoberie najnovší záznam z users_zones (podľa created_at).
    Doplňuje chýbajúce hranice: Z1_min=0, Z5_max=HRmax, medzery reťazovo.
    """
    q = (
        sb.table(TABLE_USERS_ZONES)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    row = (q.data or [None])[0]
    if not row:
        return None

    def _num(v):
        try:
            if v is None:
                return None
            return int(round(float(v)))
        except Exception:
            return None

    hr_max = (
        _num(row.get("hr_max_bpm"))
        or _num(row.get("HR_max_bpm"))
        or _num(row.get("HR_max"))
    )

    z1_min = _num(row.get("z1_min_bpm"))
    z1_max = _num(row.get("z1_max_bpm"))
    z2_min = _num(row.get("z2_min_bpm"))
    z2_max = _num(row.get("z2_max_bpm"))
    z3_min = _num(row.get("z3_min_bpm"))
    z3_max = _num(row.get("z3_max_bpm"))
    z4_min = _num(row.get("z4_min_bpm"))
    z4_max = _num(row.get("z4_max_bpm"))
    z5_min = _num(row.get("z5_min_bpm"))
    z5_max = _num(row.get("z5_max_bpm"))

    if z1_min is None:
        z1_min = 0
    if z2_min is None and z1_max is not None:
        z2_min = z1_max + 1
    if z3_min is None and z2_max is not None:
        z3_min = z2_max + 1
    if z4_min is None and z3_max is not None:
        z4_min = z3_max + 1
    if z5_min is None and z4_max is not None:
        z5_min = z4_max + 1
    if z5_max is None and hr_max is not None:
        z5_max = hr_max

    def _safe(v, d):
        return v if isinstance(v, int) else d

    return {
        "z1_min": _safe(z1_min, 0),
        "z1_max": _safe(z1_max, 119),
        "z2_min": _safe(z2_min, 120),
        "z2_max": _safe(z2_max, 139),
        "z3_min": _safe(z3_min, 140),
        "z3_max": _safe(z3_max, 159),
        "z4_min": _safe(z4_min, 160),
        "z4_max": _safe(z4_max, 179),
        "z5_min": _safe(z5_min, 180),
        "z5_max": _safe(
            z5_max if z5_max is not None else (hr_max or 200), (hr_max or 200)
        ),
    }


# ---------- loader streamov (z DB) ----------
def _load_streams_row(user_id: int, activity_id: int) -> Optional[Dict[str, Any]]:
    r = (
        sb.table(TABLE_ACTIVITIES_STREAMS)
        .select("time_s, heartrate_bpm")
        .eq("user_id", user_id)
        .eq("activity_id", activity_id)
        .limit(1)
        .execute()
    )
    return (r.data or [None])[0]


# ---------- klasifikácia HR do zóny ----------
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


# ---------- ak chýbajú streamy, stiahni a ulož ----------
def _fetch_and_store_if_missing(user_id: int, activity_ids: List[int]) -> None:
    # použijeme tvoju hotovú batch funkciu (1 HTTP na aktivitu, ale jedným volaním)
    fetch_and_optionally_store_batch(user_id, activity_ids, store=True)


# ---------- výpočet minút v zónach z jedného záznamu ----------
def _compute_minutes_for_streams(stream_row: Dict[str, Any], Z: Dict[str, int]) -> dict | None:
    """
    Prepočíta minúty v zónach z cached streamov (arrays).
    Ak chýba HR alebo time, vráti None -> volajúci to vyhodnotí ako skip.
    """
    time_s = stream_row.get("time_s") or []
    hr     = stream_row.get("heartrate_bpm") or []

    if not time_s:
        print(f"[ZONES] compute skip: no time_s (activity_id={stream_row.get('activity_id')})")
        return None
    if not hr:
        print(f"[ZONES] compute skip: no heartrate (activity_id={stream_row.get('activity_id')})")
        return None

    n = len(time_s)
    buckets = {"z1": 0.0, "z2": 0.0, "z3": 0.0, "z4": 0.0, "z5": 0.0}

    for i in range(n):
        t0 = int(time_s[i] or 0)
        t1 = int(time_s[i + 1]) if i + 1 < n and time_s[i + 1] is not None else (t0 + 1)
        dur = max(0, t1 - t0)

        h = int(hr[i]) if i < len(hr) and hr[i] is not None else None
        if h is None:
            # HR sample chýba -> nepočítame do žiadnej zóny
            continue

        b = _zone_of(h, Z)  # "z1".."z5"
        buckets[b] += float(dur)

    return {
        "z1_min": round(buckets["z1"] / 60.0, 2),
        "z2_min": round(buckets["z2"] / 60.0, 2),
        "z3_min": round(buckets["z3"] / 60.0, 2),
        "z4_min": round(buckets["z4"] / 60.0, 2),
        "z5_min": round(buckets["z5"] / 60.0, 2),
    }

# ---------- Public API: pre viac aktivít vracia len PREVIEW ----------
def preview_zones_for_activities(
    user_id: int, activity_ids: List[int], fetch_if_missing: bool = True
) -> Dict[str, Any]:
    Z = _load_user_zones(user_id)
    if not Z:
        return {"ok": False, "error": "No zones for user", "items": []}

    # zisti, ktoré aktivity ešte nemajú streamy
    missing: List[int] = []
    for aid in activity_ids:
        row = _load_streams_row(user_id, int(aid))
        if not row or not (row.get("time_s") or []):
            missing.append(int(aid))

    if missing and fetch_if_missing:
        print(f"[ZONES] fetching streams for missing: {len(missing)} ids")
        _fetch_and_store_if_missing(user_id, missing)

    # finálny výpočet
    items = []
    have = 0
    for aid in activity_ids:
        row = _load_streams_row(user_id, int(aid))
        if not row or not (row.get("time_s") or []):
            items.append({"activity_id": int(aid), "ok": False, "reason": "no_streams"})
            continue

        mins = _compute_minutes_for_streams(row, Z)
        if mins is None:
            items.append({"activity_id": int(aid), "ok": False, "reason": "no_hr"})
            continue

        items.append({"activity_id": int(aid), "ok": True, "minutes": mins})
        have += 1

    print(f"[ZONES] preview: computed={have}/{len(activity_ids)}")
    return {"ok": True, "user_id": user_id, "zones": Z, "items": items}

def upsert_enrichment_minutes(user_id: int, items: list[dict]) -> dict:
    """
    Ukladá len položky s reálnymi 'minutes' a zapisuje computed_at.
    Používa RPC s dotiahnutím sport_type_fe a user_uid zo summary.
    """
    if not items:
        return {"saved": 0, "skipped": 0}

    saved = 0
    skipped = 0
    now_ts = datetime.now(timezone.utc).isoformat()

    for it in items:
        aid = it.get("activity_id")
        mins = (it.get("minutes") or {}) if it.get("ok") else None
        if not aid or not mins:
            skipped += 1
            continue

        params = {
            "p_user_id": int(user_id),
            "p_activity_id": int(aid),
            "p_z1": _to_int_min(mins.get("z1_min")),
            "p_z2": _to_int_min(mins.get("z2_min")),
            "p_z3": _to_int_min(mins.get("z3_min")),
            "p_z4": _to_int_min(mins.get("z4_min")),
            "p_z5": _to_int_min(mins.get("z5_min")),
            "p_computed_at": now_ts,
        }
        sb.rpc("upsert_enrichment_with_sport", params).execute()
        saved += 1

    return {"saved": saved, "skipped": skipped}

def backfill_enrichment_for_period(
    user_id: int,
    months: int = 3,
    fetch_if_missing: bool = True,
    save: bool = True,
    batch: int = 25,
) -> dict:
    """
    Prejde aktivity za posledných `months` mesiacov:
      - načíta activity_id zo summary
      - pre každú dávku:
          - doplní/cachne streamy (ak fetch_if_missing)
          - spočíta minúty v zónach
          - ak save=True → upsert do activities_enrichment
    """
    since_iso = _iso_utc_months_ago(months)
    ids = _load_activity_ids_since(user_id, since_iso)

    total = len(ids)
    saved = 0
    preview_count = 0
    logs: list[str] = [f"[backfill] user={user_id} since={since_iso} ids={total}"]

    for i in range(0, total, max(1, batch)):
        chunk = ids[i : i + batch]
        logs.append(f"[backfill] chunk {i//batch+1}: {len(chunk)} ids")

        # spočítaj (a prípadne dotiahni streamy)
        res = preview_zones_for_activities(
            user_id, chunk, fetch_if_missing=fetch_if_missing
        )
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
    """
    Pre dané activity_id:
      - ak chýbajú streams v DB, stiahne a uloží (arrays)
      - spočíta minúty v zónach
      - upsertne do activities_enrichment
    """
    ids = [int(x) for x in ids if x]
    if not ids:
        return {"saved": 0, "items": []}

    # 1) uisti sa, že streams v DB sú – ak nie, dotiahni
    missing: list[int] = []
    try:
        # zistíme, ktoré activity_id NEMAJÚ záznam v streams
        res = (
            sb.table(TABLE_ACTIVITIES_STREAMS)
            .select("activity_id")
            .in_("activity_id", ids)
            .execute()
        )
        have = {int(r["activity_id"]) for r in (res.data or [])}
        missing = [aid for aid in ids if aid not in have]
    except Exception:
        # ak čokoľvek zlyhá, skúsiť všetky
        missing = ids[:]

    if missing:
        cache_streams_for_activities(user_id, missing)

    # 2) preview (počíta minúty) nad DB streams
    prev = preview_zones_for_activities(user_id, ids, fetch_if_missing=False)
    items = prev.get("items") or []

    # 3) ulož enrichment
    saved = upsert_enrichment_minutes(user_id, items).get("saved", 0)

    return {"saved": int(saved), "count": len(ids)}

