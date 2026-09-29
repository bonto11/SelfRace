# Services/coach_mode.py
from __future__ import annotations

from typing import Literal

from DB.user_prefs import db_get_pref_single
from Modules.Supabase.auth import AuthCtx

CoachMode = Literal["coach", "advisor"]


def service_get_coach_mode(user_id: int, *, ctx: AuthCtx) -> CoachMode:
    """
    Číta coach_mode ("coach" | "advisor") z coach.prefs.
    Default "coach" pri akomkoľvek probléme s čítaním/parsovaním -
    fail-safe smerom k pôvodnému (existujúcemu) správaniu.

    Zdieľané pre všetky automatické spúšťače (daily auto-extend,
    weekly auto-replan, health soften/critical), aby logika čítania
    a default hodnota bola na jednom mieste.
    """
    try:
        row = db_get_pref_single(user_id, "coach.prefs", ctx=ctx)
        value = (row or {}).get("value")
        if isinstance(value, dict) and value.get("coach_mode") == "advisor":
            return "advisor"
    except Exception as e:
        print(f"[COACH-MODE] read failed user={user_id}: {repr(e)}")
    return "coach"