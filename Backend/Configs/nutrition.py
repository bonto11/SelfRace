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
FOOD_LOG_SOURCES: Tuple[str, ...] = (
    "manual", "text", "favorite", "recent", "barcode", "label", "photo", "suggestion", "copy",
)
# macros = čísla (kcal, makrá), simple = bez počítania (tanier a porcie)
NUTRITION_MODES: Tuple[str, ...] = ("macros", "simple")

# % úpravy kcal podľa cieľa: (min, default, max)
GOAL_RATE_PCT: Dict[str, Tuple[float, float, float]] = {
    "lose": (10.0, 15.0, 20.0),
    "gain": (5.0, 7.0, 10.0),
}

NEAT_FACTOR_DEFAULT = 1.3
NEAT_FACTOR_RANGE = (1.1, 1.8)
PROTEIN_G_PER_KG_DEFAULT = 1.8
PROTEIN_G_PER_KG_RANGE = (1.6, 2.2)
# Bielkoviny „automaticky“ (profil bez vlastnej voľby) podľa cieľa.
# PREČO v deficite viac: pri chudnutí chránia svaly, pri udržiavaní
# vytrvalcovi stačí spodok odporúčaného pásma.
PROTEIN_G_PER_KG_AUTO = {"lose": 2.0, "maintain": 1.6, "gain": 1.8}
BMR_MANUAL_RANGE = (800, 4000)
# BMR z body scanu (InBody, users_metrics bmr_kcal) platí 180 dní – potom
# sa telo mohlo zmeniť a ide vzorec (alebo nový scan)
BMR_MEASURED_MAX_AGE_DAYS = 180

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

