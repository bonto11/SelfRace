from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple, Iterable, DefaultDict, Optional, cast
from collections import defaultdict

from Modules.SQL.db_handler import get_client
from Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,      # "activities_summary"
    TABLE_ACTIVITIES_ENRICHMENT,   # "activities_enrichment"
)

sb = get_client()


# ---------------------------- helpers ----------------------------
def _as_int(x: Any) -> Optional[int]:
    try:
        if x is None or x == "":
            return None
        return int(round(float(x)))
    except Exception:
        return None

def _as_str(x: Any) -> Optional[str]:
    if x is None:
        return None
    s = str(x)
    return s

def _as_float(x: Any) -> Optional[float]:
    try:
        if x is None or x == "":
            return None
        return float(x)
    except Exception:
        return None
def _to_num(x: Any) -> float:
    try:
        return float(x)
    except Exception:
        return 0.0

def _ym(dt_s: str) -> str:
    # "2025-10-21T09:00:00+00:00" | "2025-10-21 09:00:00+00" → "2025-10"
    s = str(dt_s or "")
    if "T" in s:
        s = s.replace("T", " ")
    return s[:7] if len(s) >= 7 else s

def _chunked(seq: Iterable[Any], n: int = 1000) -> Iterable[List[Any]]:
    buf: List[Any] = []
    for x in seq:
        buf.append(x)
        if len(buf) >= n:
            yield buf
            buf = []
    if buf:
        yield buf

def _sum_enrichment_rows(rows: List[Dict[str, Any]]) -> Tuple[float, float]:
    easy = hard = 0.0
    for r in rows:
        z1 = _to_num(r.get("z1_min"))
        z2 = _to_num(r.get("z2_min"))
        z3 = _to_num(r.get("z3_min"))
        z4 = _to_num(r.get("z4_min"))
        z5 = _to_num(r.get("z5_min"))
        easy += (z1 + z2)
        hard += (z3 + z4 + z5)
    return easy, hard

def _row_easy_hard(row: Dict[str, Any], count_no_hr_as_easy: bool = True) -> Tuple[float, float]:
    """
    Vráti (easy_min, hard_min) podľa zón. Ak nie sú žiadne minúty v Z1..Z5 a je povolený
    fallback, prirátame easy = moving_time_s / 60 (tj. aktivita bez HR ide do easy).
    """
    z1 = _to_num(row.get("z1_min"))
    z2 = _to_num(row.get("z2_min"))
    z3 = _to_num(row.get("z3_min"))
    z4 = _to_num(row.get("z4_min"))
    z5 = _to_num(row.get("z5_min"))

    easy = z1 + z2
    hard = z3 + z4 + z5

    if (easy + hard) == 0 and count_no_hr_as_easy:
        mt_min = _to_num(row.get("moving_time_s")) / 60.0
        if mt_min > 0:
            easy = mt_min
    return easy, hard


# ------------------------ data loaders ---------------------------

def _activity_ids_in_range(user_id: int, start_iso: str, end_iso: str) -> List[Tuple[int, str]]:
    """
    Vráti [(activity_id, date_iso)] v zadanom intervale podľa activities_summary.
    """
    res = (
        sb.table(TABLE_ACTIVITIES_SUMMARY)
        .select("activity_id,date")
        .eq("user_id", user_id)
        .gte("date", start_iso)
        .lte("date", end_iso)
        .order("date", desc=True)
        .execute()
    )
    out: List[Tuple[int, str]] = []
    for row in res.data or []:
        aid = row.get("activity_id")
        dt  = row.get("date")
        if aid is not None and dt is not None:
            try:
                out.append((int(aid), str(dt)))
            except Exception:
                pass
    return out

def _load_enrichment_for_ids(user_id: int, ids: List[int]) -> List[Dict[str, Any]]:
    """
    Načíta enrichment riadky pre dané activity_id (môže byť 0..N).
    """
    out: List[Dict[str, Any]] = []
    for chunk in _chunked(ids, 1000):
        r = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
            .select("activity_id,z1_min,z2_min,z3_min,z4_min,z5_min,"
                    "sport_type_fe,avg_hr_bpm,moving_time_s,distance_m")
            .eq("user_id", user_id)
            .in_("activity_id", chunk)
            .execute()
        )
        out.extend(r.data or [])
    return out


# -------------------------- public API ---------------------------

def get_pareto_source(
    user_id: int,
    months: int = 3,
    count_no_hr_as_easy: bool = True
) -> Dict[str, Any]:
    """
    Vráti kompletný zoznam aktivít za posledné `months` mesiacov s dátami z enrichmentu
    + dopočítané easy/hard/total. FE si to uloží do SESSION a filtruje lokálne.
    """
    months = max(1, int(months))
    start_dt = datetime.now(timezone.utc) - timedelta(days=months * 31)
    start_iso = start_dt.strftime("%Y-%m-%d")
    end_iso   = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1) ids + date (zo summary)
    id_rows = _activity_ids_in_range(user_id, start_iso, end_iso)
    if not id_rows:
        return {"success": True, "data": [], "months": months}

    # bezpečne poskladať mapu id->date
    aid_to_date: Dict[int, str] = {}
    for aid_raw, date_raw in id_rows:
        aid = _as_int(aid_raw)
        ds  = _as_str(date_raw)
        if aid is not None and ds:
            aid_to_date[aid] = ds

    ids: List[int] = list(aid_to_date.keys())
    if not ids:
        return {"success": True, "data": [], "months": months}

    # 2) enrichment pre všetky id
    enr = _load_enrichment_for_ids(user_id, ids)

    # 3) poskladaj výstup
    out: List[Dict[str, Any]] = []
    seen_ids: set[int] = set()

    for r in enr:
        aid = _as_int(r.get("activity_id"))
        if aid is None:
            continue
        seen_ids.add(aid)
        date_s = aid_to_date.get(aid)

        easy, hard = _row_easy_hard(r, count_no_hr_as_easy)
        out.append({
            "activity_id": aid,
            "date": date_s,
            "sport_type_fe": r.get("sport_type_fe"),
            "moving_time_s": _as_int(r.get("moving_time_s")),
            "avg_hr_bpm": _as_int(r.get("avg_hr_bpm")),
            "distance_m": _as_float(r.get("distance_m")),
            "z1_min": _as_float(r.get("z1_min")),
            "z2_min": _as_float(r.get("z2_min")),
            "z3_min": _as_float(r.get("z3_min")),
            "z4_min": _as_float(r.get("z4_min")),
            "z5_min": _as_float(r.get("z5_min")),
            "easy_min": float(easy),
            "hard_min": float(hard),
            "total_min": float(easy + hard),
        })

    # doplň aktivity, ktoré nemajú enrichment
    for aid_raw, date_raw in id_rows:
        aid = _as_int(aid_raw)
        if aid is None or aid in seen_ids:
            continue
        out.append({
            "activity_id": aid,
            "date": _as_str(date_raw),
            "sport_type_fe": None,
            "moving_time_s": None,
            "avg_hr_bpm": None,
            "distance_m": None,
            "z1_min": None, "z2_min": None, "z3_min": None, "z4_min": None, "z5_min": None,
            "easy_min": 0.0, "hard_min": 0.0, "total_min": 0.0,
        })

    # zoradené zostupne podľa dátumu
    out.sort(key=lambda x: str(x.get("date") or ""), reverse=True)
    return {"success": True, "data": out, "months": months}