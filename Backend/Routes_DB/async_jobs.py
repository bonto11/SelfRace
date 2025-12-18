# backend/Routes_DB/async_jobs.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_ASYNC_JOBS

supabase = get_client()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_enqueue_job(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        res = supabase.table(TABLE_ASYNC_JOBS).insert(row).execute()
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] enqueue error:", repr(e))
        return None


def db_get_active_jobs(
    user_id: int,
    kinds: Optional[List[str]] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    try:
        q = (
            supabase.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("user_id", user_id)
            .in_("status", ["queued", "running"])
            .order("created_at", desc=True)
            .limit(limit)
        )
        if kinds:
            q = q.in_("kind", kinds)
        res = q.execute()
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] get_active error:", repr(e))
        return []


def db_get_recent_jobs(
    user_id: int,
    kinds: Optional[List[str]] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    try:
        q = (
            supabase.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if kinds:
            q = q.in_("kind", kinds)
        res = q.execute()
        return res.data or []
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] get_recent error:", repr(e))
        return []


def db_get_job_by_id(user_id: int, job_id: str) -> Optional[Dict[str, Any]]:
    try:
        res = (
            supabase.table(TABLE_ASYNC_JOBS)
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


def db_claim_next_job(
    *,
    kinds: Optional[List[str]] = None,
    worker_id: str,
    limit_scan: int = 25,
) -> Optional[Dict[str, Any]]:
    """
    Claim najbližší job v stave 'queued' (run_after <= now alebo null),
    ktorý nie je locknutý. Robí to v 2 krokoch (select -> update), takže
    je to "best effort". Na produkciu sa dá spraviť RPC s atomickým lockom,
    ale toto ti už dnes rozbehá background joby.
    """
    try:
        q = (
            supabase.table(TABLE_ASYNC_JOBS)
            .select("*")
            .eq("status", "queued")
            .is_("locked_at", "null")
            .order("created_at", desc=False)
            .limit(limit_scan)
        )
        if kinds:
            q = q.in_("kind", kinds)

        res = q.execute()
        rows = res.data or []
        if not rows:
            return None

        now_iso = _now_iso()

        # zober prvý, ktorý je "ready"
        candidate = None
        for r in rows:
            ra = r.get("run_after")
            if not ra:
                candidate = r
                break
            # run_after je timestamptz string -> lex compare ISO funguje, ale radšej iba slice:
            if str(ra) <= now_iso:
                candidate = r
                break

        if not candidate:
            return None

        job_id = str(candidate.get("id"))
        if not job_id:
            return None

        # pokus o lock
        upd = (
            supabase.table(TABLE_ASYNC_JOBS)
            .update(
                {
                    "status": "running",
                    "locked_at": now_iso,
                    "locked_by": worker_id,
                    "started_at": now_iso,
                    "updated_at": now_iso,
                    "attempts": int(candidate.get("attempts") or 0) + 1,
                    "progress": 0,
                }
            )
            .eq("id", job_id)
            .eq("status", "queued")
            .is_("locked_at", "null")
            .execute()
        )
        data = upd.data or []
        return data[0] if data else None

    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] claim_next error:", repr(e))
        return None


def db_update_job_progress(
    *,
    job_id: str,
    progress: int,
    status: Optional[str] = None,
    locked_by: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    try:
        patch: Dict[str, Any] = {
            "progress": int(progress),
            "updated_at": _now_iso(),
        }
        if status:
            patch["status"] = status
        q = supabase.table(TABLE_ASYNC_JOBS).update(patch).eq("id", job_id)
        if locked_by:
            q = q.eq("locked_by", locked_by)
        res = q.execute()
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] update_progress error:", repr(e))
        return None


def db_finish_job_success(
    *,
    job_id: str,
    result: Dict[str, Any],
    locked_by: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    try:
        now_iso = _now_iso()
        patch: Dict[str, Any] = {
            "status": "succeeded",
            "result": result,
            "error": None,
            "progress": 100,
            "finished_at": now_iso,
            "updated_at": now_iso,
            "locked_at": None,
            "locked_by": None,
        }
        q = supabase.table(TABLE_ASYNC_JOBS).update(patch).eq("id", job_id)
        if locked_by:
            q = q.eq("locked_by", locked_by)
        res = q.execute()
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] finish_success error:", repr(e))
        return None


def db_finish_job_error(
    *,
    job_id: str,
    error: str,
    locked_by: Optional[str] = None,
    retry_after_iso: Optional[str] = None,
    max_attempts: Optional[int] = None,
    attempts: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """
    Ak attempts < max_attempts -> vráti do 'queued' (retry),
    inak 'failed'.
    """
    try:
        now_iso = _now_iso()
        a = int(attempts or 0)
        m = int(max_attempts or 3)

        will_retry = a < m
        status = "queued" if will_retry else "failed"

        patch: Dict[str, Any] = {
            "status": status,
            "error": error,
            "updated_at": now_iso,
            "progress": 0 if will_retry else 100,
            "locked_at": None,
            "locked_by": None,
        }
        if not will_retry:
            patch["finished_at"] = now_iso
        if will_retry and retry_after_iso:
            patch["run_after"] = retry_after_iso

        q = supabase.table(TABLE_ASYNC_JOBS).update(patch).eq("id", job_id)
        if locked_by:
            q = q.eq("locked_by", locked_by)

        res = q.execute()
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] finish_error error:", repr(e))
        return None