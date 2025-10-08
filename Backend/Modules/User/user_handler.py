from typing import Optional
from Modules.SQL.db_handler import get_service_client
from backend.Modules.config import (
    TABLE_USERS,
    TABLE_USERS_PROFILE,
    TABLE_USERS_ZONES,
    TABLE_USERS_THRESHOLDS,
    TABLE_USERS_BESTS,
    TABLE_USERS_RECOVERY,
)

supabase = get_service_client()

def create_user(name: str, age: int, mail_address: str,
                display_name: Optional[str] = None, auth_uid: Optional[str] = None):
    exists = supabase.table(TABLE_USERS).select("id").eq("mail_address", mail_address).limit(1).execute()
    if exists.data:
        print(f"E-mail {mail_address} už existuje. Nevkladám.")
        return exists.data

    payload = {
        "name": name,
        "age": age,
        "mail_address": mail_address,
        "display_name": display_name or name,
    }
    if auth_uid:
        payload["auth_uid"] = auth_uid

    resp = supabase.table(TABLE_USERS).insert(payload).execute()
    print("Úspešne vložené:", resp.data)
    return resp.data

def get_user_by_email(mail_address: str):
    return supabase.table(TABLE_USERS).select("*").eq("mail_address", mail_address).limit(1).execute().data

def update_user(mail_address: str, **fields):
    if not fields:
        return []
    return supabase.table(TABLE_USERS).update(fields).eq("mail_address", mail_address).execute().data

def delete_user(mail_address: str):
    return supabase.table(TABLE_USERS).delete().eq("mail_address", mail_address).execute().data

def get_or_create_user_id(email: str, *,
                          name: str = "New User",
                          display_name: Optional[str] = None,
                          auth_uid: Optional[str] = None) -> int:
    user = get_user_by_email(email)
    if not user:
        print(f"Užívateľ {email} neexistuje, vytváram ho.")
        create_user(
            name=name,
            age=0,
            mail_address=email,
            display_name=display_name or name,
            auth_uid=auth_uid
        )
        user = get_user_by_email(email)
        if not user:
            raise RuntimeError("Nepodarilo sa vytvoriť používateľa")
    return user[0]["id"]

# --- USER PROFILE ---
def insert_or_update_user_profile(user_id: int, **fields):
    payload = {"user_id": user_id, **fields}
    resp = supabase.table(TABLE_USERS_PROFILE).upsert(payload).execute()
    print("✅ user_profile uložené:", resp.data)
    return resp.data

def get_user_profile(user_id: int):
    return supabase.table(TABLE_USERS_PROFILE).select("*").eq("user_id", user_id).limit(1).execute().data


# --- USER ZONES ---
def insert_or_update_user_zones(user_id: int, **fields):

    payload = {"user_id": user_id, **fields}
    resp = supabase.table(TABLE_USERS_ZONES).upsert(payload).execute()
    print("✅ user_zones uložené:", resp.data)
    return resp.data

def get_user_zones(user_id: int):
    return supabase.table(TABLE_USERS_ZONES).select("*").eq("user_id", user_id).limit(1).execute().data


# --- USER THRESHOLDS ---
def insert_or_update_user_thresholds(user_id: int, **fields):

    payload = {"user_id": user_id, **fields}
    resp = supabase.table(TABLE_USERS_THRESHOLDS).upsert(payload).execute()
    print("✅ user_thresholds uložené:", resp.data)
    return resp.data

def get_user_thresholds(user_id: int):
    return supabase.table(TABLE_USERS_THRESHOLDS).select("*").eq("user_id", user_id).limit(1).execute().data


# --- USER BESTS ---
def insert_or_update_user_bests(user_id: int, **fields):

    payload = {"user_id": user_id, **fields}
    resp = supabase.table(TABLE_USERS_BESTS).upsert(payload).execute()
    print("✅ user_bests uložené:", resp.data)
    return resp.data

def get_user_bests(user_id: int):
    return supabase.table(TABLE_USERS_BESTS).select("*").eq("user_id", user_id).limit(1).execute().data

# --- USER DAILY RECOVERY ---
def insert_or_update_user_recovery(user_id: int, **fields):

    payload = {"user_id": user_id, **fields}
    resp = supabase.table(TABLE_USERS_RECOVERY).upsert(payload).execute()
    print("✅ user_daily_recovery uložené:", resp.data)
    return resp.data

def get_user_recovery(user_id: int):
    return supabase.table(TABLE_USERS_RECOVERY).select("*").eq("user_id", user_id).limit(1).execute().data

