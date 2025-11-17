# Services/user_zones.py
# Services/user_zones.py
from typing import Optional, Dict, Any
from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_ZONES

sb = get_client()


def _num(v: Any) -> Optional[int]:
  try:
    if v is None:
      return None
    return int(round(float(v)))
  except Exception:
    return None


def _safe(v: Optional[int], default_val: int) -> int:
  return v if isinstance(v, int) else default_val


def load_user_zones(user_id: int) -> Optional[Dict[str, int]]:
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

  # doplnenie chýbajúcich hraníc (reťazovo)
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
      z5_max if z5_max is not None else (hr_max or 200),
      (hr_max or 200),
    ),
  }


def _normalize_zones_for_insert(user_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """FE → DB mapping 1:1. Žiadne prepísanie hodnot defaultami."""

    def N(v):
        try:
            return int(float(v)) if v is not None else None
        except:
            return None

    # Priamo premapujeme FE -> DB
    return {
        "user_id": user_id,
        "sport": payload.get("sport") or "run",

        "hr_max_bpm": N(payload.get("hr_max") or payload.get("hr_max_bpm")),

        # zóny
        "z1_min_bpm": N(payload.get("z1_min")),
        "z1_max_bpm": N(payload.get("z1_max")),

        "z2_min_bpm": N(payload.get("z2_min")),
        "z2_max_bpm": N(payload.get("z2_max")),

        "z3_min_bpm": N(payload.get("z3_min")),
        "z3_max_bpm": N(payload.get("z3_max")),

        "z4_min_bpm": N(payload.get("z4_min")),
        "z4_max_bpm": N(payload.get("z4_max")),

        "z5_min_bpm": N(payload.get("z5_min")),
        # ak FE pošle z5_max → uložíme, ak nie → hrmax
        "z5_max_bpm": N(payload.get("z5_max")) or N(payload.get("hr_max")),
    }


def save_user_zones(user_id: int, payload: Dict[str, Any]) -> bool:
    print("\n\n=== [BE] SAVE ZONES PAYLOAD ===")
    print(payload)
    row = _normalize_zones_for_insert(user_id, payload)
    print("=== [BE] FINAL ROW TO INSERT ===")
    print(row)
    print("================================\n")

    sb.table(TABLE_USERS_ZONES).insert(row).execute()
    return True