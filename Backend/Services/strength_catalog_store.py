# Services/strength_catalog_store.py
"""
Katalóg silových cvikov z DB (tabuľka strength_exercises).

PREČO in-place: katalóg používa ~20 modulov cez `STRENGTH_EXERCISE_CATALOG`,
`CATALOG_BY_ID`, `get_exercise` (Configs/strength_catalog.py) a
`EXERCISE_MUSCLES` / `get_muscles` (Configs/strength_muscles.py). Store tie
isté objekty po načítaniu z DB naplní na mieste – moduly ostanú bez zmeny
a zmena z admin panelu sa prejaví bez deployu.

Kód je záloha: kým DB nie je dostupná alebo je tabuľka prázdna (pred
migráciou), platí katalóg z kódu. Načítanie beží v pamäti (refresh každých
REFRESH_S a hneď po zápise z admin panelu) – žiadny DB dotaz pri výbere cvikov.

Neaktívny cvik (active=false) sa nevyberá do plánov ani AI, ale CATALOG_BY_ID
a partie ho poznajú – staré zápisy a objem ho stále potrebujú.
"""

from __future__ import annotations

import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import Configs.strength_catalog as _cat
import Configs.strength_muscles as _mus
from DB.strength_exercises import db_list_strength_exercises, db_upsert_strength_exercise
from Modules.Supabase.auth import service_ctx

REFRESH_S = 300

# Záloha = stav z kódu pri štarte procesu (kópie, nie referencie)
_CODE_CATALOG: List[Dict[str, Any]] = [dict(e) for e in _cat.STRENGTH_EXERCISE_CATALOG]
_CODE_MUSCLES: Dict[str, Dict[str, float]] = {k: dict(v) for k, v in _mus.EXERCISE_MUSCLES.items()}

_LEVELS = ["low", "med", "high"]


def _values(key: str) -> List[str]:
    return sorted({str(e.get(key)) for e in _CODE_CATALOG if e.get(key) is not None})


def _list_values(key: str) -> List[str]:
    return sorted({str(x) for e in _CODE_CATALOG for x in (e.get(key) or [])})


# Povolené hodnoty polí – z katalógu v kóde (generátor a AI s nimi rátajú)
ENUMS: Dict[str, List[str]] = {
    "target": _values("target"),
    "pattern": _values("pattern"),
    "tier": ["primary", "secondary", "accessory", "prehab"],
    "load_type": _values("load_type"),
    "measure": ["reps", "time", "distance"],
    "load_mode": ["external", "bodyweight_plus"],
    "skill_demand": _LEVELS,
    "fatigue_cost": _LEVELS,
    "eccentric_load": _LEVELS,
    "equipment": _list_values("equipment"),
    "rep_suitability": _list_values("rep_suitability"),
    "sport_tags": _list_values("sport_tags"),
    "contraindications": _list_values("contraindications"),
    "muscles": list(_mus.MUSCLE_GROUPS),
    "categories": ["plyo", "iso"],
}

_lock = threading.Lock()
_state: Dict[str, Any] = {
    "loaded_at": 0.0,
    "source": "code",
    "version": "code",
    "rows": [],  # riadky z DB (pre FE a admin)
}
_thread_started = False


def _apply(rows: List[Dict[str, Any]]) -> None:
    """Riadky z DB → rovnaké objekty, ktoré čítajú ostatné moduly."""
    active: List[Dict[str, Any]] = []
    by_id: Dict[str, Dict[str, Any]] = {}
    muscles: Dict[str, Dict[str, float]] = {}
    for r in rows:
        ex_id = str(r.get("id") or "")
        if not ex_id:
            continue
        data = dict(r.get("data") or {})
        ex = {"id": ex_id, **data}
        ex.setdefault("name_en", (r.get("names") or {}).get("en") or ex_id)
        ex.setdefault("sport_tags", [])
        ex.setdefault("equipment", [])
        by_id[ex_id] = ex
        muscles[ex_id] = {str(k): float(v) for k, v in (r.get("muscles") or {}).items()}
        if r.get("active", True):
            active.append(ex)

    # PREČO na mieste: iné moduly majú tieto objekty naimportované menom
    _cat.STRENGTH_EXERCISE_CATALOG[:] = active
    _cat.CATALOG_BY_ID.clear()
    _cat.CATALOG_BY_ID.update(by_id)
    _cat.ALL_PATTERNS[:] = sorted({e.get("pattern") for e in active if e.get("pattern")})
    _cat.ALL_TARGETS[:] = sorted({e.get("target") for e in active if e.get("target")})
    _cat.ALL_SPORT_TAGS[:] = sorted({t for e in active for t in (e.get("sport_tags") or [])})
    _mus.EXERCISE_MUSCLES.clear()
    _mus.EXERCISE_MUSCLES.update(muscles)


