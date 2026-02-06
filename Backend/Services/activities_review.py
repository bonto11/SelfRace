# Services/activities_review.py
from typing import Any, Dict, Optional
from Modules.Supabase.auth import AuthCtx
from Routes_DB.activities_enrichment import db_get_enrichment_for_activity


def service_get_activity_review(
    *,
    user_id: int,
    activity_id: int,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:

    row = db_get_enrichment_for_activity(
        user_id=user_id, activity_id=activity_id, ctx=ctx
    )

    if not row:
        return None

    return {
        "review": row.get("ai_review"),
        "updated_at": row.get("updated_at"),
    }
