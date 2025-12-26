# Modules/SQL/db_handler.py

from typing import Optional

from contextvars import ContextVar
from supabase import create_client

from Configs.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPABASE_ANON_KEY


# ------------------------------------------------------------------
# Context: aktuálny user JWT (nastavíš ho v middleware/dependency)
# ------------------------------------------------------------------

_current_user_jwt: ContextVar[Optional[str]] = ContextVar(
    "current_user_jwt",
    default=None,
)


def set_current_user_jwt(jwt: Optional[str]) -> None:
    """
    Nastav JWT aktuálneho používateľa pre tento request/thread.

    Použitie (FastAPI príklad):

        from fastapi import Depends, Request
        from Modules.SQL.db_handler import set_current_user_jwt

        async def inject_user_jwt(request: Request):
            token = extrahuj_jwt_z_headeru_aleho_cookies(...)
            set_current_user_jwt(token)
    """
    _current_user_jwt.set(jwt)


# ------------------------------------------------------------------
# Service client (mimo RLS) – používa SERVICE_ROLE key
# ------------------------------------------------------------------

_service_client = None  # lazy init, 1 instance


def get_service_client():
    """
    Supabase client so SERVICE_ROLE kľúčom – úplne obchádza RLS.
    Používaj IBA TAM, kde vedome chceš admin prístup (batch joby, migrácie, atď.).
    """
    global _service_client
    if _service_client is None:
        _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
    return _service_client


# ------------------------------------------------------------------
# User client (RLS) – používa ANON key + JWT cez postgrest.auth()
# ------------------------------------------------------------------

def get_user_client(user_jwt: Optional[str] = None):
    """
    Vráti Supabase client s RLS, autentifikovaný ako konkrétny používateľ.

    - vytvára nový client s ANON kľúčom
    - nastaví JWT na PostgREST vrstve, aby RLS videlo usera

    Ak user_jwt nie je dodaný, skúsime zobrať hodnotu z contextvar
    (set_current_user_jwt). Ak ani tam nič nie je, hodíme RuntimeError.
    """
    if user_jwt is None:
        user_jwt = _current_user_jwt.get()

    if not user_jwt:
        raise RuntimeError(
            "get_user_client() vyžaduje user_jwt alebo set_current_user_jwt() "
            "pred volaním get_client()."
        )

    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    # nastavíme JWT pre PostgREST (RLS)
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

    - get_client(service=True)      → SERVICE_ROLE (mimo RLS)
    - get_client(user_jwt="...")    → RLS user client
    - get_client()                  → skúsi RLS z contextvar (set_current_user_jwt),
                                      ak nič nie je, spadne na service client
                                      (spätná kompatibilita, ale mimo RLS!)
    """

    # 1) explicitne service mód
    if service:
        return get_service_client()

    # 2) ak sme dostali user_jwt priamo ako argument → user client (RLS)
    if user_jwt is not None:
        return get_user_client(user_jwt)

    # 3) skúsiť contextvar (set_current_user_jwt)
    ctx_jwt = _current_user_jwt.get()
    if ctx_jwt:
        return get_user_client(ctx_jwt)

    # 4) posledný fallback kvôli spätnému kompatibilnému správaniu:
    #    bez JWT padneme na service client (mimo RLS).
    #    Ideálne sem už časom vôbec nedochádzať.
    return get_service_client()