# Routes_DB/maintenance.py
from __future__ import annotations

from typing import Any, Dict

from Modules.SQL.db_handler import get_service_client

# maintenance ide vždy ako admin → service client (bez RLS/JWT)
supabase = get_service_client()


def db_cleanup_deleted_activities(cutoff_days: int = 30) -> Dict[str, Any]:
    """
    Volá SQL funkciu cleanup_deleted_activities(cutoff_days)
    a vracia jej JSON výsledok.

    Používané zo Services (cron / admin úlohy).
    """
    resp = (
        supabase.rpc(
            "cleanup_deleted_activities",
            {"cutoff_days": cutoff_days},
        )
        .execute()
    )

    data = getattr(resp, "data", None)
    err = getattr(resp, "error", None)

    if err:
        # nech sa to zaloguje až v service/route, tu len vyhodíme chybu
        raise RuntimeError(str(err))

    # funkcia v SQL vracia jsonb → tu bude už dict
    return data or {}