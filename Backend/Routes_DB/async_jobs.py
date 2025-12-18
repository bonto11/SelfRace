# backend/Routes_DB/async_jobs.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_ASYNC_JOBS

sb = get_client()


def db_insert_job(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    INSERT do async_jobs.

    Očakáva minimálne:
      - user_id: int
      - user_uid: UUID (string)
      - kind: str
      - status: str (typicky 'queued')
      - input: jsonb (dict)

    Ostatné stĺpce (attempts, max_attempts, progress, timestamps)
    nechávame na defaulty, alebo doplníme podľa potreby v Services.
    """
    try:
        res = sb.table(TABLE_ASYNC_JOBS).insert(row).execute()
        data = res.data or []
        return data[0] if data else None
    except Exception as e:  # noqa: BLE001
        print("[DB-JOBS] insert error:", repr(e))
        return None


def db_get_active_jobs(
    user_id: int,
    kinds: Optional[List[str]] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Aktívne joby pre usera – status v ('queued', 'running').
    """
    try:
        q = (
            sb.table(TABLE_ASYNC_JOBS)
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
    """
    Posledné joby (akýkoľvek status) pre usera.
    """
    try:
        q = (
            sb.table(TABLE_ASYNC_JOBS)
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


def db_get_job_by_id(
    user_id: int,
    job_id: int,
) -> Optional[Dict[str, Any]]:
    """
    Jednotlivý job podľa ID (PK) – istíme sa aj user_id.
    """
    try:
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