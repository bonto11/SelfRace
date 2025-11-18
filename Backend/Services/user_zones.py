# Services/user_zones.py
from typing import Optional, Dict, Any
from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_ZONES

sb = get_client()


def _num(v: Any) -> Optional[int]:
    """Prevedie hodnotu na int alebo vráti None."""
    try:
        if v is None:
            return None
        return int(round(float(v)))
    except Exception:
        return None


def load_user_zones(user_id: int) -> Optional[Dict[str, Optional[int]]]:
    """
    Zoberie najnovší záznam z users_zones (podľa created_at)
    a vráti ho v tvare z1_min..z5_max pre FE.

    Pozor: v tabuľke nemáš stĺpce pre z1_min_bpm a z5_max_bpm,
    takže:
      - z1_min vraciame ako 0 (resp. podľa logiky nižšie)
      - z5_max vraciame ako hr_max_bpm (ak existuje).
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

    hr_max = (
        _num(row.get("hr_max_bpm"))
        or _num(row.get("HR_max_bpm"))
        or _num(row.get("HR_max"))
    )

    # v DB máš len max zóny + min od Z2 vyššie
    z1_min = None  # v DB nie je, dopočítame nižšie
    z1_max = _num(row.get("z1_max_bpm"))

    z2_min = _num(row.get("z2_min_bpm"))
    z2_max = _num(row.get("z2_max_bpm"))

    z3_min = _num(row.get("z3_min_bpm"))
    z3_max = _num(row.get("z3_max_bpm"))

    z4_min = _num(row.get("z4_min_bpm"))
    z4_max = _num(row.get("z4_max_bpm"))

    z5_min = _num(row.get("z5_min_bpm"))
    z5_max = None  # v DB nie je, dopočítame nižšie

    # doplnenie chýbajúcich hraníc (reťazovo) – iba pre čítanie
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

    return {
        "z1_min": z1_min,
        "z1_max": z1_max,
        "z2_min": z2_min,
        "z2_max": z2_max,
        "z3_min": z3_min,
        "z3_max": z3_max,
        "z4_min": z4_min,
        "z4_max": z4_max,
        "z5_min": z5_min,
        "z5_max": z5_max,
        "hr_max": hr_max,
    }


def _normalize_zones_for_insert(user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Čisté mapovanie FE -> DB.

    - ŽIADNE validácie, žiadne dopĺňanie zón.
    - Len pretypovanie na int + fallback pre hr_max_bpm.
    - Ak FE pošle None pre NOT NULL stĺpce, zlyhá to na úrovni DB
      (čo je v poriadku – FE to má ošetriť).
    """
    # HRmax – vezmeme čo FE pošle, prípadne fallback zo z5_max
    hr_max = (
        _num(payload.get("hr_max"))
        or _num(payload.get("hr_max_bpm"))
        or _num(payload.get("HRmax"))
        or _num(payload.get("z5_max"))
    )

    row = {
        "user_id": user_id,
        "sport": payload.get("sport") or "Run",
        "hr_max_bpm": hr_max,

        # v tabuľke máš len tieto zónové stĺpce
        "z1_max_bpm": _num(payload.get("z1_max")),
        "z2_min_bpm": _num(payload.get("z2_min")),
        "z2_max_bpm": _num(payload.get("z2_max")),
        "z3_min_bpm": _num(payload.get("z3_min")),
        "z3_max_bpm": _num(payload.get("z3_max")),
        "z4_min_bpm": _num(payload.get("z4_min")),
        "z4_max_bpm": _num(payload.get("z4_max")),
        "z5_min_bpm": _num(payload.get("z5_min")),
        # z5_max_bpm stĺpec v DB nemáš – horná hranica Z5 sa berie z hr_max_bpm
    }

    print("\n=== [BE] _normalize_zones_for_insert() ===")
    print("payload:", payload)
    print("row    :", row)
    print("=========================================\n")

    return row


def save_user_zones(user_id: int, payload: Dict[str, Any]) -> bool:
    """
    Uloží nový záznam do users_zones.
    FE je zodpovedné za to, aby neposielalo None do NOT NULL stĺpcov.
    """
    row = _normalize_zones_for_insert(user_id, payload or {})

    print("\n=== [BE] INSERTING users_zones ===")
    print(row)
    print("==================================\n")

    sb.table(TABLE_USERS_ZONES).insert(row).execute()
    return True