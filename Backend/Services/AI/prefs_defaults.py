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

# Pre ciele "schudnúť" / "zdravie" - laik do posilňovne chodiť nemusí,
# silový tréning s vlastnou váhou doma zvládne každý.
CASUAL_STRENGTH_LOCATION = "home"
CASUAL_STRENGTH_EQUIPMENT_MODE = "bodyweight"


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


def strength_opted_out(prefs: Dict[str, Any]) -> bool:
    """
    True, ak si user VÝSLOVNE nastavil 0 silových tréningov týždenne.

    PREČO samostatne od "nevyplnené": None = user nič nezadal (doplní sa
    default), 0 = user silový tréning nechce. Je to jeho rozhodnutie a žiadny
    default ani AI ho nesmie prebiť.
    """
    if not isinstance(prefs, dict):
        return False
    settings = prefs.get("strength_settings")
    raw = settings.get("sessions_per_week") if isinstance(settings, dict) else None
    if raw is None:
        targets = prefs.get("targets")
        legacy = targets.get("strength") if isinstance(targets, dict) else None
        raw = legacy.get("sessions_per_week") if isinstance(legacy, dict) else None
    if raw is None or raw == "":
        return False
    try:
        return int(raw) == 0
    except (TypeError, ValueError):
        return False


def _strip_strength_sports(prefs: Dict[str, Any]) -> None:
    """Odstráni strength zo zoznamov doplnkových športov (in-place)."""
    for key in ("add_on_sports", "included_sports"):
        lst = prefs.get(key)
        if isinstance(lst, list):
            prefs[key] = [
                s for s in lst if not (isinstance(s, str) and s.lower() == "strength")
            ]


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

    # 0 silových platí v oboch režimoch - strength nesmie ostať ani medzi
    # doplnkovými športami, inak by ho týždenný plán naplánoval do objemu.
    opted_out = strength_opted_out(prefs)

    if _is_detailed_mode(prefs):
        if opted_out:
            prefs = copy.deepcopy(prefs)
            _strip_strength_sports(prefs)
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

    # strength — 2x týždenne, full gym, len ak user nič nezadal.
    # Výslovná 0 sa nikdy neprepisuje.
    strength_settings = prefs.get("strength_settings")
    if opted_out:
        _strip_strength_sports(prefs)
    elif (
        not isinstance(strength_settings, dict)
        or strength_settings.get("sessions_per_week") in (None, "")
    ):
        casual = str(prefs.get("goal_kind") or "") in ("lose_weight", "health")
        prefs["strength_settings"] = {
            "location": CASUAL_STRENGTH_LOCATION if casual else DEFAULT_STRENGTH_LOCATION,
            "equipment_mode": (
                CASUAL_STRENGTH_EQUIPMENT_MODE if casual else DEFAULT_STRENGTH_EQUIPMENT_MODE
            ),
            # bodyweight + prázdne available = len cviky bez náčinia (selector)
            "available": [],
            "sessions_per_week": DEFAULT_STRENGTH_SESSIONS_PER_WEEK,
        }
        included = prefs.get("included_sports") or prefs.get("add_on_sports") or []
        if isinstance(included, list) and "strength" not in included:
            prefs["add_on_sports"] = list(included) + ["strength"]

    return prefs

def resolve_main_sport(prefs: Dict[str, Any]) -> str:
    """
    Hlavný šport pre AI. Prefs ho už nemusia mať - user v cieli vyberá
    "ktoré športy robíš" a môže nevybrať žiadny vytrvalostný.

    PREČO "strength": kto nemá beh/bicykel/plávanie a silový nevypol, chce
    len posilňovať - plán nesmie potichu dostať beh ako hlavný šport.
    """
    if not isinstance(prefs, dict):
        return "run"
    ms = prefs.get("main_sport")
    if isinstance(ms, str) and ms.strip():
        return ms.strip().lower()
    add_on = [s for s in (prefs.get("add_on_sports") or []) if isinstance(s, str) and s.strip()]
    if add_on:
        return add_on[0].strip().lower()
    if not strength_opted_out(prefs):
        return "strength"
    return "run"
