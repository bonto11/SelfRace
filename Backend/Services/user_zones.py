from __future__ import annotations

from typing import Any, Dict, List, Optional
from Routes_DB.user_zones import (
    db_user_zones_fetch_all,
    db_user_zones_fetch_latest,
    db_user_zones_insert_row,
)
from Schemas.user_zones import ZonesOut, Sport
from Modules.Supabase.auth import AuthCtx


# ------------ helpers ------------
def _num(v: Any) -> Optional[int]:
    try:
        return None if v is None else int(round(float(v)))
    except Exception:
        return None


def _canon_sport(s: Optional[str]) -> Sport:
    if not s:
        return "other"
    x = str(s).strip().lower()
    if x in {"run", "running"}:
        return "running"
    if x in {"ride", "bike", "cycling"}:
        return "cycling"
    return "other"


def _normalize_out(row: Dict[str, Any]) -> ZonesOut:
    """
    Normalizuje raw DB row (hr_max_bpm, z2_min_bpm, ...) na jednotný ZonesOut.
    Doplňuje chýbajúce spodné hranice z predchádzajúcej zóny.
    """
    hr_max = (
        _num(row.get("hr_max_bpm"))
        or _num(row.get("HR_max_bpm"))
        or _num(row.get("HR_max"))
    )

    z1_max = _num(row.get("z1_max_bpm"))
    z2_min = _num(row.get("z2_min_bpm"))
    z2_max = _num(row.get("z2_max_bpm"))
    z3_min = _num(row.get("z3_min_bpm"))
    z3_max = _num(row.get("z3_max_bpm"))
    z4_min = _num(row.get("z4_min_bpm"))
    z4_max = _num(row.get("z4_max_bpm"))
    z5_min = _num(row.get("z5_min_bpm"))

    # dopĺňame spodné hranice, ak chýbajú
    z1_min = 0
    if z2_min is None and z1_max is not None:
        z2_min = z1_max + 1
    if z3_min is None and z2_max is not None:
        z3_min = z2_max + 1
    if z4_min is None and z3_max is not None:
        z4_min = z3_max + 1
    if z5_min is None and z4_max is not None:
        z5_min = z4_max + 1
    z5_max = hr_max

    return {
        "sport": _canon_sport(row.get("sport")),
        "hr_max": hr_max,
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
        "created_at": row.get("created_at"),
    }


def _normalize_insert(user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Z payloadu z FE/AI vyrobí DB row so stĺpcami:
      user_id, sport, hr_max_bpm, z1_max_bpm, z2_min_bpm, ...
    """
    hr_max = (
        _num(payload.get("hr_max"))
        or _num(payload.get("hr_max_bpm"))
        or _num(payload.get("z5_max"))
    )

    return {
        "user_id": user_id,
        "sport": _canon_sport(payload.get("sport")),
        "hr_max_bpm": hr_max,
        "z1_max_bpm": _num(payload.get("z1_max")),
        "z2_min_bpm": _num(payload.get("z2_min")),
        "z2_max_bpm": _num(payload.get("z2_max")),
        "z3_min_bpm": _num(payload.get("z3_min")),
        "z3_max_bpm": _num(payload.get("z3_max")),
        "z4_min_bpm": _num(payload.get("z4_min")),
        "z4_max_bpm": _num(payload.get("z4_max")),
        "z5_min_bpm": _num(payload.get("z5_min")),
    }


# ------------ PUBLIC SERVICES: CRUD/LIST ------------


def service_load_user_zones(
    user_id: int,
    ctx: AuthCtx,
    sport: Optional[str] = None,
) -> Optional[ZonesOut]:
    """
    Najnovšie zóny pre daného usera (+voliteľne sport), normalizované na ZonesOut.

    Režimy:
      - service=False: RLS (require_jwt).
      - service=True: service klient.
    """

    sport_filter = _canon_sport(sport) if sport else None
    row = db_user_zones_fetch_latest(
        user_id,
        sport_filter,
        ctx=ctx,
    )
    return _normalize_out(row) if row else None


def service_load_user_zones_all_latest(
    user_id: int,
        ctx: AuthCtx,

) -> Dict[str, ZonesOut]:
    """
    Vráti dict { sport -> ZonesOut } – pre každý sport len najnovší záznam.
    """

    rows = db_user_zones_fetch_all(
        user_id,
        ctx=ctx,
    )
    out: Dict[str, ZonesOut] = {}
    for r in rows:
        s = _canon_sport(r.get("sport"))
        # prvý je najnovší (DESC order v DB vrstve)
        if s not in out:
            out[s] = _normalize_out(r)
    return out


def service_save_user_zones(
    user_id: int,
    payload: Dict[str, Any],
        ctx: AuthCtx,

) -> ZonesOut:
    """
    Uloží nové zóny pre usera a vráti normalizovaný posledný stav (ZonesOut).
    Vyžaduje user_jwt (RLS).
    """

    row = _normalize_insert(user_id, payload or {})
    db_user_zones_insert_row(
        row,
        ctx=ctx,
    )
    return service_load_user_zones(
        user_id=user_id,
        sport = row["sport"],
        ctx=ctx,
    ) or {
        "sport": row["sport"]
    }  # type: ignore[return-value]


def service_choose_best_zones(
    user_id: int,
    ctx: AuthCtx,
    preferred_sport: Optional[str] = None,

) -> Optional[ZonesOut]:
    """
    Heuristika: skús preferred_sport, potom running, potom hocičo.
    """
    z = service_load_user_zones(
        user_id=user_id,
        ctx=ctx,
        sport=preferred_sport,
    )
    if z:
        return z

    z = service_load_user_zones(
        user_id=user_id,
        ctx=ctx,
        sport="running",

    )
    if z:
        return z

    all_latest = service_load_user_zones_all_latest(
        user_id,
        ctx=ctx,
    )
    return next(iter(all_latest.values()), None)


def service_build_zones_block_for_analysis(
    user_id: int,
    ctx: AuthCtx,
    preferred_sport: Optional[str] = "running",

) -> Dict[str, Any]:
    """
    Vráti blok pre CoachAnalyzeInput["zones"].

    Aktuálne:
      - mapujeme “best” zóny do "run" vetvy
      - lthr_bpm nechávame None (LT2 pôjde z thresholds)

    Režimy:
      - service=False: RLS.
      - service=True: service klient.
    """
    best = service_choose_best_zones(
        user_id=user_id,
        preferred_sport=preferred_sport,
        ctx=ctx,
    )
    if not best:
        return {
            "run": {
                "lthr_bpm": None,
                "hr_max": None,
                "zones": [],
            }
        }

    zones_list: List[Dict[str, Any]] = []
    for name in ["Z1", "Z2", "Z3", "Z4", "Z5"]:
        key = name.lower()
        lo = best.get(f"{key}_min")
        hi = best.get(f"{key}_max")
        if lo is None and hi is None:
            continue
        zones_list.append(
            {
                "name": name,
                "hr_min": lo,
                "hr_max": hi,
            }
        )

    return {
        "run": {
            "lthr_bpm": None,
            "hr_max": best.get("hr_max"),
            "zones": zones_list,
        }
    }