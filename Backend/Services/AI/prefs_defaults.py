# Services/AI/prefs_defaults.py
from __future__ import annotations

import copy
from typing import Any, Dict

# ============================================================
# BASIC MODE DEFAULTS (detailed_mode == False / chýba)
#
# Zdieľané medzi daily_plan/builders.py a weekly_plan/builders.py.
# V samostatnom module, aby sa predišlo kruhovému importu medzi nimi.
# ============================================================

DEFAULT_STRENGTH_SESSIONS_PER_WEEK = 2
DEFAULT_LONG_RUN_DAYS = ["Sun"]
DEFAULT_STRENGTH_EQUIPMENT_MODE = "full_gym"
DEFAULT_STRENGTH_LOCATION = "gym"


def _is_detailed_mode(prefs: Dict[str, Any]) -> bool:
    """
    Číta preferences.detailed_mode. NEPOVINNÉ pole — ak chýba (starší
    záznam, alebo user ho nikdy neuložil), správame sa ako False, teda
    "základný atlét": rešpektujeme len to, čo reálne zadal (goal, start
    date, prípadne hlavný šport), zvyšok doplní apply_basic_mode_defaults().
    """
    pref_obj = prefs.get("preferences") if isinstance(prefs, dict) else None
    if not isinstance(pref_obj, dict):
        return False
    return bool(pref_obj.get("detailed_mode"))


def apply_basic_mode_defaults(prefs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ak user nemá zapnutý detailed_mode, doplní rozumné defaulty pre polia,
    ktoré by inak zostali null/prázdne a spôsobili degenerovaný/nepresný
    plán (napr. 0 silových tréningov namiesto rozumných 2x týždenne).

    Ak detailed_mode == True, prefs sa vrátia nezmenené — user si všetko
    nastavil sám a jeho voľba má vždy prednosť.

    Používa sa v daily_plan/builders.py aj weekly_plan/builders.py, aby
    boli defaulty medzi oboma plánmi konzistentné.
    """
    if not isinstance(prefs, dict):
        return prefs
    if _is_detailed_mode(prefs):
        return prefs

    prefs = copy.deepcopy(prefs)
    pref_obj = prefs.get("preferences")
    if not isinstance(pref_obj, dict):
        pref_obj = {}
        prefs["preferences"] = pref_obj

    # long run day — default nedeľa, ak user nič nezadal
    if not pref_obj.get("long_run_days"):
        pref_obj["long_run_days"] = list(DEFAULT_LONG_RUN_DAYS)

    # vyhýbanie sa dvom tvrdým dňom po sebe — bezpečný default zapnutý
    if pref_obj.get("avoid_back_to_back_hard") is None:
        pref_obj["avoid_back_to_back_hard"] = True

    # two-a-day — bezpečný default vypnutý
    two = pref_obj.get("two_a_day")
    if not isinstance(two, dict) or two.get("enabled") is None:
        pref_obj["two_a_day"] = {"enabled": False, "max_days_per_week": 0}

    # intensity model — polarized je aj tak default, ale nastavíme explicitne
    if not pref_obj.get("intensity_model"):
        pref_obj["intensity_model"] = "polarized"

    # strength — 2x týždenne, full gym, len ak user nič nezadal
    strength_settings = prefs.get("strength_settings")
    if not isinstance(strength_settings, dict) or not strength_settings.get("sessions_per_week"):
        prefs["strength_settings"] = {
            "location": DEFAULT_STRENGTH_LOCATION,
            "equipment_mode": DEFAULT_STRENGTH_EQUIPMENT_MODE,
            "available": [],
            "sessions_per_week": DEFAULT_STRENGTH_SESSIONS_PER_WEEK,
        }
        included = prefs.get("included_sports") or prefs.get("add_on_sports") or []
        if isinstance(included, list) and "strength" not in included:
            prefs["add_on_sports"] = list(included) + ["strength"]

    return prefs