# Services/user_zones.py
from typing import Optional, Dict, Any, TypedDict, Literal
from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_ZONES

sb = get_client()

Sport = Literal["running", "cycling", "other"]

class ZonesOut(TypedDict, total=False):
    sport: Sport
    hr_max: Optional[int]
    z1_min: Optional[int]; z1_max: Optional[int]
    z2_min: Optional[int]; z2_max: Optional[int]
    z3_min: Optional[int]; z3_max: Optional[int]
    z4_min: Optional[int]; z4_max: Optional[int]
    z5_min: Optional[int]; z5_max: Optional[int]
    created_at: Optional[str]

def _num(v: Any) -> Optional[int]:
    try:
        return None if v is None else int(round(float(v)))
    except Exception:
        return None

def _canon_sport(s: Optional[str]) -> Sport:
    if not s: return "running"
    x = s.strip().lower()
    if x in {"run", "running"}: return "running"
    if x in {"ride", "bike", "cycling"}: return "cycling"
    return "other"

def _normalize_out(row: Dict[str, Any]) -> ZonesOut:
    """DB -> FE; reťazovo dopočíta chýbajúce hranice, Z5max = HRmax."""
    hr_max = (
        _num(row.get("hr_max_bpm"))
        or _num(row.get("HR_max_bpm"))
        or _num(row.get("HR_max"))
    )

    z1_max = _num(row.get("z1_max_bpm"))
    z2_min = _num(row.get("z2_min_bpm")); z2_max = _num(row.get("z2_max_bpm"))
    z3_min = _num(row.get("z3_min_bpm")); z3_max = _num(row.get("z3_max_bpm"))
    z4_min = _num(row.get("z4_min_bpm")); z4_max = _num(row.get("z4_max_bpm"))
    z5_min = _num(row.get("z5_min_bpm"))

    z1_min = 0
    if z2_min is None and z1_max is not None: z2_min = z1_max + 1
    if z3_min is None and z2_max is not None: z3_min = z2_max + 1
    if z4_min is None and z3_max is not None: z4_min = z3_max + 1
    if z5_min is None and z4_max is not None: z5_min = z4_max + 1
    z5_max = hr_max

    return {
        "sport": _canon_sport(row.get("sport")),
        "hr_max": hr_max,
        "z1_min": z1_min, "z1_max": z1_max,
        "z2_min": z2_min, "z2_max": z2_max,
        "z3_min": z3_min, "z3_max": z3_max,
        "z4_min": z4_min, "z4_max": z4_max,
        "z5_min": z5_min, "z5_max": z5_max,
        "created_at": row.get("created_at"),
    }

def load_user_zones_latest(user_id: int, sport: Optional[str] = None) -> Optional[ZonesOut]:
    q = (
        sb.table(TABLE_USERS_ZONES)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
    )
    if sport:
        q = q.ilike("sport", _canon_sport(sport))
    res = q.limit(1).execute()
    row = (res.data or [None])[0]
    return _normalize_out(row) if row else None

def load_user_zones_all_latest(user_id: int) -> Dict[str, ZonesOut]:
    res = (
        sb.table(TABLE_USERS_ZONES)
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    out: Dict[str, ZonesOut] = {}
    for r in (res.data or []):
        s = _canon_sport(r.get("sport"))
        if s not in out:         # vďaka order DESC prvý je najnovší
            out[s] = _normalize_out(r)
    return out

def _normalize_insert(user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    hr_max = _num(payload.get("hr_max")) or _num(payload.get("hr_max_bpm")) or _num(payload.get("z5_max"))
    return {
        "user_id": user_id,
        "sport": _canon_sport(payload.get("sport")),
        "hr_max_bpm": hr_max,
        "z1_max_bpm": _num(payload.get("z1_max")),
        "z2_min_bpm": _num(payload.get("z2_min")), "z2_max_bpm": _num(payload.get("z2_max")),
        "z3_min_bpm": _num(payload.get("z3_min")), "z3_max_bpm": _num(payload.get("z3_max")),
        "z4_min_bpm": _num(payload.get("z4_min")), "z4_max_bpm": _num(payload.get("z4_max")),
        "z5_min_bpm": _num(payload.get("z5_min")),
    }

def save_user_zones(user_id: int, payload: Dict[str, Any]) -> ZonesOut:
    row = _normalize_insert(user_id, payload or {})
    sb.table(TABLE_USERS_ZONES).insert(row).execute()
    return load_user_zones_latest(user_id, row["sport"]) or {"sport": row["sport"]}