from trainalyze.SQL.db_handler import get_client

supabase = get_client()

def insert_activity_summary(activity: dict, details: dict, user_id: int):
    data = {
        "id": activity["id"],
        "user_id": user_id,
        "name": activity["name"],
        "date": activity["start_date_local"],
        "type": activity["type"],
        "distance_km": round(activity["distance"] / 1000, 2),
        "moving_time_min": activity["moving_time"] // 60,
        "avg_hr": details.get("average_heartrate"),
        "max_hr": details.get("max_heartrate"),
        "elevation_gain_m": details.get("total_elevation_gain"),
    }
    response = supabase.table("activity_summary").upsert(data).execute()
    
    # response je APIResponse, ktorá má tieto atribúty:
    # - data
    # - count
    # - error (niekedy None)

     # Tu je tá zmena
    if hasattr(response, 'error') and response.error is not None:
        print(f"Chyba pri ukladaní: {response.error}")
        return False

    return True

def insert_activity_streams(activity_id: int, streams: dict, user_id: int, activity_date: str = None):
    rows = []
    times = streams.get("time", {}).get("data", [])
    latlng = streams.get("latlng", {}).get("data", [])
    altitude = streams.get("altitude", {}).get("data", [])
    heartrate = streams.get("heartrate", {}).get("data", [])
    cadence = streams.get("cadence", {}).get("data", [])
    velocity = streams.get("velocity_smooth", {}).get("data", [])

    for i in range(len(times)):
        lat, lng = (latlng[i] if i < len(latlng) else (None, None))
        row = {
            "activity_id": activity_id,
            "user_id": user_id,
            "activity_date": activity_date,
            "time": times[i] if i < len(times) else None,
            "lat": lat,
            "lng": lng,
            "altitude_m": altitude[i] if i < len(altitude) else None,
            "heartrate_bpm": heartrate[i] if i < len(heartrate) else None,
            "cadence_rpm": cadence[i] if i < len(cadence) else None,
            "speed_m_s": velocity[i] if i < len(velocity) else None,
        }
        rows.append(row)

    # Batch insert, môžeš rozdeliť na menšie dávky podľa potreby
    response = supabase.table("activity_streams").upsert(rows).execute()
    return response.data

def load_activities_from_db(user_id):
    try:
        response = supabase.table("activity_summary") \
                           .select("*") \
                           .eq("user_id", user_id) \
                           .execute()

        return response.data or []  # ak nie sú žiadne dáta, vráti prázdny list

    except Exception as e:
        print(f"Chyba pri načítaní aktivít: {e}")
        return []
