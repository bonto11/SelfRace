from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from Modules.Supabase.client import get_sb
from Modules.Supabase.auth import AuthCtx, service_ctx
from Configs.config import TABLE_ASYNC_JOBS


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sb_service(caller: str):
    """
    ALWAYS service role client (bypass RLS).
    ctx z FE tu ignorujeme zámerne.
    """
    return get_sb(service_ctx(caller=caller), caller=caller)


def db_insert_job(row: Dict[str, Any], *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    try:
        sb = _sb_service("async_jobs.db_insert_job")
        res = sb.table(TABLE_ASYNC_JOBS).insert(row).execute()
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] insert error type:", type(e))
        print("[DB-JOBS] insert error repr:", repr(e))
        raise


def db_get_active_jobs(
    user_id: int,
    job_types: Optional[List[str]] = None,
    limit: int = 50,
    *,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    try:
        sb = _sb_service("async_jobs.db_get_active_jobs")
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
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    try:
        sb = _sb_service("async_jobs.db_get_recent_jobs")
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
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    try:
        sb = _sb_service("async_jobs.db_get_job_by_id")
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
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """
    queued -> running (atomic via WHERE status='queued')
    """
    try:
        sb = _sb_service("async_jobs.db_mark_job_running")
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
    ctx: AuthCtx,
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
        sb = _sb_service("async_jobs.db_update_job_finished")
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
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    if not dedupe_key:
        return None
    try:
        sb = _sb_service("async_jobs.db_find_active_job_by_dedupe")
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


def db_user_has_running_job(user_id: int, *, ctx: AuthCtx) -> bool:
    try:
        sb = _sb_service("async_jobs.db_user_has_running_job")
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


def _try_lock_job_row(ctx: AuthCtx, row: Dict[str, Any], *, worker_id: str) -> Optional[Dict[str, Any]]:
    jid = row.get("id")
    userId = row.get("user_id")
    if jid is None or userId is None:
        return None

    try:
        job_id = int(jid)
    except Exception:
        return None

    try:
        attempts_old = int(row.get("attempts") or 0)
    except Exception:
        attempts_old = 0

    return db_mark_job_running(
        job_id=job_id,
        worker_id=str(worker_id),
        attempts=attempts_old + 1,
        ctx=ctx,
    )


def db_pick_next_queued_job_for_user(
    user_id: int,
    *,
    worker_id: str,
    ctx: AuthCtx,
    max_scan: int = 5,
) -> Optional[Dict[str, Any]]:
    if db_user_has_running_job(ctx=ctx, user_id=user_id):
        return None

    now_iso = _now_iso()
    try:
        sb = _sb_service("async_jobs.db_pick_next_queued_job_for_user")
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
        locked = _try_lock_job_row(ctx=ctx, row=r, worker_id=str(worker_id))
        if locked:
            return locked

    return None


def db_pick_next_queued_job_global(
    *,
    worker_id: str,
    ctx: AuthCtx,
    max_scan: int = 10,
) -> Optional[Dict[str, Any]]:
    now_iso = _now_iso()
    try:
        sb = _sb_service("async_jobs.db_pick_next_queued_job_global")
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

    running_cache: Dict[int, bool] = {}

    for r in rows:
        if not isinstance(r, dict):
            continue

        userId = r.get("user_id")
        if userId is None:
            continue
        try:
            uid = int(userId)
        except Exception:
            continue

        if uid not in running_cache:
            running_cache[uid] = db_user_has_running_job(ctx=ctx, user_id=uid)

        if running_cache[uid]:
            continue

        locked = _try_lock_job_row(ctx=ctx, row=r, worker_id=str(worker_id))
        if locked:
            return locked

    return None