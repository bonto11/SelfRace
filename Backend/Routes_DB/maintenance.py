from __future__ import annotations

from typing import Any, Dict, Optional

from Modules.Supabase.client import get_sb


def db_cleanup_deleted_activities(
    cutoff_days: int = 30,
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,  # default = service-role
) -> Dict[str, Any]:
    """
    Volá SQL funkciu cleanup_deleted_activities(cutoff_days)
    a vracia jej JSON výsledok.

    Používané zo Services (cron / admin úlohy).
    V praxi to volaj ako service client → service=True, user_jwt nechaj None.
    """
    sb = get_sb(user_jwt=user_jwt, service=service, caller="maintenance_cleanup")

    resp = (
        sb.rpc(
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