# Modules/SQL/db_handler.py

from typing import Optional

from supabase import create_client

from Configs.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPABASE_ANON_KEY


# ------------------------------------------------------------------
# SERVICE CLIENT – obchádza RLS (SERVICE_ROLE key)
# ------------------------------------------------------------------

_service_client = None  # lazy init, zdieľaný v rámci procesu


def get_service_client():
    """
    Supabase client so SERVICE_ROLE kľúčom – úplne obchádza RLS.

    Používaj ho:
      - v existujúcich servisoch (sync, worker, webhooks, migrácie),
      - tam, kde ešte nemáš JWT / RLS pripravené.

    NEpoužívaj ho tam, kde očakávaš, že RLS má chrániť user dáta.
    """
    global _service_client
    if _service_client is None:
        _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
    return _service_client


# ------------------------------------------------------------------
# USER CLIENT – RLS (ANON key + JWT)
# ------------------------------------------------------------------

def get_user_client(user_jwt: str):
    """
    Vráti Supabase client s RLS, autentifikovaný ako konkrétny používateľ.

    - používa ANON kľúč
    - nastaví JWT cez postgrest.auth(), takže RLS vie, kto je user (auth.uid()).
    """
    if not user_jwt:
        raise RuntimeError("get_user_client() vyžaduje ne-prázdny user_jwt")

    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(user_jwt)
    return client


# ------------------------------------------------------------------
# Hlavný entry point – spätná kompatibilita pre get_client()
# ------------------------------------------------------------------

def get_client(
    user_jwt: Optional[str] = None,
    *,
    service: bool = False,
):
    """
    Unified helper:

      get_client(service=True)
        → SERVICE_ROLE client (mimo RLS).

      get_client(user_jwt="...")
        → RLS client pre konkrétneho používateľa.

      get_client()
        → BEZ parametrov → SERVICE_ROLE client
           (spätná kompatibilita – všetok starý kód ide cez service role).

    V praxi:
      - starý kód nechaj len `get_client()` → stále používa service role.
      - nový/prechodný kód môže začať používať:
          sb = get_client(user_jwt=jwt)          # RLS
        alebo
          sb = get_client(service=True)          # explicitný service
    """

    # 1) explicitný service mód
    if service:
        return get_service_client()

    # 2) ak máme user_jwt → RLS klient
    if user_jwt is not None:
        return get_user_client(user_jwt)

    # 3) default (bez parametrov) → SERVICE_ROLE
    #    = presne tvoje doterajšie správanie
    return get_service_client()