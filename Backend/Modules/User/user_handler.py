from typing import Optional
from Modules.SQL.db_handler import get_service_client

supabase = get_service_client()
TABLE_USERS = "users"

def create_user(name: str, age: int, mail_address: str, primary_sport: str,
                display_name: Optional[str] = None, auth_uid: Optional[str] = None):
    exists = supabase.table(TABLE_USERS).select("id").eq("mail_address", mail_address).limit(1).execute()
    if exists.data:
        print(f"E-mail {mail_address} už existuje. Nevkladám.")
        return exists.data

    payload = {
        "name": name,
        "age": age,
        "mail_address": mail_address,
        "primary_sport": primary_sport,
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
                          primary_sport: str = "running",
                          display_name: Optional[str] = None,
                          auth_uid: Optional[str] = None) -> int:
    user = get_user_by_email(email)
    if not user:
        print(f"Užívateľ {email} neexistuje, vytváram ho.")
        create_user(
            name=name,
            age=0,
            mail_address=email,
            primary_sport=primary_sport,
            display_name=display_name or name,
            auth_uid=auth_uid
        )
        user = get_user_by_email(email)
        if not user:
            raise RuntimeError("Nepodarilo sa vytvoriť používateľa")
    return user[0]["id"]
