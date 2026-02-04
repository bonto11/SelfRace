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
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
        res = sb.table(TABLE_ASYNC_JOBS).insert(row).execute()
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] insert error:", repr(e))
        return None


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
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
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
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
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
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
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
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
        res = sb.table(TABLE_ASYNC_JOBS).update(fields).eq("id", job_id).execute()
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] update_finished error:", repr(e))
        return None


def _try_lock_job_row(
    row: Dict[str, Any], *, worker_id: str
) -> Optional[Dict[str, Any]]:
    """
    Skúsi locknúť konkrétny row (queued -> running).
    Ak to už niekto lockol, vráti None.
    """
    jid = row.get("id")
    if jid is None:
        return None
    try:
        job_id = int(jid)
    except Exception:
        return None

    # attempts inkrementujeme na DB úrovni cez existujúci field job.attempts
    try:
        attempts_old = int(row.get("attempts") or 0)
    except Exception:
        attempts_old = 0

    locked = db_mark_job_running(
        job_id=job_id,
        worker_id=worker_id,
        attempts=attempts_old + 1,
        user_jwt=None,
        service=True,
    )
    return locked


def db_pick_next_job_for_user(
    user_id: int,
    *,
    worker_id: str,
    service: bool = True,
    user_jwt: Optional[str] = None,
    max_scan: int = 5,
) -> Optional[Dict[str, Any]]:
    """
    ✅ Worker-safe: vyberie ďalší runnable job pre usera a ATOMICKY ho lockne.
    - status=queued
    - run_after NULL alebo <= now
    - order: priority ASC, created_at ASC
    - skúsi locknúť prvých max_scan kandidátov (kvôli race medzi workermi)
    """
    now_iso = _now_iso()
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")

        q = (
            sb.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("user_id", int(user_id))
            .eq("status", "queued")
            .or_(f"run_after.is.null,run_after.lte.{now_iso}")
            .order("priority", desc=False)
            .order("created_at", desc=False)
            .limit(int(max_scan or 5))
        )
        res = q.execute()
        rows = res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] pick_next_for_user select error:", repr(e))
        return None

    for r in rows:
        if not isinstance(r, dict):
            continue
        locked = _try_lock_job_row(r, worker_id=worker_id)
        if locked:
            return locked

    return None


def db_pick_next_job_global(
    *,
    worker_id: str,
    service: bool = True,
    user_jwt: Optional[str] = None,
    max_scan: int = 10,
) -> Optional[Dict[str, Any]]:
    """
    ✅ Worker-safe: vyberie ďalší runnable job globálne a ATOMICKY ho lockne.
    - status=queued
    - run_after NULL alebo <= now
    - order: priority ASC, created_at ASC
    - skúsi locknúť prvých max_scan kandidátov (kvôli race medzi workermi)
    """
    now_iso = _now_iso()
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
        q = (
            sb.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("status", "queued")
            .or_(f"run_after.is.null,run_after.lte.{now_iso}")
            .order("priority", desc=False)
            .order("created_at", desc=False)
            .limit(int(max_scan or 10))
        )
        res = q.execute()
        rows = res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] pick_next_global select error:", repr(e))
        return None

    for r in rows:
        if not isinstance(r, dict):
            continue
        locked = _try_lock_job_row(r, worker_id=worker_id)
        if locked:
            return locked

    return None
