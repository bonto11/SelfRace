# Services/maintenance.py
from __future__ import annotations

from typing import Dict, Any, List, Optional

from Routes_DB.maintenance import db_cleanup_deleted_activities
from Routes_DB.users import db_list_users_for_cron
from Services.async_jobs import service_enqueue_ai_analyze_job_service
from Routes_DB.maintenance import (
    db_cleanup_deleted_activities,
    db_account_hard_delete,
)

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


def service_weekly_athlete_state_analysis(
    max_users: int = 500,
) -> Dict[str, Any]:
    """
    Cron úloha:
      - zoberie zoznam userov
      - pre každého enqueuje ai_analyze job v service režime
      - AI uloží stav do coach_athlete_state

    Beží cez service Supabase klienta (service=True).
    """
    users: List[Dict[str, Any]] = db_list_users_for_cron(
        limit=max_users,
        user_jwt=None,
        service=True,
    )

    enqueued = 0
    jobs: List[Dict[str, Any]] = []

    for u in users:
        user_id = u.get("id")
        auth_uid = u.get("auth_uid")
        if not user_id or not auth_uid:
            continue

        job_resp = service_enqueue_ai_analyze_job_service(
            user_id=int(user_id),
            user_uid=str(auth_uid),
            model=None,  # default model
            debug=False,
            save_to_db=True,  # vždy ulož do coach_athlete_state
        )
        jobs.append(job_resp)
        if job_resp.get("job"):
            enqueued += 1

    return {
        "users_total": len(users),
        "jobs_enqueued": enqueued,
    }

def service_account_hard_delete(
    *,
    dry_run: bool = False,
    only_user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Hard delete účtov označených na zmazanie.

    - dry_run=True  → len simuluje, nič nemaže
    - only_user_id  → ak je zadané, obmedzí mazanie len na daného usera
    """
    return db_account_hard_delete(
        dry_run=dry_run,
        only_user_id=only_user_id,
        user_jwt=None,
        service=True,  # service-role, bez RLS
    )
