# Configs/nutrition.py
"""
Výživa – konštanty pre výpočet cieľov (Services/nutrition_targets.py).

Ciele počíta BE deterministicky, nie AI. AI len odhaduje zloženie jedla
z textu, a aj to je len návrh, ktorý user potvrdí.
"""

from __future__ import annotations

from typing import Dict, Tuple

NUTRITION_GOALS: Tuple[str, ...] = ("lose", "maintain", "gain")
MEALS: Tuple[str, ...] = ("breakfast", "lunch", "dinner", "snack")
FOOD_LOG_SOURCES: Tuple[str, ...] = ("manual", "text", "favorite", "recent", "barcode", "label", "photo")

# % úpravy kcal podľa cieľa: (min, default, max)
GOAL_RATE_PCT: Dict[str, Tuple[float, float, float]] = {
    "lose": (10.0, 15.0, 20.0),
    "gain": (5.0, 7.0, 10.0),
}

NEAT_FACTOR_DEFAULT = 1.3
NEAT_FACTOR_RANGE = (1.1, 1.8)
PROTEIN_G_PER_KG_DEFAULT = 1.8
PROTEIN_G_PER_KG_RANGE = (1.6, 2.2)
BMR_MANUAL_RANGE = (800, 4000)

# Do výdaja ide len 75 % kalórií z tréningu – Strava/hodinky ich nadhodnocujú
# a časť už pokrýva BMR × NEAT (počas tréningu by človek aj tak niečo spálil).
EXERCISE_KCAL_FACTOR = 0.75

# Chudnutie najviac ~0,75 % váhy za týždeň (7700 kcal ≈ 1 kg tuku).
MAX_WEEKLY_LOSS_PCT = 0.75
KCAL_PER_KG_FAT = 7700

# Pod 18 rokov len udržiavanie, pod BMI 18,5 sa chudnutie nedá zvoliť.
MIN_AGE_FOR_GOAL = 18
MIN_BMI_FOR_LOSS = 18.5

# g/kg sa rátajú z „referenčnej“ váhy: najviac váha pri BMI 27.
# PREČO: pri 130 kg by 1,8 g/kg bolo 234 g bielkovín a 7 g/kg sacharidov
# 900 g – nezmysel. Pri bežnej postave sa nič nemení.
REFERENCE_BMI_CAP = 27.0

FAT_MIN_G_PER_KG = 0.8

# Záťaž dňa → sacharidy g/kg (spec: voľno/ľahký 3–4, stredný 5–6, náročný 7–8)
DAY_LOADS: Tuple[str, ...] = ("rest", "easy", "moderate", "hard")
CARBS_G_PER_KG: Dict[str, float] = {
    "rest": 3.0,
    "easy": 4.0,
    "moderate": 5.5,
    "hard": 7.5,
}

# Záťaž dňa podľa kcal z tréningov na kg (pred 0,75): 80 kg → 400 / 960 kcal
LOAD_KCAL_PER_KG_MODERATE = 5.0
LOAD_KCAL_PER_KG_HARD = 12.0
# dlhý tréning = náročný deň bez ohľadu na tempo
LONG_SESSION_MIN = 120
LONG_RUN_MIN = 90

# MET (hrubé) podľa sport_type_fe aktivity – keď Strava kalórie nemá,
# a pre plánované tréningy. kcal = MET × kg × hodiny.
SPORT_MET: Dict[str, float] = {
    "run": 9.5,
    "ride": 7.0,
    "swim": 7.5,
    "walk": 3.5,
    "hike": 6.0,
    "strength": 5.0,
    "hiit": 8.0,
    "mixed": 6.0,
    "soccer": 7.0,
    "padel": 6.0,
    "pickleball": 5.0,
    "badminton": 5.5,
    "yoga": 2.5,
    "pilates": 3.0,
    "skate": 7.0,
    "surfing": 5.0,
    "rock_climbing": 7.0,
    "alpine_ski": 6.0,
    "other": 5.0,
}
DEFAULT_MET = 5.0

# Plánovaný beh/bicykel/plávanie podľa typu tréningu (násobok MET športu)
SESSION_TYPE_MET_FACTOR: Dict[str, float] = {
    "recovery": 0.75,
    "easy": 0.9,
    "long": 1.0,
    "tempo": 1.15,
    "interval": 1.2,
}

# Typ plánovaného tréningu → záťaž dňa
SESSION_TYPE_LOAD: Dict[str, str] = {
    "recovery": "easy",
    "easy": "easy",
    "long": "hard",
    "tempo": "hard",
    "interval": "hard",
}

# Udalosť (sport="other", svadba, sťahovanie…): MET NAD bežný deň.
# PREČO čistý MET: bežný pohyb už pokrýva NEAT – svadba nie je 8 h tréningu.
EVENT_NET_MET: Dict[str, float] = {
    "easy": 1.0,
    "moderate": 2.5,
    "hard": 4.5,
}

# Externá športová aktivita (futbal…) podľa intenzity: low / moderate / high
EXTERNAL_SPORT_MET: Dict[str, float] = {
    "low": 5.0,
    "moderate": 7.0,
    "high": 9.0,
}

# Odhad dĺžky ručného silového zápisu bez času (min na odcvičenú sériu + rozcvička)
STRENGTH_MIN_PER_SET = 2.5
STRENGTH_WARMUP_MIN = 10

# Šport plánu/externej aktivity → sport_type_fe aktivít, ktoré ho dnes už pokryli
PLAN_SPORT_ACTIVITY_MATCH: Dict[str, Tuple[str, ...]] = {
    "run": ("run",),
    "ride": ("ride",),
    "swim": ("swim",),
    "strength": ("strength", "hiit", "mixed"),
    "football": ("soccer",),
    "padel": ("padel",),
    "badminton": ("badminton",),
}

# Zápis jedla – limity
MAX_ITEMS_PER_LOG = 20
MAX_FAVORITES = 100
RECENT_DAYS = 30
RECENT_LIMIT = 30
AI_TEXT_MAX_LEN = 500
