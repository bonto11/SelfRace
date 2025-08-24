# Modules/SQL/db_handler.py
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

def get_service_client():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

def get_user_client(user_jwt: str):
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    client.postgrest.auth(user_jwt)
    return client

# spätná kompatibilita:
def get_client():
    return get_service_client()
