from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple, Iterable, Optional

from Routes_DB.activities_summary import (
    db_select_activities_window_basic,
)
from Services.users import require_jwt

from Routes_DB.activities_enrichment import (
    db_get_enrichment_for_activities,
)


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


def _row_easy_hard(
    row: Dict[str, Any],
    count_no_hr_as_easy: bool = True,
) -> Tuple[float, float]:
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


# ------------------------ data loaders ---------------------------


def _activity_ids_in_range(
    user_id: int,
    start_iso: str,
    end_iso: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> List[Tuple[int, str]]:
    """
    Vytiahne (activity_id, date) pre usera v okne [start_iso, end_iso] vrátane.

    Interné – opiera sa o DB helper z activities_summary.
    """
    rows = db_select_activities_window_basic(
        user_id=user_id,
        date_from=start_iso,
        date_to=end_iso,
        user_jwt=user_jwt,
        service=service,
        sports=None,  # všetky športy, filtruje až FE
    )

    out: List[Tuple[int, str]] = []
    for row in rows or []:
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
    service: bool = False,
) -> List[Dict[str, Any]]:
    """
    Načíta enrichment pre daného usera a dané activity_ids cez DB helper.
    """
    if not ids:
        return []

    return db_get_enrichment_for_activities(
        user_id=user_id,
        activity_ids=ids,
        user_jwt=user_jwt,
        service=service,
    )


# -------------------------- public API ---------------------------


def get_pareto_source(
    user_id: int,
    months: int = 3,
    count_no_hr_as_easy: bool = True,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Kompletný výstrel dát za posledné `months` mesiacov (SUMMARY + ENRICHMENT),
    vrátane easy/hard/total. FE si to drží v SESSION a filtruje lokálne.

    Režimy:
      - service=False → RLS (vyžaduje JWT, require_jwt)
      - service=True  → service klient (user_jwt sa len forwarduje, môže byť None)
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    months = max(1, int(months))
    start_dt = datetime.now(timezone.utc) - timedelta(days=months * 31)
    start_iso = start_dt.strftime("%Y-%m-%d")
    end_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1) nájdeme aktivity v rozsahu (id + dátum)
    id_rows = _activity_ids_in_range(
        user_id=user_id,
        start_iso=start_iso,
        end_iso=end_iso,
        user_jwt=jwt,
        service=service,
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

    # 2) enrichment (zóny + pomocné polia) z activities_enrichment
    enr = _load_enrichment_for_ids(
        user_id=user_id,
        ids=ids,
        user_jwt=jwt,
        service=service,
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

    # 3) doplň aktivity bez enrichmentu (aby FE videlo "dierky")
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

    return {"success": True, "data": out, "months": months}