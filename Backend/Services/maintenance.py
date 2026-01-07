# Services/maintenance.py
from __future__ import annotations

from typing import Any, Dict

from Routes_DB.maintenance import db_cleanup_deleted_activities


def service_cleanup_deleted_activities(cutoff_days: int = 30) -> Dict[str, Any]:
    """
    Hard delete starších zmazaných aktivít (+ súvisiace dáta).

    Biznis vrstva – prípadne sem vieš neskôr pridať:
      - logging
      - feature flags
      - rôzne cutoffy podľa prostredia (dev/prod)
    Teraz len deleguje na DB vrstvu.
    """
    return db_cleanup_deleted_activities(cutoff_days=cutoff_days)
