from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from Modules.Supabase.client import get_sb
from Configs.config import TABLE_ASYNC_JOBS

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_insert_job(
    row: Dict[str, Any],
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    INSERT do async_jobs.

    Typicky:
      - service_enqueue_job → service=True (default)
    """
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller ="async_jobs")
        res = sb.table(TABLE_ASYNC_JOBS).insert(row).execute()
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] insert error:", repr(e))
        return None


def db_get_active_jobs(
    user_id: int,
    job_types: Optional[List[str]] = None,
    limit: int = 50,
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> List[Dict[str, Any]]:
    """
    Aktívne joby pre usera – status v ('queued', 'running').
    """
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller ="async_jobs")
        q = (
            sb.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("user_id", user_id)
            .in_("status", ["queued", "running"])
            .order("created_at", desc=True)
            .limit(limit)
        )
        if job_types:
            q = q.in_("job_type", job_types)

        res = q.execute()
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] get_active error:", repr(e))
        return []


def db_get_recent_jobs(
    user_id: int,
    job_types: Optional[List[str]] = None,
    limit: int = 20,
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> List[Dict[str, Any]]:
    """
    Posledné joby (akýkoľvek status) pre usera.
    """
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller ="async_jobs")
        q = (
            sb.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if job_types:
            q = q.in_("job_type", job_types)

        res = q.execute()
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] get_recent error:", repr(e))
        return []


def db_get_job_by_id(
    user_id: int,
    job_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Jednotlivý job podľa ID – istíme sa aj user_id.
    """
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller ="async_jobs")
        res = (
            sb.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("user_id", user_id)
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] get_by_id error:", repr(e))
        return None


def db_mark_job_running(
    job_id: int,
    *,
    worker_id: str,
    attempts: int,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Pokúsi sa označiť job ako 'running'.

    Upraví len ak je aktuálne 'queued' – ochrana pred race conditions.
    """
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller ="async_jobs")
        res = (
            sb.table(TABLE_ASYNC_JOBS)
            .update(
                {
                    "status": "running",
                    "attempts": attempts,
                    "locked_at": _now_iso(),
                    "locked_by": worker_id,
                    "started_at": _now_iso(),
                    "updated_at": _now_iso(),
                }
            )
            .eq("id", job_id)
            .eq("status", "queued")
            .execute()
        )
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] mark_running error:", repr(e))
        return None


def db_update_job_finished(
    job_id: int,
    *,
    status: str,
    result: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
    progress: Optional[int] = None,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Optional[Dict[str, Any]]:
    """
    Označí job ako dokončený (succeeded/failed), uloží result/error.
    """
    fields: Dict[str, Any] = {
        "status": status,
        "updated_at": _now_iso(),
        "finished_at": _now_iso(),
    }
    if result is not None:
        fields["result"] = result
    if error is not None:
        fields["error"] = error
    if progress is not None:
        fields["progress"] = int(progress)

    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller ="async_jobs")
        res = (
            sb.table(TABLE_ASYNC_JOBS)
            .update(fields)
            .eq("id", job_id)
            .execute()
        )
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] update_finished error:", repr(e))
        return None