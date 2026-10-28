# Services/admin_users.py
"""
Zásahy admina do účtov – okamžité zmazanie účtu.

PREČO: bežné zmazanie (Services/account.py) len naplánuje požiadavku s
lehotou DELETE_GRACE_DAYS a fyzicky maže cron (`account_hard_delete`). Na
testovanie s jedným mailom (registrácia → zmazanie → registrácia) admin
nechce čakať týždeň ani ručne lozit do DB. Tu sa spraví to isté ako v
požiadavke usera (odpojenie Stravy a Stripe), lehota sa nastaví na „teraz“
a hneď sa spustí rovnaké tvrdé zmazanie, ale len pre tohto jedného usera.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from DB.account import db_upsert_account_delete_request
from DB.users import db_get_user_role
from Modules.Supabase.auth import AuthCtx
from Services.user_overview import service_user_overview


def service_admin_force_delete_user(user_id: int, confirm_email: str, *, ctx: AuthCtx) -> Dict[str, Any]:
    uid = int(user_id)
    row = next((r for r in service_user_overview(ctx=ctx)["users"] if int(r["id"]) == uid), None)
    if not row:
        return {"ok": False, "code": "user_not_found"}

    # druhý krok potvrdenia – admin musí opísať e-mail mazaného účtu
    email = str(row.get("email") or "").strip().lower()
    if not email or email != str(confirm_email or "").strip().lower():
        return {"ok": False, "code": "confirm_mismatch"}

    try:
        if (db_get_user_role(uid, ctx=ctx) or "").upper() == "ADMIN":
            return {"ok": False, "code": "cannot_delete_admin"}
    except Exception as e:  # noqa: BLE001
        print(f"[ADMIN-USERS] role check failed user={uid}: {repr(e)}")
        return {"ok": False, "code": "role_check_failed"}

    # rovnaké odpojenia ako pri požiadavke usera – chyba nezastaví zmazanie
    report: Dict[str, Any] = {}
    try:
        from Modules.Strava.strava_disconnect_helpers import disconnect_strava_account

        report["strava"] = disconnect_strava_account(user_id=uid, reason="admin_force_delete", purge_data=True)
    except Exception as e:  # noqa: BLE001
        print(f"[ADMIN-USERS] strava disconnect failed user={uid}: {repr(e)}")
        report["strava"] = {"error": repr(e)}
    try:
        from Modules.Stripe.billing_stripe import disconnect_stripe_subscription

        report["stripe"] = disconnect_stripe_subscription(user_id=uid, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[ADMIN-USERS] stripe disconnect failed user={uid}: {repr(e)}")
        report["stripe"] = {"error": repr(e)}

    # lehota „teraz“ (minútu dozadu), aby ju SQL funkcia brala ako splatnú
    due = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    try:
        db_upsert_account_delete_request(uid, due, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[ADMIN-USERS] delete request failed user={uid}: {repr(e)}")
        return {"ok": False, "code": "delete_request_failed"}

    try:
        from Services.maintenance import service_account_hard_delete

        result = service_account_hard_delete(dry_run=False, only_user_id=uid, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[ADMIN-USERS] hard delete failed user={uid}: {repr(e)}")
        return {"ok": False, "code": "hard_delete_failed", "report": report}

    items = (result.get("items") or []) if isinstance(result, dict) else []
    failed = next((it for it in items if isinstance(it, dict) and it.get("error")), None)
    if failed:
        # SQL funkcia usera vrátila späť (chyba pri mazaní) – dáta aj auth účet ostali
        print(f"[ADMIN-USERS] hard delete error user={uid}: {failed.get('error')}")
        return {"ok": False, "code": "hard_delete_failed", "detail": failed.get("error"), "report": report}
    if not items:
        # SQL funkcia nikoho nezmazala – požiadavka ostáva splatná, zmaže ju najbližší cron
        print(f"[ADMIN-USERS] hard delete removed nobody user={uid}: {result}")
        return {"ok": False, "code": "hard_delete_noop", "report": report}
    print(f"[ADMIN-USERS] force deleted user={uid} email={email}")
    return {"ok": True, "user_id": uid, "email": email, "auth_delete": result.get("auth_delete"), "report": report}
