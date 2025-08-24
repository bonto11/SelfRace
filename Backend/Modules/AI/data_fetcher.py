from datetime import datetime, timedelta, timezone
import Modules.SQL.data_manager_ai as sql_dm_ai

def get_user_profile(user_id: int) -> dict:
    # TODO: prispôsob si podľa tvojich tabuliek
    return sql_dm_ai.ai_get_user_profile(user_id)

def get_activities(user_id: int, from_date: datetime, to_date: datetime) -> list[dict]:
    all_activities = sql_dm_ai.ai_get_activity_summary(user_id)
    return [a for a in all_activities 
            if from_date <= datetime.fromisoformat(a["date"].replace("Z", "+00:00")).astimezone(timezone.utc) < to_date]

def get_activity_details(user_id: int, activity_ids: list[int]) -> dict[int, dict]:
    details = {}
    for aid in activity_ids:
        details[aid] = {
            "splits": sql_dm_ai.ai_get_activity_splits(user_id, aid),
            "laps": sql_dm_ai.ai_get_activity_laps(user_id, aid)
        }
    return details

def get_recovery(user_id: int, from_date: datetime, to_date: datetime) -> list[dict]:
    return sql_dm_ai.ai_get_user_recovery(user_id, from_date, to_date)