# Záťaž dňa → sacharidy g/kg (spec: voľno/ľahký 3–4, stredný 5–6, náročný 7–8).
# load = sacharidové doplnenie 1–2 dni pred dlhým pretekom (spodok odporúčaných
# 8–12 g/kg – pre amatérov s citlivým žalúdkom stačí), race = deň pretekov
# (raňajky, pretek, regenerácia; bez deficitu).
DAY_LOADS: Tuple[str, ...] = ("rest", "easy", "moderate", "hard")
CARBS_G_PER_KG: Dict[str, float] = {
    "rest": 3.0,
    "easy": 4.0,
    "moderate": 5.5,
    "hard": 7.5,
    "load": 8.0,
    "race": 7.5,
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

# ---------------------------------------------------------------------------
# Fáza 2–3: produkty, čiarový kód, fotky
# ---------------------------------------------------------------------------

PRODUCT_SOURCES: Tuple[str, ...] = ("off", "label_ai", "user")

# Open Food Facts API v2 – len polia, ktoré treba (menšia odpoveď)
OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/{code}"
OFF_FIELDS = (
    "code,product_name,product_name_sk,product_name_cs,product_name_en,"
    "generic_name,brands,nutriments,serving_quantity,serving_size"
)
# OFF žiada vlastný User-Agent s kontaktom
OFF_USER_AGENT = "SelfRace/1.0 (support@selfrace.com)"
OFF_TIMEOUT_S = 6
# Kód, ktorý OFF nepozná, sa chvíľu nepýta znova (opakované skenovanie)
OFF_NOT_FOUND_TTL_S = 6 * 3600

# EAN-8, UPC-A/E, EAN-13, GTIN-14 (+ krátke interné kódy obchodov)
BARCODE_RE = r"^[0-9]{6,14}$"

# Fotka z FE je zmenšená na ~1024 px (desiatky až stovky kB) – väčší súbor
# je chyba alebo nezmenšený originál.
MAX_IMAGE_BYTES = 6 * 1024 * 1024
IMAGE_TYPES: Tuple[str, ...] = ("image/jpeg", "image/png", "image/webp")

# Týždenný sumár pre AI (advisor, athlete state) – menej zapísaných dní
# je náhoda, nie strava
NUTRITION_AI_MIN_LOGGED_DAYS = 3

# ---------------------------------------------------------------------------
# Palivo podľa plánu a pretekov (Services/nutrition_fuel.py)
# Odporúčania športovej výživy (ISSN / ACSM), zaokrúhlené pre amatérov.
# ---------------------------------------------------------------------------

FUEL_DAYS_AHEAD = 2  # dnes + 2 dni

# Preteky: sacharidové doplnenie len pred dlhými (≥ 90 min) – deň vopred,
# pred veľmi dlhými (≥ 2,5 h: maratón, ultra) dva dni (36–48 h)
RACE_LOADING_MIN_MINUTES = 90
RACE_LOADING_LONG_MINUTES = 150
RACE_LOADING_DAYS = 2
# V palivové dni (doplnenie, pretek) bielkoviny najviac 1,6 g/kg – miesto
# patrí sacharidom, viac bielkovín v tie dni nič nepridá
FUEL_DAY_PROTEIN_G_PER_KG_MAX = 1.6
RACE_KM: Dict[str, float] = {"5k": 5.0, "10k": 10.0, "half": 21.1, "marathon": 42.2, "ultra": 50.0}
# odhad času pretekov bez cieľového času: min/km podľa typu + prevýšenie
RACE_PACE_MIN_PER_KM: Dict[str, float] = {
    "road": 6.0, "track": 5.5, "cross": 7.0, "trail": 8.0, "ocr": 9.0, "other": 7.0,
}
RACE_MIN_PER_100M_GAIN = 6.0

# Pred tréningom / pretekom (1–3 h vopred): g sacharidov na kg
PRE_SESSION_CARBS_G_PER_KG = 1.0
PRE_RACE_CARBS_G_PER_KG = 2.0
# „Pred“ radíme pri náročnom tréningu alebo dlhšom ako PRE_SESSION_MIN_MINUTES
PRE_SESSION_MIN_MINUTES = 60
# Počas: od 75 min; do 2,5 h ~30–60 g/h, dlhšie ~60–90 g/h
DURING_MIN_MINUTES = 75
DURING_CARBS_G_PER_H: Tuple[Tuple[int, int], ...] = ((150, 45), (100000, 75))
DURING_FLUID_ML_PER_H = 500
# Po náročnom / dlhom: bielkoviny a sacharidy do 1–2 h
POST_PROTEIN_G_PER_KG = 0.3
POST_CARBS_G_PER_KG = 1.0
# Večer pred náročným dňom: príloha navyše (g sacharidov na kg)
EVENING_BEFORE_CARBS_G_PER_KG = 1.0

# ---------------------------------------------------------------------------
# Kalibrácia výdaja z váhy a kompletne zapísaných dní (nutrition_calibration.py)
# ---------------------------------------------------------------------------

CALIB_WINDOW_DAYS = 28
CALIB_MIN_COMPLETE_DAYS = 14
CALIB_MIN_WEIGHINS = 4
CALIB_MIN_SPAN_DAYS = 14
# PREČO asymetricky: kto zabudne zapísať jedlo, vyjde mu výdaj nižší
# a appka by mu radila jesť ešte menej. Nadol preto len o 10 %, nahor o 15 %.
CALIB_FACTOR_RANGE = (0.90, 1.15)
CALIB_REFRESH_DAYS = 3

# ---------------------------------------------------------------------------
# Týždenný rozpočet a varovania
# ---------------------------------------------------------------------------

# zvyšok týždňa sa smie posunúť najviac o 15 % plánovaných cieľov
BUDGET_ADJUST_MAX = 0.15
# menší rozdiel týždňa sa nerieši – je to v chybe odhadu
BUDGET_MIN_DIFF_KCAL = 100
# „celý deň“ bez označenia = aspoň 3 rôzne jedlá dňa (raňajky, obed…)
FULL_DAY_MIN_MEALS = 3
# „Ako včera“ – posledný výskyt jedla dňa najviac pred toľkými dňami
REPEAT_LOOKBACK_DAYS = 3
# podjedenie: priemerne pod 75 % cieľa (≥ 4 zapísané dni), alebo v náročný
# deň pod 60 % sacharidov
UNDERFUEL_MIN_LOGGED_DAYS = 4
UNDERFUEL_KCAL_PCT = 75
UNDERFUEL_HARD_CARBS_PCT = 60
# chudnutie rýchlejšie ako 1 % váhy za týždeň (z trendu za 3 týždne)
FAST_LOSS_PCT_PER_WEEK = 1.0
WEIGHT_TREND_DAYS = 21

# AI návrh jedál – len keď ostáva aspoň toľko kcal
SUGGEST_MIN_REMAINING_KCAL = 150
# gramy návrhu sa dorovnajú na zvyšok dňa, najviac v tomto pomere
SUGGEST_SCALE_RANGE = (0.6, 1.6)

