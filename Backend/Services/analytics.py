# Services/analytics.py

from __future__ import annotations

from typing import Any, Dict, List, Optional

from Routes_DB.activities_summary import (
    db_get_activity_summary_one,
)

from Routes_DB.activities_laps import (
    db_get_activity_laps,
)

from Routes_DB.activities_splits import (
    db_get_activity_splits,
)


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

    Parametre:
      user_id  – numerické ID usera v tvojom systéme
      activity_id – Strava/Supabase activity_id
      user_jwt – access token (Supabase JWT) pre RLS (voliteľné, ale chceme ho všade)
    """
    summary = db_get_activity_summary_one(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=user_jwt,
    )

    laps = db_get_activity_laps(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=user_jwt,
    )

    splits = db_get_activity_splits(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=user_jwt,
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
    laps = db_get_activity_laps(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=user_jwt,
    )

    splits = db_get_activity_splits(
        user_id=user_id,
        activity_id=activity_id,
        user_jwt=user_jwt,
    )

    return {
        "laps": laps or [],
        "splits": splits or [],
    }