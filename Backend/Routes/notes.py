from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from Modules.SQL.db_handler import get_client
from Configs.config import TABLE_USERS_NOTES
from datetime import datetime

router = APIRouter(prefix="/notes", tags=["Notes"])
supabase = get_client()


class NoteIn(BaseModel):
    user_id: int
    activity_id: int
    feeling: str | None = None
    energy: int | None = None
    mood: int | None = None


# --- POST: Insert alebo Update ---
@router.post("/")
def add_note(note: NoteIn):
    try:
        print(f"📝 [NOTES] Saving note: {note.dict()}")

        # Skús nájsť existujúcu poznámku
        existing = (
            supabase.table(TABLE_USERS_NOTES)
            .select("*")
            .eq("user_id", note.user_id)
            .eq("activity_id", note.activity_id)
            .limit(1)
            .execute()
        )

        if existing.data:
            # UPDATE
            res = (
                supabase.table(TABLE_USERS_NOTES)
                .update(
                    {
                        "feeling": note.feeling,
                        "energy": note.energy,
                        "mood": note.mood,
                        "updated_at": datetime.now().isoformat(),
                    }
                )
                .eq("user_id", note.user_id)
                .eq("activity_id", note.activity_id)
                .execute()
            )
            print(f"✅ [NOTES] Updated: {res.data}")
            return {"success": True, "action": "updated", "data": res.data}
        else:
            # INSERT
            res = (
                supabase.table(TABLE_USERS_NOTES)
                .insert(
                    {
                        "user_id": note.user_id,
                        "activity_id": note.activity_id,
                        "feeling": note.feeling,
                        "energy": note.energy,
                        "mood": note.mood,
                        "created_at": datetime.now().isoformat(),
                        "updated_at": datetime.now().isoformat(),
                    }
                )
                .execute()
            )
            print(f"✅ [NOTES] Inserted: {res.data}")
            return {"success": True, "action": "inserted", "data": res.data}

    except Exception as e:
        print(f"❌ [NOTES] Error while saving: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- GET: získa poznámku pre danú aktivitu ---
@router.get("/{user_id}/{activity_id}")
def get_note(user_id: int, activity_id: int):
    try:
        print(
            f"➡️ [NOTES] Fetching note for user_id={user_id}, activity_id={activity_id}"
        )

        res = (
            supabase.table(TABLE_USERS_NOTES)
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_id", activity_id)
            .limit(1)
            .execute()
        )

        note = res.data[0] if res.data else None
        print(f"✅ [NOTES] Loaded: {note}")
        return {"success": True, "data": note}

    except Exception as e:
        print(f"❌ [NOTES] Error while fetching: {e}")
        raise HTTPException(status_code=500, detail=str(e))
