from datetime import datetime, timezone
import csv_handler
import api_strava

def main():
    # Získaj timestamp poslednej uložené aktivity (vráti None ak nič nie je)
    last_timestamp = csv_handler.get_last_activity_timestamp()

    # Ak nemáme žiadne uložené aktivity, nastavíme začiatočný timestamp na 30 dní dozadu
    if last_timestamp is None:
        from datetime import timedelta
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        after_timestamp = int(thirty_days_ago.timestamp())
    else:
        after_timestamp = last_timestamp

    # Načítaj už uložené ID aktivít, aby sme sa vyhli duplicitám
    existing_ids = csv_handler.load_existing_activity_ids()

    # Stiahni aktivity od after_timestamp (t.j. len nové)
    activities = api_strava.get_activities(after_timestamp=after_timestamp)

    print(f"API vrátilo celkovo {len(activities)} aktivít.")
    print(f"Last timestamp: {last_timestamp}")

    # Filter na nové aktivity, ktoré ešte nemáme
    new_activities = [a for a in activities if a["id"] not in existing_ids]

    print(f"🔍 Nových aktivít na uloženie: {len(new_activities)}")

    for act in reversed(new_activities):  # Ukladáme od najstarších k najnovším
        act_id = act["id"]
        details = api_strava.get_activity_details(act_id)
        streams = api_strava.get_activity_streams(act_id)

        csv_handler.save_activity_summary(act, details)
        csv_handler.save_activity_streams(act_id, streams, act["start_date_local"])

        print(f"💾 Aktivita uložená: {act['name']} ({act['start_date_local']})")

if __name__ == "__main__":
    main()
