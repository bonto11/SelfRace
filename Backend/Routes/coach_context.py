# Routes/coach_context.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from backend.Services.Supabase.user_bests import fetch_user_bests
from backend.Services.Supabase.user_notes import fetch_recent_notes
from backend.Services.Supabase.user_prefs import fetch_pref
from backend.Services.Supabase.user_recovery import fetch_recent_recovery
from backend.Services.Supabase.user_thresholds import fetch_user_thresholds
from backend.Services.Supabase.user_zones import fetch_user_zones
from Services.coach_weekly import build_weekly_context

router = APIRouter(prefix="/coach", tags=["coach"])

@router.get("/context/{user_id}")
def coach_context(user_id: int, weeks: int = 6, rec_days: int = 21):
    try:
        weekly     = build_weekly_context(user_id, weeks=weeks)
        recovery   = fetch_recent_recovery(user_id, days=rec_days)
        notes      = fetch_recent_notes(user_id, days=weeks * 7)
        thresholds = fetch_user_thresholds(user_id)
        zones      = fetch_user_zones(user_id)
        prefs      = fetch_pref(user_id, "coach.prefs")
        bests      = fetch_user_bests(user_id, "run")
        return {
            "success": True,
            "weekly": weekly,
            "recovery": recovery,
            "notes": notes,
            "thresholds": thresholds,
            "zones": zones,
            "prefs": prefs,
            "bests": bests,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))