from datetime import datetime, timezone
from Modules.SQL.db_handler import get_client
from postgrest import APIError  # nech vieme rozlíšiť “column does not exist”
from typing import Optional, Set, List

ACTIVITIES_SUMMARY = "activities_summary"
ACTIVITY_DETAIL = "activity_detail"

supabase = get_client()

def insert_activities_summary(activity: dict, details: dict, user_id: int):
    data = {
        "activity_id": activity["id"],
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
    response = supabase.table(ACTIVITIES_SUMMARY).upsert(data).execute()
    
    # response je APIResponse, ktorá má tieto atribúty:
    # - data
    # - count
    # - error (niekedy None)

     # Tu je tá zmena
    if hasattr(response, 'error') and response.error is not None:
        print(f"Chyba pri ukladaní: {response.error}")
        return False

    return True

def insert_activity_detail(activity_id: int, streams: dict, user_id: int, activity_date: str = None):
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
            "time": times[i] if i < len(times) else None,         # sekundy od štartu
            "lat": lat,
            "lng": lng,
            "altitude_m": altitude[i] if i < len(altitude) else None,
            "heartrate_bpm": heartrate[i] if i < len(heartrate) else None,
            "cadence_rpm": cadence[i] if i < len(cadence) else None,
            "speed_m_s": velocity[i] if i < len(velocity) else None,
        }
        rows.append(row)

    # odporúčam batchovať, ak je veľa bodov (410–1000 na dávku)
    BATCH = 1000
    for start in range(0, len(rows), BATCH):
        chunk = rows[start:start+BATCH]
        supabase.table(ACTIVITY_DETAIL).upsert(chunk).execute()

    return True

def load_activities_from_db(user_id):
    try:
        response = supabase.table(ACTIVITIES_SUMMARY) \
                           .select("*") \
                           .eq("user_id", user_id) \
                           .execute()

        return response.data or []  # ak nie sú žiadne dáta, vráti prázdny list

    except Exception as e:
        print(f"Chyba pri načítaní aktivít: {e}")
        return []
 
def get_last_timestamp_from_db(user_id: int) -> Optional[datetime]:
    """
    Vráti poslednú (najväčšiu) start_date_local pre daného usera z activity_summary.
    Ak nič nie je, vráti None.
    """
    # vezmeme len stĺpec s časom, zoradíme desc a limit 1
    response = supabase.table(ACTIVITIES_SUMMARY) \
            .select("date") \
            .eq("user_id", user_id) \
            .order("date", desc=True) \
            .limit(1) \
            .execute()

    rows = response.data or []
    if not rows:
        return None

    value = rows[0].get("date")
    if not value:
        return None

    if isinstance(value, str):
        if value.endswith("Z"):
            value = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(value)
    else:
        dt = value  # už datetime z klienta

    # 🔒 vždy vráť timezone-aware UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    return dt
    
def get_existing_activities_ids_from_db(user_id: int) -> Set[int]:
    """
    Načíta všetky už uložené Strava activity_id pre daného usera z ACTIVITIES_SUMMARY.
    """
    # prispôsob názov stĺpca s ID aktivity (používam `activity_id`)
    response = (supabase.table(ACTIVITIES_SUMMARY)
             .select("activity_id")
             .eq("user_id", user_id)
             .execute())
    
    return {int(row["id"]) for row in (response.data or []) if row.get("id") is not None}

def upsert_activities_summary(user_id: int, act: dict) -> bool:
    """
    Tvoja existujúca/updatnutá upsert logika.
    Očakávam, že dict `act` už obsahuje mapované polia na stĺpce tabuľky.
    Kľúčové je, aby bola v DB unikátna kombinácia (user_id, activity_id).
    """
    payload = {**act, "user_id": user_id}
    try:
        supabase.table(ACTIVITIES_SUMMARY).upsert(payload).execute()
        return True
    except Exception as e:
        print("❌ upsert_activities_summary error:", e)
        return False

def delete_activity_detail_for_user(user_id: int) -> int:
    """
    Zmaže všetky riadky z activity_detail pre daného usera.
    Vracia počet zmazaných riadkov (ak API vráti data).
    """
    res = (supabase
           .table(ACTIVITY_DETAIL)
           .delete()
           .eq("user_id", int(user_id))
           .execute())
    return len(res.data or [])

def delete_activity_detail_for_activity(user_id: int, activity_id: int) -> int:
    res = (supabase.table(ACTIVITY_DETAIL)
           .delete()
           .eq("user_id", int(user_id))
           .eq("activity_id", int(activity_id))
           .execute())
    return len(res.data or [])

def replace_activity_detail(user_id: int, activity_id: int, streams: dict, activity_date: str | None = None) -> bool:
    """
    Vymaže všetky staré detail dáta pre usera a uloží nové pre vybranú aktivitu.
    """
    try:
        delete_activity_detail_for_user(user_id)  # alebo delete_activity_detail_for_activity(user_id, activity_id)
        ok = insert_activity_detail(activity_id=activity_id, streams=streams, user_id=user_id, activity_date=activity_date)
        return bool(ok)
    except Exception as e:
        print("❌ replace_activity_detail error:", e)
        return False