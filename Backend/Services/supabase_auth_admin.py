from __future__ import annotations

from typing import Any, Dict, List, Optional

from Modules.Supabase.client import get_service_client

supabase = get_service_client()

def admin_delete_auth_users(auth_uids: List[str]) -> Dict[str, Any]:
    """
    Zmaže userov v Supabase Auth (admin).
    Vracia report: deleted / failed.
    """
    deleted: List[str] = []
    failed: List[Dict[str, str]] = []

    for uid in auth_uids:
        if not uid:
            continue
        try:
            # supabase-py v2: supabase.auth.admin.delete_user(uid)
            supabase.auth.admin.delete_user(uid)  # type: ignore[attr-defined]
            deleted.append(uid)
        except Exception as e:  # noqa: BLE001
            failed.append({"auth_uid": uid, "error": str(e)})

    return {"deleted": deleted, "failed": failed}