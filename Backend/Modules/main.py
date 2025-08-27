import Modules.User.user_handler as user_hdl
from Modules.AI.ai_functions import AI_analyze_last_week
import Modules.Reporting.reporting as reporting
import Modules.Sync.sync_handler as sync

def main():
    email = "patrikmbontar@gmail.com"
    user_id = user_hdl.get_or_create_user_id(email)

    #sync_history(user_id, datetime(2023,5,1,tzinfo=timezone.utc), datetime.now(timezone.utc))

    sync.sync_activities(user_id, force_full_30d=False, archive_raw=False)

    #user_hdl.insert_or_update_user_profile(user_id, weight_kg=82.3, height_cm=186, body_fat_pct=7.7, HR_max=201, RHR=52, birth_date = "1996-11-19", VO2Max = 46.5)

    #user_hdl.insert_or_update_user_zones(user_id, sport = "running", zone_type = 1, HR_min_bpm=120, HR_max_bpm=147)
    #user_hdl.insert_or_update_user_zones(user_id, sport = "running", zone_type = 2, HR_min_bpm=148, HR_max_bpm=164)
    #user_hdl.insert_or_update_user_zones(user_id, sport = "running", zone_type = 3, HR_min_bpm=165, HR_max_bpm=175)
    #user_hdl.insert_or_update_user_zones(user_id, sport = "running", zone_type = 4, HR_min_bpm=176, HR_max_bpm=184)
    #user_hdl.insert_or_update_user_zones(user_id, sport = "running", zone_type = 5, HR_min_bpm=185, HR_max_bpm=201)

    #user_hdl.insert_or_update_user_thresholds(user_id, sport = "running", threshold_type = "LT2", HR_bpm=184, pace_sec_km=295, measurement_type = "estimate garmin")
    
    #user_hdl.insert_or_update_user_thresholds(user_id, sport = "running", threshold_type = LT1, HR_bpm=164, measurement_type = "laboratory test")
    #user_hdl.insert_or_update_user_thresholds(user_id, sport = "running", threshold_type = MLSS, value=10)
    #user_hdl.insert_or_update_user_thresholds(user_id, sport = "cycling", threshold_type = LT2, HR_bpm=184, power_watt=295)

    #user_hdl.insert_or_update_user_bests(user_id, distance_m = 400, best_time_s=1393)
    #user_hdl.insert_or_update_user_bests(user_id, distance_m = 10000, best_time_s=3017)
    #user_hdl.insert_or_update_user_bests(user_id, distance_m = 21097, best_time_s=8527)
    
    #user_hdl.insert_or_update_user_recovery(user_id, date = "2025-08-24", RHR_bpm=53, HRV_avg_ms=64, HRV_max_ms=86, sleep_duration_min = 487, sleep_start_timestampz = "2025-08-23T23:10:00+02:00", alcohol_volume_ml = 1000, alcohol_type_pct = 12, food_2h_before = False)
 
    #print(user_hdl.get_user_profile(user_id))
    #print(user_hdl.get_user_zones(user_id))
    #print(user_hdl.get_user_thresholds(user_id))
    #print(user_hdl.get_user_bests(user_id))
    #print(user_hdl.get_user_recovery(user_id))
    
    # 3) Report (pracuje nad activities_summary)
    #reporting.generate_report(user_id)

    # 4) STREAMS pre jednu aktivitu (príklad)
    #activity_id = 15342917851
    #cache_streams_for_activity(user_id, activity_id, activity_date=None)

    # 4) AI analýza
    #report = AI_analyze_last_week(user_id)
    #print("===== AI REPORT =====")
    #print(report)


if __name__ == "__main__":
    main()
