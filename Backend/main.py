from Modules.API import Strava

print(Strava.get_activities(after_timestamp=0)[:2])  # prvé 2 aktivity