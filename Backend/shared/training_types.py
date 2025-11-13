# backend/shared/training_types

import json
from pathlib import Path
from typing import Any, Dict

# Predpoklad: backend/Services/training_types.py
# shared/training_types.json je o jeden level vyššie v ../shared
# Ak máš inú štruktúru, uprav ROOT_DIR.
ROOT_DIR = Path(__file__).resolve().parents[1]  # .. nad Services/
SHARED_JSON = ROOT_DIR / "shared" / "files" / "training_types.json"

if not SHARED_JSON.exists():
  raise RuntimeError(f"training_types.json not found at {SHARED_JSON}")

TRAINING_TYPES: Dict[str, Dict[str, Any]] = json.loads(SHARED_JSON.read_text(encoding="utf-8"))


def get_session_type_catalog_for_prompt() -> Dict[str, Dict[str, str]]:
    """
    Vracia zjednodušenú mapu pre prompt:
    { "run": { "run_easy": "Easy run – ...", ... }, ... }
    aby sme do AI neposielali zbytočné polia.
    """
    out: Dict[str, Dict[str, str]] = {}
    for sport, types in TRAINING_TYPES.items():
        sport_map: Dict[str, str] = {}
        for key, info in types.items():
            sid = str(info.get("id") or key)
            label = str(info.get("label") or sid)
            desc = str(info.get("description") or "")
            sport_map[sid] = f"{label}: {desc}".strip()
        out[sport] = sport_map
    return out