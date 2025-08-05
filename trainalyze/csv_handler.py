import os
import csv
from datetime import datetime, timezone

SUMMARY_CSV = "data/activity_summary.csv"
STREAMS_CSV = "data/activity_streams.csv"

def load_existing_activity_ids():
    if not os.path.exists(SUMMARY_CSV):
        return set()
    with open(SUMMARY_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return set(int(row["id"]) for row in reader if "id" in row and row["id"].isdigit())

def get_last_activity_timestamp():
    if not os.path.exists(SUMMARY_CSV):
        return None
    with open(SUMMARY_CSV, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        if not rows:
            return None
        last_date_str = rows[-1].get("date")
        if not last_date_str:
            return None
        try:
            dt = datetime.fromisoformat(last_date_str.replace("Z", "+00:00"))
            return dt.timestamp()
        except ValueError:
            return None

def save_activity_summary(summary, details):
    os.makedirs(os.path.dirname(SUMMARY_CSV), exist_ok=True)
    file_exists = os.path.exists(SUMMARY_CSV)
    with open(SUMMARY_CSV, "a", newline="", encoding="utf-8") as csvfile:
        fieldnames = ["id", "name", "date", "type", "distance_km", "moving_time_min", "avg_hr", "max_hr", "elevation_gain_m"]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()  # zapíš header len ak súbor neexistuje
        writer.writerow({
            "id": summary["id"],
            "name": summary["name"],
            "date": summary["start_date_local"],
            "type": summary["type"],
            "distance_km": round(summary["distance"] / 1000, 2),
            "moving_time_min": summary["moving_time"] // 60,
            "avg_hr": details.get("average_heartrate", "N/A"),
            "max_hr": details.get("max_heartrate", "N/A"),
            "elevation_gain_m": details.get("total_elevation_gain", 0),
        })
    print(f"💾 Súhrn uložený: {SUMMARY_CSV}")


def save_activity_streams(activity_id, streams, activity_date=None):
    os.makedirs(os.path.dirname(STREAMS_CSV), exist_ok=True)
    rows = []

    # Načítaj existujúce streamy, ak sú
    if os.path.exists(STREAMS_CSV):
        with open(STREAMS_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

    # Priprav nové dáta zo streamov
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
            "activity_date": activity_date if activity_date else "",
            "time": times[i] if i < len(times) else "",
            "lat": lat if lat is not None else "",
            "lng": lng if lng is not None else "",
            "altitude_m": altitude[i] if i < len(altitude) else "",
            "heartrate_bpm": heartrate[i] if i < len(heartrate) else "",
            "cadence_rpm": cadence[i] if i < len(cadence) else "",
            "speed_m_s": velocity[i] if i < len(velocity) else "",
        }
        rows.append(row)

    def sort_key(r):
        date_str = r.get("activity_date") or r.get("date") or ""
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except Exception:
            dt = datetime.min.replace(tzinfo=timezone.utc)

        time_val_raw = r.get("time", 0)
        try:
            time_val = int(time_val_raw)
        except (ValueError, TypeError):
            time_val = 0

        return (dt, time_val)

    rows.sort(key=sort_key)

    # Kontrola, či všetky riadky majú správne kľúče
    required_keys = {"activity_id", "activity_date", "time", "lat", "lng", "altitude_m", "heartrate_bpm", "cadence_rpm", "speed_m_s"}
    for idx, row in enumerate(rows):
        missing = required_keys - row.keys()
        if missing:
            print(f"⚠️ Warning: Row {idx} chýbajú kľúče: {missing}")

    with open(STREAMS_CSV, "w", newline="", encoding="utf-8") as f:
        fieldnames = list(required_keys)
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"💾 Streamy uložené: {STREAMS_CSV}")
