from datetime import datetime, timezone, timedelta
from trainalyze.user_handler import user_crud
from trainalyze.user_handler import get_or_create_user_id
import trainalyze.api_strava as api_strava
import trainalyze.reporting as reporting
import trainalyze.SQL.data_manager as sql_dm

def sync_activities(user_id: int, force_full: bool = False):
    """
    Stiahne a uloží nové aktivity zo Stravy.
    - last_timestamp berie z DB (activities_summary)
    - existing_ids berie z DB (activities_summary)
    - force_full=True -> ignoruje last_timestamp a ide „od nuly“ (typicky posledných 30 dní alebo viac)
    """
    last_timestamp = sql_dm.get_last_timestamp_from_db(user_id)

    if last_timestamp is None or force_full:
        download_since_utc = datetime.now(timezone.utc) - timedelta(days=30)
    else:
        # 🔧 kľúčové: posuň o +1s, nech nenaťahuje aj poslednú uloženú
        download_since_utc = last_timestamp + timedelta(seconds=1)

    after_epoch = int(download_since_utc.timestamp())
    new_activities = api_strava.get_activities(after_timestamp=after_epoch)
    existing_ids = sql_dm.get_existing_activities_ids_from_db(user_id)
    
    saved = 0
    for act in reversed(new_activities):
        act_id = int(act["id"])
        
        if not force_full and act_id in existing_ids:
            continue
        
        details = api_strava.get_activity_data(act_id)
        ok = sql_dm.insert_activities_summary(act, details, user_id)
        
        if ok:
            saved += 1
            # nechaj si svoj print/log podľa zvyku:
            print(f"💾 Uložená/aktualizovaná aktivita: {act.get('name')} ({act.get('start_date_local') or act.get('start_date') or act.get('date')})")
    
def cache_detail_for_activity(user_id: int, activity_id: int, activity_date: str | None = None):
    streams = api_strava.get_activity_detail(activity_id)
    ok = sql_dm.replace_activity_detail(user_id=user_id, activity_id=activity_id, streams=streams, activity_date=activity_date)
    if ok:
        print(f"✅ activity_detail pre user_id={user_id} bol nahradený novými dátami (activity_id={activity_id})")
    else:
        print(f"❌ Ukladanie streamov zlyhalo pre activity_id={activity_id}")

def main():
    email = "patrikmbontar@gmail.com"
    user_id = get_or_create_user_id(email) 
    activity_id = 15342917851
    sync_activities(user_id, False)
    user_crud()
    reporting.generate_report(user_id)
    cache_detail_for_activity(user_id, activity_id)

if __name__ == "__main__":
    main()
