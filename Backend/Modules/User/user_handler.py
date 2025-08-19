from Modules.SQL.db_handler import get_client

TABLE_USERS = "users"
supabase = get_client()


def create_user(name: str, age: int, mail_address: str, primary_sport: str):
    """
    Vytvorí používateľa bez PR polí (tie sa doplnia neskôr zo Stravy alebo ručne).
    Ak už existuje mail, nič nevkladá.
    """
    check = supabase.table(TABLE_USERS).select("id").eq("mail_address", mail_address).execute()
    if check.data:
        print(f"E-mail {mail_address} už existuje. Nevkladám.")
        return None

    response = supabase.table(TABLE_USERS).insert({
        "name": name,
        "age": age,
        "mail_address": mail_address,
        "primary_sport": primary_sport,
    }).execute()

    print("Úspešne vložené:", response.data)
    return response.data


def get_user_by_email(mail_address: str):
    resp = supabase.table(TABLE_USERS).select("*").eq("mail_address", mail_address).limit(1).execute()
    return resp.data


def update_user(mail_address: str, **fields):
    """
    Univerzálne updatuje zadané polia (vrátane voliteľných PR polí, ak ich odošleš).
    Príklady:
      update_user("x@x.com", age=29)
      update_user("x@x.com", best_5k=1393, best_5k_id=15342917851)
    """
    if not fields:
        return []
    resp = supabase.table(TABLE_USERS).update(fields).eq("mail_address", mail_address).execute()
    return resp.data


def delete_user(mail_address: str):
    resp = supabase.table(TABLE_USERS).delete().eq("mail_address", mail_address).execute()
    return resp.data


def get_or_create_user_id(email: str):
    """
    Vráti id používateľa podľa emailu; ak neexistuje, vytvorí ho bez PR polí.
    """
    user = get_user_by_email(email)
    if not user:
        print(f"Užívateľ {email} neexistuje, vytváram ho.")
        create_user("Patrik Mbontar", 28, email, "running")
        user = get_user_by_email(email)
        if not user:
            raise RuntimeError("Nepodarilo sa vytvoriť používateľa")
    return user[0]['id']


def user_crud():
    """
    Krátke demo (bez PR polí). Necháva tvoje pôvodné volania, ale bez best_5k_time.
    """
    print("=== User CRUD Demo ===")
    create_user("Patrik Mbontar", 28, "patrikmbontar@gmail.com", "running")
    user = get_user_by_email("patrikmbontar@gmail.com")
    print("Načítaný používateľ:", user)
    update_user("patrikmbontar@gmail.com", age=29)
    # delete_user("patrikmbontar@gmail.com")


def get_current_user_id(email: str):
    user = get_user_by_email(email)
    if not user:
        raise ValueError(f"Používateľ s emailom {email} neexistuje.")
    return user[0]["id"]


# --- Voliteľné helpery na PR (ručný update), ak chceš rýchle volania z kódu/UI ---

def set_best_5k(email: str, seconds: int, activity_id: int | None = None):
    """
    Nastaví osobák na 5 km v sekundách + voliteľne zdrojové activity_id.
    """
    fields = {"best_5k": int(seconds)}
    if activity_id is not None:
        fields["best_5k_id"] = int(activity_id)
    return update_user(email, **fields)


def set_best_400(email: str, seconds: int, activity_id: int | None = None):
    fields = {"best_400": int(seconds)}
    if activity_id is not None:
        fields["best_400_id"] = int(activity_id)
    return update_user(email, **fields)
