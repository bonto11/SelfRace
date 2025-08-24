import json

def build_prompt_analyze_last_week(user_profile: dict, activities: list[dict], details: dict, recovery: list[dict]) -> str:
    return f"""
Si tréningový analytik. Používateľ: {user_profile.get('display_name')}, 
vek {user_profile.get('age')} rokov, VO2max {user_profile.get('vo2max', 'N/A')}.

Aktivity za posledný týždeň:
{json.dumps(activities, indent=2)}

Detaily aktivít (splits/laps):
{json.dumps(details, indent=2)}

Recovery dáta:
{json.dumps(recovery, indent=2)}

Úloha: 
- zhodnoť tréningový objem a intenzitu
- porovnaj s jeho zónami a thresholdmi
- zohľadni recovery faktory (spánok, HRV, alkohol, káva)
- navrhni odporúčanie na ďalší týždeň.
"""
