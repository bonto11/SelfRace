# Configs/config_training.py
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

# ====== interný cache, nech to nečíta súbor pri každom importe ======
_CACHED_CATALOG: Optional[Dict[str, Dict[str, Dict[str, Any]]]] = None
_CACHED_PATH: Optional[str] = None

# Minimálny fallback, keby súbor chýbal – nech BE nespadne
_MIN_FALLBACK: Dict[str, Dict[str, Dict[str, Any]]] = {
    "run": {
        "run_easy": {
            "id": "run_easy",
            "sport": "run",
            "label": "Easy run",
            "description": "Pokojný beh v nízkej intenzite.",
            "wu_min": None,
            "cd_min": None,
        },
        "run_long": {
            "id": "run_long",
            "sport": "run",
            "label": "Long run",
            "description": "Dlhší beh v nízkej intenzite.",
            "wu_min": None,
            "cd_min": None,
        },
        "run_intervals": {
            "id": "run_intervals",
            "sport": "run",
            "label": "Intervaly",
            "description": "Opakované úseky vo vyššej intenzite.",
            "wu_min": 15,
            "cd_min": 10,
        },
    },
    "strength": {
        "strength_full_body": {
            "id": "strength_full_body",
            "sport": "strength",
            "label": "Full-body strength",
            "description": "Komplexný tréning celého tela.",
            "wu_min": None,
            "cd_min": None,
        }
    },
    "ride": {
        "ride_easy_endurance": {
            "id": "ride_easy_endurance",
            "sport": "ride",
            "label": "Easy endurance",
            "description": "Pokojná jazda v nízkej intenzite.",
            "wu_min": None,
            "cd_min": None,
        }
    },
    "swim": {
        "swim_easy_technique": {
            "id": "swim_easy_technique",
            "sport": "swim",
            "label": "Easy / technique",
            "description": "Pokojné plávanie s dôrazom na techniku.",
            "wu_min": None,
            "cd_min": None,
        }
    },
}


def _project_path_candidates() -> list[Path]:
    """
    Preferuj ENV, potom cesty relatívne k tomuto súboru.
    Nepoužívaj CWD – v Dockeri je to často /app a láme sa to.
    """
    env = os.getenv("TRAINING_TYPES_PATH")
    here = Path(__file__).resolve().parent
    root = here.parent  #

    candidates = []
    if env:
        candidates.append(Path(env))

    # tvoje aktuálne umiestnenie: shared/files/training_types.json
    candidates.append(here / "files" / "training_types.json")
    # alternatívy, keby si niekedy presunul súbor
    candidates.append(here / "training_types.json")
    candidates.append(
        root / "data" / "training_types.json"
    )  # legacy – už nepreferujeme

    return candidates


def _validate_catalog(obj: Any) -> Optional[Dict[str, Dict[str, Dict[str, Any]]]]:
    """
    Očakávame mapu: { sport: { session_type_id: TrainingTypeEntry } }.
    Vráti validovaný dict alebo None.
    """
    if not isinstance(obj, dict):
        return None
    out: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for sport, group in obj.items():
        if not isinstance(group, dict):
            continue
        g2: Dict[str, Dict[str, Any]] = {}
        for key, entry in group.items():
            if not isinstance(entry, dict):
                continue
            # povinné polia
            if not entry.get("id") or not entry.get("sport") or not entry.get("label"):
                continue
            # normalize optional WU/CD – podporujeme wu_min/cd_min aj warmup_min/cooldown_min
            if "wu_min" not in entry and "warmup_min" in entry:
                entry["wu_min"] = entry.get("warmup_min")
            if "cd_min" not in entry and "cooldown_min" in entry:
                entry["cd_min"] = entry.get("cooldown_min")
            g2[key] = entry
        if g2:
            out[str(sport)] = g2
    return out if out else None


def _load_catalog_from_disk() -> Tuple[Dict[str, Dict[str, Dict[str, Any]]], str]:
    for p in _project_path_candidates():
        try:
            if p.is_file():
                with p.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                valid = _validate_catalog(data)
                if valid:
                    return valid, str(p)
        except Exception:
            # skúšaj ďalšiu kandidátsku cestu
            continue
    # nič nenašlo – spadnúť nechceme, vrátime minimálny fallback
    return _MIN_FALLBACK, "FALLBACK::embedded"


def get_session_type_catalog_for_prompt() -> Dict[str, Dict[str, Dict[str, Any]]]:
    """
    Verejná funkcia – používa ju plan_generation.py.
    Garantuje vždy VALIDNÝ dict a nikdy nevracia primitív typu int/str.
    """
    global _CACHED_CATALOG, _CACHED_PATH
    if _CACHED_CATALOG is not None:
        return _CACHED_CATALOG
    cat, used_path = _load_catalog_from_disk()
    _CACHED_CATALOG = cat
    _CACHED_PATH = used_path
    return cat


def training_types_path_debug() -> str:
    """
    Pomôcka na rýchly debug – kde sa reálne načítal súbor (alebo FALLBACK).
    """
    global _CACHED_PATH
    if _CACHED_PATH is None:
        # inicializuj cache, ak ešte nebola
        _ = get_session_type_catalog_for_prompt()
    return _CACHED_PATH or "UNKNOWN"
