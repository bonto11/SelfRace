# Services/exercise_suggestions.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx
from DB.exercise_suggestions import (
    db_insert_exercise_suggestion,
    db_list_exercise_suggestions_for_user,
)

VALID_PATTERNS = {
    "squat", "hinge", "lunge", "push_h", "push_v", "pull_h", "pull_v",
    "carry", "grip", "rotation", "anti_rotation", "calf", "jump",
    "anti_extension", "other",
}
VALID_LOAD_MODES = {"external", "bodyweight_plus"}
VALID_MEASURES = {"reps", "time", "distance"}


def service_create_exercise_suggestion(
    *,
    user_id: int,
    name: str,
    pattern: Optional[str],
    load_mode: Optional[str],
    measure: Optional[str],
    equipment: Optional[List[str]],
    notes: Optional[str],
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Uloží návrh cviku od usera na doplnenie do STRENGTH_EXERCISE_CATALOG.
    Toto je len zber podnetov - do katalógu ich niekto pridáva ručne po
    kontrole (nová položka v Configs/strength_catalog.py).
    """
    clean_name = str(name or "").strip()[:100]
    if not clean_name:
        return {"ok": False, "code": "name_required"}

    row = {
        "user_id": int(user_id),
        "name": clean_name,
        "pattern": str(pattern) if pattern in VALID_PATTERNS else "other",
        "load_mode": str(load_mode) if load_mode in VALID_LOAD_MODES else "external",
        "measure": str(measure) if measure in VALID_MEASURES else "reps",
        "equipment": [str(e)[:50] for e in (equipment or []) if isinstance(e, str)][:10],
        "notes": str(notes)[:500] if notes else None,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    created = db_insert_exercise_suggestion(row, ctx=ctx)
    if not created:
        return {"ok": False, "code": "insert_failed"}
    return {"ok": True, "data": created}


def service_list_exercise_suggestions(
    *, user_id: int, limit: int = 50, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    return db_list_exercise_suggestions_for_user(user_id, limit=limit, ctx=ctx)
