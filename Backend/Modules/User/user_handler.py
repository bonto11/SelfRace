from Modules.SQL.db_handler import get_client

TABLE_USERS = "users"
supabase = get_client()


def create_user(name: str, age: int, best_5k_time: str, mail_address: str, primary_sport: str):
    check = supabase.table(TABLE_USERS).select("id").eq("mail_address", mail_address).execute()

    if check.data:
        print(f"E-mail {mail_address} už existuje. Nevkladám.")
        return None

    response = supabase.table(TABLE_USERS).insert({
        "name": name,
        "age": age,
        "best_5k_time": best_5k_time,
        "mail_address": mail_address,
        "primary_sport": primary_sport,
    }).execute()

    print("Úspešne vložené:", response.data)
    return response.data

def get_user_by_email(mail_address: str):
    response = supabase.table(TABLE_USERS).select("*").eq("mail_address", mail_address).execute()
    return response.data

def update_user(mail_address: str, **fields):
    response = supabase.table(TABLE_USERS).update(fields).eq("mail_address", mail_address).execute()
    return response.data

def delete_user(mail_address: str):
    response = supabase.table(TABLE_USERS).delete().eq("mail_address", mail_address).execute()
    return response.data

def get_or_create_user_id(email: str):
    user = get_user_by_email(email)
    if not user:
        print(f"Užívateľ {email} neexistuje, vytváram ho.")
        create_user("Patrik Mbontar", 28, "00:23:18", email, "running")
        user = get_user_by_email(email)
        if not user:
            raise RuntimeError("Nepodarilo sa vytvoriť používateľa")
    return user[0]['id']

def user_crud():
    print("=== User CRUD Demo ===")
    create_user("Patrik Mbontar", 28, "00:23:18", "patrikmbontar@gmail.com", "running")
    user = get_user_by_email("patrik.mbontar@gmail.com")
    print("Načítaný používateľ:", user)
    update_user("patrik.mbontar@gmail.com", age=29, best_5k_time="00:16:30")
    # delete_user("patrik.mbontar@gmail.com")
    
def get_current_user_id(email: str):
    user = get_user_by_email(email)
    if not user:
        raise ValueError(f"Používateľ s emailom {email} neexistuje.")
    return user[0]["id"]
