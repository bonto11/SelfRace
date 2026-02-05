# Services/activities_review.py
from typing import Any, Dict, Optional
from Services.users import require_jwt
from Routes_DB.activities_enrichment import db_get_enrichment_for_activity


def service_get_activity_review(
    *,
    user_id: int,
    activity_id: int,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Optional[Dict[str, Any]]:
    jwt = None if service else require_jwt(user_jwt)

    row = db_get_enrichment_for_activity(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    if not row:
        return None

    return {
        "review": row.get("ai_review"),
        "updated_at": row.get("updated_at"),
    }
