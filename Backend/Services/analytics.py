from __future__ import annotations

from typing import Any, Dict, Optional

from Routes_DB.activities_summary import (
    db_get_activity_summary_one,
)
from Routes_DB.activities_laps import (
    db_get_activity_laps,
)
from Routes_DB.activities_splits import (
    db_get_activity_splits,
)
from Services.users import require_jwt


def service_get_activity_detail(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Detail aktivity pre FE (summary + laps + splits).

    Režimy:
      - FE / RLS: service=False + user_jwt → require_jwt
      - worker / cron / maintenance: service=True → JWT sa nevaliduje, DB vrstva použije service clienta
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    # summary ide podľa activity_id + JWT (bez user_id)
    summary = db_get_activity_summary_one(
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    laps = db_get_activity_laps(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    splits = db_get_activity_splits(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    return {
        "summary": summary,
        "laps": laps or [],
        "splits": splits or [],
    }


def service_get_detail_one(
    user_id: int,
    activity_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = False,
) -> Dict[str, Any]:
    """
    Lightweight verzia – len laps + splits (bez summary).
    """
    if service:
        jwt = user_jwt
    else:
        jwt = require_jwt(user_jwt)

    laps = db_get_activity_laps(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    splits = db_get_activity_splits(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
        service=service,
    )

    return {
        "laps": laps or [],
        "splits": splits or [],
    }