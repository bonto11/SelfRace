from Modules.AI.ai_client import ask_ai
import Modules.SQL.data_manager_ai as dm_ai


def AI_analyze_last_week(user_id: int):
    print("🔍 Spúšťam AI_analyze_last_week pre user_id=", user_id)
    activities = dm_ai.ai_get_last_week_summary_data(user_id)
    print(f"Načítaných {len(activities)} aktivít za posledný týždeň.")

    if not activities:
        return "❌ Za posledný týždeň neboli nájdené žiadne aktivity."

    prompt = f"""
    Si športový tréner. Tu sú dáta používateľa za posledný týždeň:
    {activities}

    Vytvor krátke zhrnutie:
    - aké typy tréningov boli vykonané
    - celkový objem (km, hodiny)
    - intenzita (z hľadiska tepových zón)
    - odporúčania na ďalší týždeň
    """

    return ask_ai(prompt)
