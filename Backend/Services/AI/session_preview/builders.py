# Services/AI/session_preview/builders.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from DB.coach_plan_daily import db_get_daily_session_by_id_full
from DB.user_zones import db_user_zones_fetch_latest
from DB.users import db_get_user_display_name
from DB.user_prefs import db_get_pref_single
from Services.user_recovery import service_build_recovery_block_for_analysis

from Modules.Supabase.auth import AuthCtx
from Configs.strength_catalog import STRENGTH_EXERCISE_CATALOG

def _minified_strength_catalog() -> List[Dict[str, Any]]:
    """Len id + target - name/equipment nepotrebné pre AI výber, šetrí tokeny."""
    return [
        {"id": e["id"], "target": e.get("target")}
        for e in STRENGTH_EXERCISE_CATALOG
        if isinstance(e, dict) and e.get("id")
    ]

# ============================================================
# HELPERS
# ============================================================

def _sanitize_user_comment(raw: Optional[str]) -> Optional[str]:
    """Orezá komentár používateľa na max 900 znakov."""
    if raw is None:
        return None
    try:
        s = str(raw).strip()
    except Exception:
        return None
    if not s:
        return None
    if len(s) > 900:
        s = s[:900].rstrip() + "…"
    return s


def _canonical_sport(s: Any) -> str:
    """Normalizuje sport na run/ride/strength/swim/other."""
    if not s:
        return "other"
    v = str(s).lower().strip()
    if v in ("run", "trail", "trail_run") or v.startswith("run"):
        return "run"
    if v in ("ride", "bike", "cycle") or v.startswith(("ride", "bike", "cycle")):
        return "ride"
    if v in ("strength", "gym", "weights") or "strength" in v or "gym" in v:
        return "strength"
    if "swim" in v:
        return "swim"
    return "other"


THREAD_MAX_ENTRIES_FOR_AI = 6


def _minify_preview_thread_for_ai(
    thread: List[Dict[str, Any]], *, max_entries: int = THREAD_MAX_ENTRIES_FOR_AI
) -> List[Dict[str, Any]]:
    """Osekáva predchádzajúci preview thread pre AI — necháva len posledných N entries."""
    if not thread:
        return []
    recent = thread[-max_entries:]
    out: List[Dict[str, Any]] = []
    for entry in recent:
        if not isinstance(entry, dict):
            continue
        role = entry.get("role")
        if role == "user":
            out.append({
                "role": "user",
                "comment": entry.get("comment"),
                "request_change": bool(entry.get("request_change")),
            })
        elif role == "assistant":
            out.append({
                "role": "assistant",
                "reply_text": entry.get("reply_text"),
                "changed": bool(entry.get("changed")),
            })
    return out


# ============================================================
# MAIN INPUT BUILDER
# ============================================================

def build_base_input(user_id: int, session_id: int) -> Dict[str, Any]:
    """Vráti prázdnu kostru context_payload so všetkými kľúčmi."""
    return {
        "schema_version": 1,
        "user": {"id": user_id},
        "sport": None,
        "user_input": {
            "comment": None,
            "request_change": False,
        },
        "session": {
            "plan_date": None,
            "sport": "other",
            "kind": None,
            "title": None,
            "duration_min": None,
            "notes": None,
            "structure": None,
        },
        "context": {
            "recovery": None,
            "user_zones": None,
            "preview_thread": [],
        },
    }


def build_context_for_session_preview(
    *,
    user_id: int,
    session_id: int,
    comment: str,
    request_change: bool,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    Hlavná funkcia buildera — zostaví kompletný context_payload pre AI pre jednu
    naplánovanú (budúcu) session: dáta session, recovery/wellness kontext, zóny,
    a predchádzajúci preview_thread (ak ide o pokračovanie konverzácie).
    """
    input_data = build_base_input(user_id, session_id)

    safe_comment = _sanitize_user_comment(comment)
    input_data["user_input"]["comment"] = safe_comment
    input_data["user_input"]["request_change"] = bool(request_change)

    session_row = db_get_daily_session_by_id_full(user_id, session_id, ctx=ctx)
    if not session_row:
        return None

    sport = _canonical_sport(session_row.get("sport"))
    input_data["sport"] = sport
    
    if sport == "strength" and request_change:
        input_data["context"]["strength_catalog"] = _minified_strength_catalog()

    input_data["session"] = {
        "plan_date": session_row.get("plan_date"),
        "sport": sport,
        "kind": session_row.get("kind"),
        "title": session_row.get("title"),
        "duration_min": session_row.get("duration_min"),
        "notes": session_row.get("notes"),
        "structure": session_row.get("structure"),
    }

    # Recovery/wellness kontext — rovnaký zdroj ako activity_review
    try:
        recovery = service_build_recovery_block_for_analysis(user_id, ctx=ctx)
        input_data["context"]["recovery"] = recovery
    except Exception as e:
        print(f"❌ [AI][session_preview][builder] recovery fetch failed: {repr(e)}")

    # Zóny pre daný šport (kontext na radu ohľadom tempa/HR)
    try:
        user_zones_row = db_user_zones_fetch_latest(user_id=user_id, sport_raw=sport, ctx=ctx)
        if not user_zones_row:
            user_zones_row = db_user_zones_fetch_latest(user_id=user_id, sport_raw=None, ctx=ctx)
        if user_zones_row:
            input_data["context"]["user_zones"] = {
                "sport": user_zones_row.get("sport"),
                "z1": {"min": 0, "max": user_zones_row.get("z1_max_bpm")},
                "z2": {"min": user_zones_row.get("z2_min_bpm"), "max": user_zones_row.get("z2_max_bpm")},
                "z3": {"min": user_zones_row.get("z3_min_bpm"), "max": user_zones_row.get("z3_max_bpm")},
                "z4": {"min": user_zones_row.get("z4_min_bpm"), "max": user_zones_row.get("z4_max_bpm")},
                "z5": {"min": user_zones_row.get("z5_min_bpm"), "max": user_zones_row.get("hr_max_bpm")},
            }
    except Exception as e:
        print(f"❌ [AI][session_preview][builder] user_zones fetch failed: {repr(e)}")

    # Predchádzajúci preview thread — kontext pri pokračovaní konverzácie
    try:
        existing_thread = session_row.get("preview_thread") or []
        input_data["context"]["preview_thread"] = _minify_preview_thread_for_ai(existing_thread)
    except Exception as e:
        print(f"❌ [AI][session_preview][builder] preview_thread minify failed: {repr(e)}")

    # Personalizácia: meno, pohlavie
    try:
        display_name = db_get_user_display_name(user_id, ctx=ctx)
        if display_name:
            input_data["user"]["first_name"] = display_name

        prefs_row = db_get_pref_single(user_id=user_id, key="coach.prefs", ctx=ctx)
        if isinstance(prefs_row, dict):
            val = prefs_row.get("value")
            prefs_data = val if isinstance(val, dict) else prefs_row
            gender = prefs_data.get("gender")
            if gender in ("male", "female"):
                input_data["user"]["gender"] = gender
    except Exception as e:
        print(f"❌ [AI][session_preview][builder] personalization fetch failed: {repr(e)}")

    return input_data

