from fastapi import APIRouter, HTTPException
from Modules.SQL.db_handler import get_client
from datetime import datetime, timedelta, timezone
import os
from openai import OpenAI
from dotenv import load_dotenv
from Modules.AI.ai_client import ask_ai  # použijeme tvoju AI vrstvu
from Modules.config import (
    TABLE_ACTIVITIES_SUMMARY,
    TABLE_ACTIVITIES_SPLITS,
    TABLE_ACTIVITIES_LAPS,
    TABLE_USERS_PROFILE,
    TABLE_USERS_ZONES,
    TABLE_USERS_THRESHOLDS,
    TABLE_USERS_BESTS,
    TABLE_USERS_RECOVERY,
)

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

router = APIRouter(prefix="/activities", tags=["activities"])
supabase = get_client()


@router.get("/analyze/{user_id}")
async def analyze_recent_activities(user_id: int):
    """
    Vytiahne posledný mesiac aktivít a pošle ich do AI na analýzu
    """
    try:
        month_ago = datetime.now(timezone.utc) - timedelta(days=30)

        res = (
            supabase.table(TABLE_ACTIVITIES_SUMMARY)
            .select(
                "name, sport_type, distance_m, moving_time_s, average_hr, start_date"
            )
            .eq("user_id", user_id)
            .gte("date", month_ago.isoformat())
            .order("date", desc=True)
            .limit(30)
            .execute()
        )

        activities = res.data
        if not activities:
            return {"success": False, "error": "Žiadne aktivity za posledný mesiac."}

        # Prompt pre AI
        prompt = f"""
        Tu sú aktivity používateľa za posledný mesiac:
        {activities}

        Analyzuj tieto dáta a napíš krátke zhrnutie trendov – ako sa mení vytrvalosť, tempo, tep, 
        a čo by si odporučil pre ďalší mesiac.
        """

        ai_response = ask_ai(prompt)
        return {"success": True, "analysis": ai_response}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
