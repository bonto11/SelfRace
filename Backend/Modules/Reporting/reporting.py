from datetime import datetime, timezone, timedelta
from collections import defaultdict
from Modules.utils import format_minutes_to_hours_minutes
from Modules.SQL.data_manager import load_activities_from_db

def _parse_iso(dt_str: str):
    if not dt_str:
        return None
    # Supabase/Strava: niekedy končí na 'Z'
    if isinstance(dt_str, str) and dt_str.endswith("Z"):
        dt_str = dt_str.replace("Z", "+00:00")
    return datetime.fromisoformat(dt_str)

def load_activities(user_id: str):
    raw_activities = load_activities_from_db(user_id)
    activities = []
    for row in raw_activities:
        try:
            # --- dátum ---
            row_date = row.get("date")
            row["date"] = _parse_iso(row_date)

            # --- SI -> ľudské metriky pre reporting ---
            distance_m = row.get("distance_m") or 0
            moving_time_s = row.get("moving_time_s") or 0
            row["distance_km"] = float(distance_m) / 1000.0
            row["moving_time_min"] = int(round(float(moving_time_s) / 60.0))

            # HR a prevýšenie
            row["avg_hr"] = (
                float(row.get("average_heartrate_bpm"))
                if row.get("average_heartrate_bpm") not in (None, "N/A")
                else None
            )
            row["max_hr"] = (
                float(row.get("max_heartrate_bpm"))
                if row.get("max_heartrate_bpm") not in (None, "N/A")
                else None
            )
            elev = row.get("elevation_gain_m")
            row["elevation_gain_m"] = float(elev) if elev is not None else 0.0

            # typ aktivity
            row["type"] = row.get("sport_type") or row.get("type") or "Unknown"

            # validácia dátumu
            if row["date"] is None:
                raise ValueError("missing/invalid date")

            activities.append(row)
        except Exception as e:
            print(f"⚠️ Skipping invalid row due to error: {e}")
    return activities

def filter_activities(activities, start_date, end_date):
    def remove_tz(dt):
        return dt.replace(tzinfo=None)
    return [
        act for act in activities
        if remove_tz(start_date) <= remove_tz(act["date"]) < remove_tz(end_date)
    ]

def summarize_activities(activities):
    summary = defaultdict(float)
    count_by_type = defaultdict(int)
    avg_hr_values = []
    max_hr_values = []
    longest_run = 0.0
    biggest_climb = 0.0

    for act in activities:
        summary["total_distance_km"] += act["distance_km"]
        summary["total_moving_time_min"] += act["moving_time_min"]
        summary["total_elevation_gain_m"] += act["elevation_gain_m"]
        count_by_type[act["type"]] += 1

        if act["avg_hr"] is not None:
            avg_hr_values.append(act["avg_hr"])
        if act["max_hr"] is not None:
            max_hr_values.append(act["max_hr"])

        if str(act["type"]).lower() == "run" and act["distance_km"] > longest_run:
            longest_run = act["distance_km"]
        if act["elevation_gain_m"] > biggest_climb:
            biggest_climb = act["elevation_gain_m"]

    avg_hr = round(sum(avg_hr_values) / len(avg_hr_values), 1) if avg_hr_values else None
    max_hr = max(max_hr_values) if max_hr_values else None

    return {
        "total_activities": len(activities),
        "count_by_type": dict(count_by_type),
        "total_distance_km": round(summary["total_distance_km"], 2),
        "total_moving_time_min": int(summary["total_moving_time_min"]),
        "total_elevation_gain_m": round(summary["total_elevation_gain_m"], 1),
        "avg_hr": avg_hr,
        "max_hr": max_hr,
        "longest_run_km": round(longest_run, 2),
        "biggest_climb_m": round(biggest_climb, 1),
    }

def percent_change(current, previous):
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 1)

def generate_report(user_id: str):
    activities = load_activities(user_id)
    if not activities:
        print("⚠️ Žiadne aktivity na spracovanie.")
        return

    now = datetime.now(timezone.utc)
    this_month_start = datetime(year=now.year, month=now.month, day=1, tzinfo=timezone.utc)
    last_month_end = this_month_start
    last_month_start = (last_month_end - timedelta(days=1)).replace(day=1)
    this_year_start = datetime(year=now.year, month=1, day=1, tzinfo=timezone.utc)
    last_year_start = datetime(year=now.year - 1, month=1, day=1, tzinfo=timezone.utc)
    last_year_end = datetime(year=now.year - 1, month=12, day=31, tzinfo=timezone.utc)

    this_month_activities = filter_activities(activities, this_month_start, now)
    last_month_activities = filter_activities(activities, last_month_start, last_month_end)
    this_year_activities = filter_activities(activities, this_year_start, now)
    last_year_activities = filter_activities(activities, last_year_start, last_year_end)

    this_month_summary = summarize_activities(this_month_activities)
    last_month_summary = summarize_activities(last_month_activities)
    this_year_summary = summarize_activities(this_year_activities)
    last_year_summary = summarize_activities(last_year_activities)

    print(f"=== Štatistiky za tento mesiac ({this_month_start.strftime('%Y-%m-%d')} - {now.strftime('%Y-%m-%d')}) ===")
    print(f"Počet aktivít: {this_month_summary['total_activities']}")
    print(f"Celková vzdialenosť: {this_month_summary['total_distance_km']} km")
    print(f"Celkový čas pohybu: {format_minutes_to_hours_minutes(this_month_summary['total_moving_time_min'])}")
    print(f"Priemerný tep: {this_month_summary['avg_hr']}")
    print(f"Maximálny tep: {this_month_summary['max_hr']}")
    print(f"Najdlhší beh: {this_month_summary['longest_run_km']} km")
    print(f"Najväčšie prevýšenie: {this_month_summary['biggest_climb_m']} m")
    print()

    print(f"=== Štatistiky za minulý mesiac ({last_month_start.strftime('%Y-%m-%d')} - {last_month_end.strftime('%Y-%m-%d')}) ===")
    print(f"Počet aktivít: {last_month_summary['total_activities']}")
    print(f"Celková vzdialenosť: {last_month_summary['total_distance_km']} km")
    print(f"Celkový čas pohybu: {format_minutes_to_hours_minutes(last_month_summary['total_moving_time_min'])}")
    print()

    print(f"=== Štatistiky za tento rok ({this_year_start.strftime('%Y-%m-%d')} - {now.strftime('%Y-%m-%d')}) ===")
    print(f"Počet aktivít: {this_year_summary['total_activities']}")
    print(f"Celková vzdialenosť: {this_year_summary['total_distance_km']} km")
    print()

    print(f"=== Štatistiky za minulý rok ({last_year_start.strftime('%Y-%m-%d')} - {last_year_end.strftime('%Y-%m-%d')}) ===")
    print(f"Počet aktivít: {last_year_summary['total_activities']}")
    print(f"Celková vzdialenosť: {last_year_summary['total_distance_km']} km")
    print()
