from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple, Iterable, DefaultDict
from collections import defaultdict

from Modules.SQL.db_handler import get_client
from Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,      # "activities_summary"
    TABLE_ACTIVITIES_ENRICHMENT,   # "activities_enrichment"
)

sb = get_client()


# ---------------------------- helpers ----------------------------

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
            .select("activity_id,z1_min,z2_min,z3_min,z4_min,z5_min")
            .eq("user_id", user_id)
            .in_("activity_id", chunk)
            .execute()
        )
        out.extend(r.data or [])
    return out


# -------------------------- public API ---------------------------

def get_pareto_widget(user_id: int, days: int = 14) -> Dict[str, Any]:
    """
    Agregácia za posledných `days` dní → easy/hard minúty.
    """
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=max(1, int(days)))).strftime("%Y-%m-%d")
    end   = now.strftime("%Y-%m-%d")

    id_rows = _activity_ids_in_range(user_id, start, end)
    ids = [aid for (aid, _) in id_rows]
    if not ids:
        return {"success": True, "data": {"easy_min": 0, "hard_min": 0, "total_min": 0, "days": days}}

    enr = _load_enrichment_for_ids(user_id, ids)
    easy, hard = _sum_enrichment_rows(enr)
    total = easy + hard
    return {
        "success": True,
        "data": {
            "easy_min": round(easy),
            "hard_min": round(hard),
            "total_min": round(total),
            "days": days,
        },
    }

def get_pareto_trend(user_id: int, months: int = 6) -> Dict[str, Any]:
    """
    Mesačný trend za `months` mesiacov dozadu (vrátane bežiaceho mesiaca).
    Výstup: [{label:'YYYY-MM', easy_min, hard_min}, ...] vzostupne podľa mesiaca.
    """
    months = max(1, int(months))
    # začiatok = dnes - months*30 (hrubý odhad), aby sme mali buffer cez hranice mesiacov
    start_dt = datetime.now(timezone.utc) - timedelta(days=months * 31)
    start_iso = start_dt.strftime("%Y-%m-%d")
    end_iso   = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    id_rows = _activity_ids_in_range(user_id, start_iso, end_iso)
    if not id_rows:
        return {"success": True, "data": []}

    # map: activity_id -> month label
    aid_to_month: Dict[int, str] = {}
    months_set: set[str] = set()
    for aid, d in id_rows:
        lab = _ym(d)
        aid_to_month[int(aid)] = lab
        months_set.add(lab)

    enr = _load_enrichment_for_ids(user_id, list(aid_to_month.keys()))

    # agregácia do mesiacov
    agg: DefaultDict[str, Dict[str, float]] = defaultdict(lambda: {"easy": 0.0, "hard": 0.0})
    for r in enr:
        aid_val = r.get("activity_id")
        if aid_val is None:
            continue
        try:
            aid = int(aid_val)
        except Exception:
            continue
        lab = aid_to_month.get(aid)
        if not lab:
            continue
        z1 = _to_num(r.get("z1_min"))
        z2 = _to_num(r.get("z2_min"))
        z3 = _to_num(r.get("z3_min"))
        z4 = _to_num(r.get("z4_min"))
        z5 = _to_num(r.get("z5_min"))
        agg[lab]["easy"] += (z1 + z2)
        agg[lab]["hard"] += (z3 + z4 + z5)

    # zoradenie kľúčov mesiacov
    labels_sorted = sorted(list(months_set))
    # zober posledných `months` položiek (ak by buffer vyprodukoval viac)
    labels_sorted = labels_sorted[-months:]

    data = [
        {
            "label": lab,
            "easy_min": round(agg[lab]["easy"]),
            "hard_min": round(agg[lab]["hard"]),
        }
        for lab in labels_sorted
    ]
    return {"success": True, "data": data}