from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple, Iterable, Optional

from fastapi import HTTPException

from Modules.SQL.db_handler import get_client
from Configs.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_ENRICHMENT,
)
from Configs.config_sport import DEBUG_PARETO


# ---------------------------- helpers ----------------------------
def _log(*a):
    if DEBUG_PARETO:
        print("[PARETO:SOURCE]", *a)


def _require_jwt(user_jwt: Optional[str]) -> str:
    """
    Pareto zdroj chceme ťahať striktne pod user JWT (RLS).
    """
    if not user_jwt:
        raise HTTPException(status_code=401, detail="Missing Authorization JWT")
    return user_jwt


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
    return str(x)


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


def _chunked(seq: Iterable[Any], n: int = 1000) -> Iterable[List[Any]]:
    buf: List[Any] = []
    for x in seq:
        buf.append(x)
        if len(buf) >= n:
            yield buf
            buf = []
    if buf:
        yield buf


def _row_easy_hard(row: Dict[str, Any], count_no_hr_as_easy: bool = True) -> Tuple[float, float]:
    """
    Easy = Z1+Z2, Hard = Z3+Z4+Z5. Ak zóny chýbajú a je povolené count_no_hr_as_easy,
    prirátame easy = moving_time_s/60.
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


def _get_client_for_user(user_jwt: Optional[str] = None):
    """
    Vráti Supabase client.
    - ak príde user_jwt → použije sa RLS klient via JWT
    - fallback len na rozdielnu signatúru get_client(), nie na anonymný prístup
    """
    try:
        return get_client(user_jwt=user_jwt)
    except TypeError:
        # fallback ak máš ešte staršiu signatúru get_client()
        return get_client()


# ------------------------ data loaders ---------------------------
def _activity_ids_in_range(
    user_id: int,
    start_iso: str,
    end_iso: str,
    *,
    user_jwt: Optional[str] = None,
) -> List[Tuple[int, str]]:
    sb = _get_client_for_user(user_jwt=user_jwt)
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
        dt = row.get("date")
        if aid is not None and dt is not None:
            try:
                out.append((int(aid), str(dt)))
            except Exception:
                pass
    return out


def _load_enrichment_for_ids(
    user_id: int,
    ids: List[int],
    *,
    user_jwt: Optional[str] = None,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not ids:
        return out

    sb = _get_client_for_user(user_jwt=user_jwt)

    for chunk in _chunked(ids, 1000):
        r = (
            sb.table(TABLE_ACTIVITIES_ENRICHMENT)
            .select(
                "activity_id,z1_min,z2_min,z3_min,z4_min,z5_min,"
                "sport_type_fe,avg_hr_bpm,moving_time_s,distance_m"
            )
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
    count_no_hr_as_easy: bool = True,
    *,
    user_jwt: str,
) -> Dict[str, Any]:
    """
    Kompletný výstrel dát za posledné `months` mesiacov (SUMMARY + ENRICHMENT),
    vrátane easy/hard/total. FE si to drží v SESSION a filtruje lokálne.

    Musí prísť user_jwt – všetky dotazy cez RLS klienta.
    """
    jwt = _require_jwt(user_jwt)

    months = max(1, int(months))
    start_dt = datetime.now(timezone.utc) - timedelta(days=months * 31)
    start_iso = start_dt.strftime("%Y-%m-%d")
    end_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    id_rows = _activity_ids_in_range(
        user_id=user_id,
        start_iso=start_iso,
        end_iso=end_iso,
        user_jwt=jwt,
    )
    if not id_rows:
        return {"success": True, "data": [], "months": months}

    aid_to_date: Dict[int, str] = {}
    for aid_raw, date_raw in id_rows:
        aid = _as_int(aid_raw)
        ds = _as_str(date_raw)
        if aid is not None and ds:
            aid_to_date[aid] = ds

    ids: List[int] = list(aid_to_date.keys())
    if not ids:
        return {"success": True, "data": [], "months": months}

    enr = _load_enrichment_for_ids(
        user_id=user_id,
        ids=ids,
        user_jwt=jwt,
    )

    out: List[Dict[str, Any]] = []
    seen_ids: set[int] = set()

    for r in enr:
        aid = _as_int(r.get("activity_id"))
        if aid is None:
            continue
        seen_ids.add(aid)
        easy, hard = _row_easy_hard(r, count_no_hr_as_easy)
        out.append(
            {
                "activity_id": aid,
                "date": aid_to_date.get(aid),
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
            }
        )

    # doplň aktivity bez enrichmentu
    for aid_raw, date_raw in id_rows:
        aid = _as_int(aid_raw)
        if aid is None or aid in seen_ids:
            continue
        out.append(
            {
                "activity_id": aid,
                "date": _as_str(date_raw),
                "sport_type_fe": None,
                "moving_time_s": None,
                "avg_hr_bpm": None,
                "distance_m": None,
                "z1_min": None,
                "z2_min": None,
                "z3_min": None,
                "z4_min": None,
                "z5_min": None,
                "easy_min": 0.0,
                "hard_min": 0.0,
                "total_min": 0.0,
            }
        )

    out.sort(key=lambda x: str(x.get("date") or ""), reverse=True)

    _log("SOURCE built", {"user": user_id, "months": months, "rows": len(out)})
    return {"success": True, "data": out, "months": months}