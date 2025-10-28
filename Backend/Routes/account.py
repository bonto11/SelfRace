# backend/Routes/account.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from Modules.SQL.db_handler import get_client
from backend.Configs.config import (
    TABLE_USERS_STATIC,
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_LAPS,
    TABLE_ACTIVITIES_SPLITS,
    TABLE_USERS_BESTS,
    TABLE_USERS_NOTES,
)

router = APIRouter(prefix="/account", tags=["account"])
svc = get_client()  # service-role client (má prístup k auth.admin)

# ---------- Pydantic request modely ----------

class ReqDelete(BaseModel):
    user_id: int        # interné numerické ID v tvojich tabuľkách
    user_uid: str       # Supabase Auth user id (UUID string)

class ReqCancel(BaseModel):
    user_id: int


# ---------- Endpoints ----------

@router.post("/request-delete")
def request_delete(req: ReqDelete):
    """
    Označí účet na zmazanie (hold) – uloží timestamp do users_static.deletion_requested_at.
    Pri ďalšom prihlásení to môžeš zrušiť volaním /cancel-delete.
    """
    try:
        # over, že user existuje a sedí UID
        u = (
            svc.table(TABLE_USERS_STATIC)
            .select("user_id,user_uid")
            .eq("user_id", req.user_id)
            .limit(1)
            .execute()
        )
        if not u.data:
            raise HTTPException(status_code=404, detail="User not found")
        if u.data[0].get("user_uid") != req.user_uid:
            raise HTTPException(status_code=403, detail="User mismatch")

        # označ na zmazanie
        svc.table(TABLE_USERS_STATIC).update(
            {"deletion_requested_at": datetime.now(timezone.utc).isoformat()}
        ).eq("user_id", req.user_id).execute()

        # voliteľne nastav flag v Auth meta (ak zlyhá, nijak to nevadí)
        try:
            # supabase-py môže mať signatúry rôzne podľa verzie – skúsime obidva tvary
            try:
                svc.auth.admin.update_user_by_id(
                    req.user_uid, {"user_metadata": {"deletion_hold": True}}
                )
            except TypeError:
                svc.auth.admin.update_user_by_id(
                    req.user_uid, attributes={"user_metadata": {"deletion_hold": True}}
                )
        except Exception as e:
            print("auth meta update failed:", e)

        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel-delete")
def cancel_delete(req: ReqCancel):
    """
    Zruší hold (napr. po úspešnom prihlásení).
    """
    try:
        svc.table(TABLE_USERS_STATIC).update(
            {"deletion_requested_at": None}
        ).eq("user_id", req.user_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/purge-due")
def purge_due(days: int = 30):
    """
    Cron: zmaž účty, ktoré požiadali o zmazanie pred N dňami.
    Zmaže dáta vo vlastných tabuľkách a následne Auth používateľa.
    """
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        cand = (
            svc.table(TABLE_USERS_STATIC)
            .select("user_id,user_uid,deletion_requested_at")
            .lt("deletion_requested_at", cutoff)
            .not_.is_("deletion_requested_at", "null")
            .execute()
        )

        purged_cnt = 0
        for row in (cand.data or []):
            uid_str = row.get("user_uid")
            uid_int = row.get("user_id")

            # mazanie dát – ak nemáš FK s ON DELETE CASCADE, zachovaj poradie
            try:
                svc.table(TABLE_ACTIVITIES_LAPS).delete().eq("user_id", uid_int).execute()
                svc.table(TABLE_ACTIVITIES_SPLITS).delete().eq("user_id", uid_int).execute()
                svc.table(TABLE_ACTIVITIES_SUMMARY).delete().eq("user_id", uid_int).execute()
                svc.table(TABLE_USERS_BESTS).delete().eq("user_id", uid_int).execute()
                svc.table(TABLE_USERS_NOTES).delete().eq("user_id", uid_int).execute()
            except Exception as e:
                print("purge data err:", e)

            # vymaž profilový riadok
            try:
                svc.table(TABLE_USERS_STATIC).delete().eq("user_id", uid_int).execute()
            except Exception as e:
                print("purge profile err:", e)

            # Auth user
            try:
                if uid_str:
                    svc.auth.admin.delete_user(uid_str)
            except Exception as e:
                print("auth delete err:", e)

            purged_cnt += 1

        return {"success": True, "purged": purged_cnt}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))