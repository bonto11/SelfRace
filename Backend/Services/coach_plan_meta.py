from __future__ import annotations

from typing import Any, Dict, Optional

from Routes_DB.coach_plan_meta import db_get_active_plan_meta_for_user
from Services.users import require_jwt


def service_build_active_plan_block_for_analysis(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Blok active_plan pre CoachAnalyzeInput.

    Režimy:
      - service=False (default): RLS cez user_jwt, require_jwt().
      - service=True: používa service DB klienta (user_jwt sa len forwarduje,
        môže byť aj None). RLS sa neaplikuje, zodpovednosť je na volajúcom.

    Výstup:
      {
        "has_active_plan": bool,
        "current_week_index": int | None,
        "total_weeks": int | None,
        "horizon_days": int | None,
      }
    """
    if service:
        # service režim – DB vrstva musí z `service=True` vybrať service klienta
        row = db_get_active_plan_meta_for_user(
            user_id=user_id,
            user_jwt=user_jwt,
            service=True,
        )
    else:
        # klasický RLS režim
        jwt = require_jwt(user_jwt)
        row = db_get_active_plan_meta_for_user(
            user_id=user_id,
            user_jwt=jwt,
            service=False,
        )

    if not row:
        return {
            "has_active_plan": False,
            "current_week_index": None,
            "total_weeks": None,
            "horizon_days": None,
        }

    total_weeks = row.get("weeks_total") or row.get("weeks") or None

    return {
        "has_active_plan": True,
        "current_week_index": row.get("current_week_index"),
        "total_weeks": total_weeks,
        "horizon_days": row.get("horizon_days"),
    }