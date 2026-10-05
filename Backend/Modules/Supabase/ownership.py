# Modules/Supabase/ownership.py
from __future__ import annotations

from DB.users import db_get_auth_uid
from Modules.Supabase.auth import AuthCtx, service_ctx
from Modules.Supabase.client import get_service_client


def is_owner(ctx: AuthCtx, user_id: int) -> bool:
    """
    Patrí JWT v ctx userovi s týmto user_id?

    PREČO explicitná kontrola: endpointy, ktoré pracujú cez service role
    (Strava účty, intervals_accounts), RLS nechráni – bez nej by ktokoľvek
    prihlásený vedel s cudzím user_id čítať alebo mazať cudzie napojenie.
    """
    if not ctx.is_user or not ctx.jwt:
        return False
    try:
        res = get_service_client().auth.get_user(ctx.jwt)
        auth_uid = str(getattr(getattr(res, "user", None), "id", "") or "")
        expected = db_get_auth_uid(int(user_id), ctx=service_ctx("ownership.is_owner"))
        return bool(auth_uid) and auth_uid == (expected or "")
    except Exception as e:  # noqa: BLE001
        print(f"[OWNERSHIP] check failed user={user_id}: {repr(e)}")
        return False
