# Services/AI/catalog_assistant/main.py
"""
AI asistent admina pre katalóg cvikov (admin panel → Katalóg cvikov → AI).

Admin sa pýta na cviky (na čo je, aké partie, ako ho nastaviť, ako ho
pomenovať v SK/CS/EN) a AI môže navrhnúť úpravu alebo nový cvik v tvare
formulára. Návrh sa skontroluje rovnako ako ručný zápis
(normalize_exercise_input) a uloží sa až po kliknutí admina.

Bez kvóty a billingu – je to nástroj vývoja, nie funkcia pre userov.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from Configs.config import ai_model_for
import Configs.strength_catalog as _cat
from Services.AI.provider.provider import ai_call_json_model
from Services.strength_catalog_store import ENUMS, normalize_exercise_input

MAX_MESSAGES = 16


def _catalog_index() -> List[str]:
    """Krátky zoznam existujúcich cvikov – na duplicity a podobné cviky."""
    out = []
    for ex_id, ex in _cat.CATALOG_BY_ID.items():
        out.append(f"{ex_id}|{ex.get('name_en')}|{ex.get('pattern')}|{ex.get('target')}")
    return out


def _system_prompt() -> str:
    return (
        "You are a strength and conditioning expert helping the admin of SelfRace (training app for runners, "
        "trail/OCR athletes and people who lift) maintain its exercise catalog. Answer in Slovak, briefly and "
        "practically: what the exercise is for, which muscles work (primary 1.0 / helping 0.5), correct setup "
        "and technique cues, equipment, difficulty, fatigue, contraindications, and the right names in Slovak, "
        "Czech and English (names athletes really use; established terms like 'Plank' or 'Bird-dog' may stay "
        "in brackets). Be factually correct; say so when something in the current exercise is wrong.\n"
        "Return ONE JSON object only: {\"reply\": \"text in Slovak\", \"proposal\": exercise object or null}.\n"
        "Fill 'proposal' ONLY when the admin asks to create or change an exercise, or when you found an error "
        "worth fixing. The proposal is the WHOLE exercise in this shape:\n"
        "{\"id\": \"snake_case id (keep the existing id when editing)\", \"names\": {\"sk\",\"cs\",\"en\"}, "
        "\"data\": {\"target\",\"pattern\",\"tier\",\"equipment\":[...],\"load_type\",\"unilateral\":bool,"
        "\"measure\",\"load_mode\",\"skill_demand\",\"fatigue_cost\",\"eccentric_load\",\"rep_suitability\":[...],"
        "\"sport_tags\":[...],\"contraindications\":[...]}, \"muscles\": {\"muscle\": 1.0 or 0.5}, "
        "\"categories\": [\"plyo\"|\"iso\"], \"active\": true}\n"
        "Use ONLY values from 'allowed_values'. equipment = any one of them is enough (a barbell exercise has "
        "only [\"barbell\"], not [\"barbell\",\"bench\"]). measure: reps / time (holds, carries in seconds) / "
        "distance (meters). load_mode: external (weight required) / bodyweight_plus (bodyweight, extra kg "
        "optional). Isolation exercises (biceps, triceps, raises) are tier 'accessory'. Check 'catalog' for "
        "duplicates before proposing a new exercise and say if a similar one already exists."
    )


def service_catalog_assistant(messages: Any, exercise: Any) -> Dict[str, Any]:
    msgs: List[Dict[str, str]] = []
    for m in (messages if isinstance(messages, list) else [])[-MAX_MESSAGES:]:
        if not isinstance(m, dict):
            continue
        text = str(m.get("text") or "").strip()[:2000]
        if text:
            msgs.append({"role": "admin" if m.get("role") != "assistant" else "assistant", "text": text})
    if not msgs or msgs[-1]["role"] != "admin":
        return {"ok": False, "code": "empty_question"}

    context: Dict[str, Any] = {
        "current_exercise": exercise if isinstance(exercise, dict) else None,
        "allowed_values": ENUMS,
        "catalog": _catalog_index(),
        "conversation": msgs,
    }
    res = ai_call_json_model(
        context_payload=context,
        system_prompt=_system_prompt(),
        user_instructions=(
            "CONTEXT_JSON:\n" + json.dumps(context, ensure_ascii=False)
            + "\n\nAnswer the last admin message in 'conversation'. Return ONLY raw JSON."
        ),
        model=ai_model_for("catalog_assistant"),
        max_tokens=3000,
    )
    data = res.data if res.ok and isinstance(res.data, dict) else None
    reply = str((data or {}).get("reply") or "").strip()
    if not reply:
        return {"ok": False, "code": "ai_generation_failed"}

    proposal: Optional[Dict[str, Any]] = None
    proposal_error: Optional[str] = None
    if isinstance(data.get("proposal"), dict):
        proposal, proposal_error = normalize_exercise_input(data["proposal"])
    return {"ok": True, "reply": reply, "proposal": proposal, "proposal_error": proposal_error}
