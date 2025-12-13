# Schemas/users.py
from pydantic import BaseModel

class ResolveIn(BaseModel):
    auth_uid: str | None = None
    supabase_uid: str | None = None