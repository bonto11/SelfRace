from __future__ import annotations

from typing import Any, Dict, List, Optional, Set
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
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
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
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
        q = (
            sb.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("user_id", int(user_id))
            .in_("status", ["queued", "running"])
            .order("created_at", desc=True)
            .limit(int(limit or 50))
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
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
        q = (
            sb.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("user_id", int(user_id))
            .order("created_at", desc=True)
            .limit(int(limit or 20))
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
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
        res = (
            sb.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("user_id", int(user_id))
            .eq("id", int(job_id))
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
    queued -> running (atomic via WHERE status='queued')
    """
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
        res = (
            sb.table(TABLE_ASYNC_JOBS)
            .update(
                {
                    "status": "running",
                    "attempts": int(attempts),
                    "locked_at": _now_iso(),
                    "locked_by": str(worker_id),
                    "started_at": _now_iso(),
                    "updated_at": _now_iso(),
                }
            )
            .eq("id", int(job_id))
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
    fields: Dict[str, Any] = {
        "status": str(status),
        "updated_at": _now_iso(),
        "finished_at": _now_iso(),
    }
    if result is not None:
        fields["result"] = result
    if error is not None:
        fields["error"] = str(error)
    if progress is not None:
        fields["progress"] = int(progress)

    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
        res = sb.table(TABLE_ASYNC_JOBS).update(fields).eq("id", int(job_id)).execute()
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] update_finished error:", repr(e))
        return None


def db_find_active_job_by_dedupe(
    user_id: int,
    dedupe_key: str,
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> Optional[Dict[str, Any]]:
    if not dedupe_key:
        return None
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
        res = (
            sb.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("user_id", int(user_id))
            .eq("dedupe_key", str(dedupe_key))
            .in_("status", ["queued", "running"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] find_by_dedupe error:", repr(e))
        return None


def db_user_has_running_job(
    user_id: int,
    *,
    user_jwt: Optional[str] = None,
    service: bool = True,
) -> bool:
    try:
        sb = get_sb(user_jwt=user_jwt, service=service, caller="async_jobs")
        res = (
            sb.table(TABLE_ASYNC_JOBS)
            .select("id")
            .eq("user_id", int(user_id))
            .eq("status", "running")
            .limit(1)
            .execute()
        )
        return bool(res.data or [])
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] user_has_running error:", repr(e))
        return False


def _try_lock_job_row(row: Dict[str, Any], *, worker_id: str) -> Optional[Dict[str, Any]]:
    jid = row.get("id")
    uid = row.get("user_id")
    if jid is None or uid is None:
        return None

    try:
        job_id = int(jid)
        user_id = int(uid)
    except Exception:
        return None

    # user-level lock (cache v pick funkciách)
    # attempts inkrementujeme na základe row.attempts
    try:
        attempts_old = int(row.get("attempts") or 0)
    except Exception:
        attempts_old = 0

    return db_mark_job_running(
        job_id=job_id,
        worker_id=worker_id,
        attempts=attempts_old + 1,
        user_jwt=None,
        service=True,
    )


def db_pick_next_queued_job_for_user(
    user_id: int,
    *,
    worker_id: str,
    user_jwt: Optional[str] = None,
    service: bool = True,
    max_scan: int = 5,
) -> Optional[Dict[str, Any]]:
    """
    ✅ Zjednotený názov.
    Worker-safe: vyberie queued job pre usera a pokúsi sa ho locknúť.
    """
    # ak user už má running -> netreba ani selectovať kandidátov
    if db_user_has_running_job(int(user_id), user_jwt=user_jwt, service=service):
        return None

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
        locked = _try_lock_job_row(r, worker_id=str(worker_id))
        if locked:
            return locked

    return None


def db_pick_next_queued_job_global(
    *,
    worker_id: str,
    user_jwt: Optional[str] = None,
    service: bool = True,
    max_scan: int = 10,
) -> Optional[Dict[str, Any]]:
    """
    ✅ Zjednotený názov.
    Worker-safe: vyberie queued job globálne a pokúsi sa ho locknúť.
    Zároveň chráni user-level serializáciu (neberie job userovi, ktorý už má running).
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

    # cache: aby sme nevolali user_has_running 10x pre rovnakého usera
    running_cache: Dict[int, bool] = {}

    for r in rows:
        if not isinstance(r, dict):
            continue

        uid = r.get("user_id")
        if uid is None:
            continue
        try:
            user_id = int(uid)
        except Exception:
            continue

        if user_id not in running_cache:
            running_cache[user_id] = db_user_has_running_job(user_id, user_jwt=user_jwt, service=service)

        if running_cache[user_id]:
            continue

        locked = _try_lock_job_row(r, worker_id=str(worker_id))
        if locked:
            return locked

    return None