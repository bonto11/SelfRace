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

    print("service_get_activity_review IN",user_id, activity_id, user_jwt, service)
    row = db_get_enrichment_for_activity(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    print("service_get_activity_review OUT",row)
    if not row:
        return None

    return {
        "review": row.get("review") or row.get("review_json") or row.get("review_text"),
        "created_at": row.get("created_at"),
    }