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
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Detail aktivity pre FE (summary + laps + splits).

    Očakávanie:
      - volané z FE route, ktorá vie vytiahnuť JWT aktuálneho usera
      - RLS na activities_* tabuľkách zabezpečí, že user vidí len svoje dáta
    """
    jwt = require_jwt(user_jwt)

    # ✅ summary už ide len podľa activity_id + JWT (bez user_id)
    summary = db_get_activity_summary_one(
        activity_id=activity_id,
        user_jwt=jwt,
        # service=False → RLS klient (default)
    )

    laps = db_get_activity_laps(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
    )

    splits = db_get_activity_splits(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
    )

    return {
        "summary": summary,
        "laps": laps or [],
        "splits": splits or [],
    }


def service_get_detail_one(
    user_id: int,
    activity_id: int,
    user_jwt: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Lightweight verzia – len laps + splits (bez summary).
    """
    jwt = require_jwt(user_jwt)

    laps = db_get_activity_laps(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
    )

    splits = db_get_activity_splits(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=jwt,
    )

    return {
        "laps": laps or [],
        "splits": splits or [],
    }
