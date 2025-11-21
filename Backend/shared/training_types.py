# shared/training_types.py
import json, os
from typing import Dict, Any

JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "training_types.json")

SPORT_KEYS = {"run", "ride", "strength", "swim"}

def get_session_type_catalog_for_prompt() -> Dict[str, Any]:
    """
    Vráti IBA mapu {run|ride|strength|swim: {session_type: {...}}}.
    Ignoruje meta kľúče (version, meta, notes, atď.).
    Nikdy nevráti int/list.
    """
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, dict):
        return {}

    out: Dict[str, Any] = {}
    for k, v in raw.items():
        if k in SPORT_KEYS and isinstance(v, dict):
            out[k] = v
    return out