def _version(rows: List[Dict[str, Any]]) -> str:
    last = max((str(r.get("updated_at") or "") for r in rows), default="")
    return f"{len(rows)}:{last}"


def refresh_strength_catalog(*, force: bool = False) -> None:
    """Načíta katalóg z DB. Chyba alebo prázdna tabuľka = ostáva doterajší (kód)."""
    with _lock:
        if not force and time.time() - _state["loaded_at"] < REFRESH_S:
            return
        _state["loaded_at"] = time.time()
    rows = db_list_strength_exercises(ctx=service_ctx("strength_catalog.refresh"))
    if not rows:
        # None = chyba DB, [] = migrácia ešte nebežala → platí kód
        return
    with _lock:
        _apply(rows)
        _state.update(source="db", version=_version(rows), rows=rows)


def _refresh_loop() -> None:
    while True:
        try:
            refresh_strength_catalog(force=True)
        except Exception as e:  # noqa: BLE001
            print(f"[STRENGTH-CATALOG] refresh failed: {repr(e)}")
        time.sleep(REFRESH_S)


def start_strength_catalog_refresh() -> None:
    """Spustí načítanie a pravidelný refresh na pozadí (raz za proces)."""
    global _thread_started
    with _lock:
        if _thread_started:
            return
        _thread_started = True
    threading.Thread(target=_refresh_loop, name="strength-catalog", daemon=True).start()


# ---------------------------------------------------------------------------
# PRE FE
# ---------------------------------------------------------------------------


def service_strength_catalog_for_fe(known_version: Optional[str]) -> Dict[str, Any]:
    """
    Katalóg pre FE. Rovnaká verzia = bez položiek (FE má svoje z localStorage).
    source=code = DB ešte nemá katalóg, FE ostane pri svojom zabudovanom.
    """
    refresh_strength_catalog()
    with _lock:
        version, source, rows = _state["version"], _state["source"], list(_state["rows"])
    if source != "db" or known_version == version:
        return {"version": version, "source": source, "items": None}
    items = []
    for r in rows:
        data = r.get("data") or {}
        items.append({
            "id": r.get("id"),
            "names": r.get("names") or {},
            "measure": data.get("measure") or "reps",
            "load_mode": data.get("load_mode") or "external",
            "muscles": r.get("muscles") or {},
            "categories": r.get("categories") or [],
            "active": bool(r.get("active", True)),
        })
    return {"version": version, "source": source, "items": items}


# ---------------------------------------------------------------------------
# ADMIN
# ---------------------------------------------------------------------------


def service_admin_list_exercises() -> Dict[str, Any]:
    """Celý katalóg pre admin panel (aj neaktívne) + povolené hodnoty polí."""
    rows = db_list_strength_exercises(ctx=service_ctx("strength_catalog.admin_list"))
    if rows is None:
        return {"ok": False, "code": "db_error"}
    return {"ok": True, "items": rows, "enums": ENUMS, "migrated": bool(rows)}


_ID_RE = re.compile(r"^[a-z][a-z0-9_]{1,59}$")


def _pick(v: Any, allowed: List[str], default: Optional[str] = None) -> Optional[str]:
    s = str(v or "").strip()
    return s if s in allowed else default


def _pick_list(v: Any, allowed: List[str]) -> List[str]:
    out: List[str] = []
    for x in v if isinstance(v, list) else []:
        s = str(x or "").strip()
        if s in allowed and s not in out:
            out.append(s)
    return out


