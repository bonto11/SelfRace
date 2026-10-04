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

def admin_get_auth_user_created_at(auth_uid: str) -> Optional[str]:
    """Kedy si user založil účet (ISO z Supabase Auth), alebo None."""
    if not auth_uid:
        return None
    try:
        res = supabase.auth.admin.get_user_by_id(auth_uid)  # type: ignore[attr-defined]
        user = getattr(res, "user", None) or res
        created = getattr(user, "created_at", None)
        return str(created) if created else None
    except Exception as e:  # noqa: BLE001
        print(f"[AUTH-ADMIN] get_user_by_id failed uid={auth_uid}: {repr(e)}")
        return None
