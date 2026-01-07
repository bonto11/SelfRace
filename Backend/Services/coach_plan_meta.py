from __future__ import annotations

from typing import Any, Dict, Optional

from Routes_DB.coach_plan_meta import db_get_active_plan_meta_for_user
from Services.users import require_jwt


def service_build_active_plan_block_for_analysis(
    user_id: int,
    *,
    user_jwt: str,
) -> Dict[str, Any]:
    """
    Blok active_plan pre CoachAnalyzeInput.

    Výstup:
      {
        "has_active_plan": bool,
        "current_week_index": int | None,
        "total_weeks": int | None,
        "horizon_days": int | None,
      }
    """
    jwt = require_jwt(user_jwt)

    row = db_get_active_plan_meta_for_user(
        user_id=user_id,
        user_jwt=jwt,
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