def normalize_exercise_input(raw: Any) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Formulár z admin panelu / návrh AI → riadok tabuľky. (riadok, None) alebo (None, kód chyby)."""
    if not isinstance(raw, dict):
        return None, "invalid"
    ex_id = str(raw.get("id") or "").strip().lower()
    if not _ID_RE.match(ex_id):
        return None, "invalid_id"

    names_raw = raw.get("names") if isinstance(raw.get("names"), dict) else {}
    names = {k: str(names_raw.get(k) or "").strip()[:100] for k in ("sk", "cs", "en")}
    if not all(names.values()):
        return None, "names_required"

    d = raw.get("data") if isinstance(raw.get("data"), dict) else {}
    data: Dict[str, Any] = {
        "name_en": names["en"],
        "target": _pick(d.get("target"), ENUMS["target"]),
        "pattern": _pick(d.get("pattern"), ENUMS["pattern"]),
        "tier": _pick(d.get("tier"), ENUMS["tier"]),
        "equipment": _pick_list(d.get("equipment"), ENUMS["equipment"]),
        "load_type": _pick(d.get("load_type"), ENUMS["load_type"]),
        "unilateral": bool(d.get("unilateral")),
        "measure": _pick(d.get("measure"), ENUMS["measure"], "reps"),
        "load_mode": _pick(d.get("load_mode"), ENUMS["load_mode"], "external"),
        "skill_demand": _pick(d.get("skill_demand"), ENUMS["skill_demand"], "low"),
        "fatigue_cost": _pick(d.get("fatigue_cost"), ENUMS["fatigue_cost"], "low"),
        "eccentric_load": _pick(d.get("eccentric_load"), ENUMS["eccentric_load"], "low"),
        "rep_suitability": _pick_list(d.get("rep_suitability"), ENUMS["rep_suitability"]),
        "sport_tags": _pick_list(d.get("sport_tags"), ENUMS["sport_tags"]),
        "contraindications": _pick_list(d.get("contraindications"), ENUMS["contraindications"]),
    }
    for key in ("target", "pattern", "tier", "load_type"):
        if not data[key]:
            return None, f"missing_{key}"
    if not data["equipment"]:
        return None, "missing_equipment"

    muscles: Dict[str, float] = {}
    m_raw = raw.get("muscles") if isinstance(raw.get("muscles"), dict) else {}
    for k, v in m_raw.items():
        if k not in ENUMS["muscles"]:
            continue
        try:
            w = float(v)
        except (TypeError, ValueError):
            continue
        # zlomkový objem: hlavná partia 1.0, pomocná 0.5
        if w >= 0.75:
            muscles[k] = 1.0
        elif w > 0:
            muscles[k] = 0.5
    if not any(w >= 1.0 for w in muscles.values()):
        return None, "missing_primary_muscle"

    row: Dict[str, Any] = {
        "id": ex_id,
        "names": names,
        "data": data,
        "muscles": muscles,
        "categories": _pick_list(raw.get("categories"), ENUMS["categories"]),
        "active": bool(raw.get("active", True)),
    }
    try:
        if raw.get("sort_order") is not None:
            row["sort_order"] = int(raw.get("sort_order"))
    except (TypeError, ValueError):
        pass
    return row, None


def service_admin_save_exercise(raw: Any, *, admin_user_id: Optional[int] = None) -> Dict[str, Any]:
    row, err = normalize_exercise_input(raw)
    if not row:
        return {"ok": False, "code": err or "invalid"}
    from datetime import datetime, timezone

    row["updated_at"] = datetime.now(timezone.utc).isoformat()
    if admin_user_id:
        row["updated_by"] = int(admin_user_id)
    if "sort_order" not in row:
        # nový cvik na koniec, existujúci si poradie nechá (upsert by ho prepísal na null)
        existing = db_list_strength_exercises(ctx=service_ctx("strength_catalog.admin_save")) or []
        cur = next((r for r in existing if r.get("id") == row["id"]), None)
        row["sort_order"] = (cur or {}).get("sort_order") or (
            max((int(r.get("sort_order") or 0) for r in existing), default=0) + 10
        )
    saved = db_upsert_strength_exercise(row, ctx=service_ctx("strength_catalog.admin_save"))
    if not saved:
        return {"ok": False, "code": "save_failed"}
    refresh_strength_catalog(force=True)
    return {"ok": True, "item": saved}


def exercise_name(exercise_id: str, lang: str = "sk") -> str:
    """Názov cviku v jazyku usera (z DB, inak anglický z kódu)."""
    with _lock:
        rows = list(_state["rows"])
    for r in rows:
        if r.get("id") == exercise_id:
            names = r.get("names") or {}
            return names.get(lang) or names.get("en") or exercise_id
    ex = _cat.CATALOG_BY_ID.get(exercise_id) or {}
    return ex.get("name_en") or exercise_id
