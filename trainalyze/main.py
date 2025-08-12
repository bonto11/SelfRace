from datetime import datetime, timezone, timedelta
from trainalyze.user_handler import create_user, get_user_by_email, update_user, delete_user
from trainalyze.user_handler import get_or_create_user_id
import trainalyze.csv_handler as csv_handler
import trainalyze.api_strava as api_strava
import trainalyze.reporting as reporting
import trainalyze.SQL.data_manager as sql_dm



def sync_activities(user_id):
    last_timestamp = csv_handler.get_last_activity_timestamp()
    if last_timestamp is None:
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        after_timestamp = int(thirty_days_ago.timestamp())
    else:
        after_timestamp = last_timestamp

    existing_ids = csv_handler.load_existing_activity_ids()
    activities = api_strava.get_activities(after_timestamp=after_timestamp)

    print(f"API vrátilo celkovo {len(activities)} aktivít.")
    print(f"Last timestamp: {last_timestamp}")

    new_activities = [a for a in activities if a["id"] not in existing_ids]
    print(f"🔍 Nových aktivít na uloženie: {len(new_activities)}")

    for act in reversed(new_activities):
        act_id = act["id"]
        details = api_strava.get_activity_details(act_id)
        streams = api_strava.get_activity_streams(act_id)

        #csv_handler.save_activity_summary(act, details)   #old aproach -saving to CSV
        sql_dm.insert_activity_summary(act, details, user_id)

        #csv_handler.save_activity_streams(act_id, streams, act["start_date_local"])   #old aproach -saving to CSV
        sql_dm.insert_activity_streams(act_id, streams, user_id, act["start_date_local"])

        print(f"💾 Aktivita uložená: {act['name']} ({act['start_date_local']})")

def user_crud_demo():
    print("=== User CRUD Demo ===")
    create_user("Patrik Mbontar", 28, "00:23:18", "patrik.mbontar@gmail.com", "running")
    user = get_user_by_email("patrik.mbontar@gmail.com")
    print("Načítaný používateľ:", user)
    update_user("patrik.mbontar@gmail.com", age=29, best_5k_time="00:16:30")
    # delete_user("patrik.mbontar@gmail.com")
    
def get_current_user_id(email: str):
    user = get_user_by_email(email)
    if not user:
        raise ValueError(f"Používateľ s emailom {email} neexistuje.")
    return user[0]["id"]

def main():
    email = "patrik.mbontar@gmail.com"
    user_id = get_or_create_user_id(email)   
    sync_activities(user_id)
    user_crud_demo()
    reporting.generate_report(user_id)

if __name__ == "__main__":
    main()
