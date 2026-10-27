# Configs/features.py
"""
Prepínače nových funkcií (feature flags).

Stupeň funkcie: off → admin → beta → all.
  - off   = nikto
  - admin = len users.role = 'ADMIN'
  - beta  = admin + jedna spoločná beta skupina (user_id v app_settings)
  - all   = všetci

Nastavenie je v app_settings pod kľúčom FEATURES_SETTING_KEY:
  {"stages": {"nutrition": "beta"}, "beta_users": [46, 99]}
Mení sa v admin paneli (Funkcie), nie v env.

PREČO default "admin": nová funkcia ide na prod hneď, ale kým ju admin
v paneli neposunie, nikto iný ju nevidí. Zabudnuté nastavenie nesmie
rozpracovanú funkciu ukázať všetkým.

Nová funkcia = nový kľúč tu + `useFeature("<kľúč>")` / `feature:` na FE
(FeatureKey vo `shared/state/featureFlagsStore.ts`).
"""

from __future__ import annotations

from typing import Dict, Tuple

FEATURE_STAGES: Tuple[str, ...] = ("off", "admin", "beta", "all")

FEATURES_SETTING_KEY = "features"

# kľúč → predvolený stupeň (platí, kým ho admin v paneli nezmení)
FEATURES: Dict[str, str] = {
    # živý tréner (párovanie, prezeranie zverenca, úprava plánu, vlákna)
    "trainer": "admin",
    # výživa – ciele kcal/makier, zápis jedla
    "nutrition": "admin",
    # AI návrh jedného tréningu v advisor režime (formulár „Pridať tréning“)
    "session_suggest": "admin",
    # plán obdobia – kostra na viac týždňov v advisor režime (AI navrhne, user upravuje)
    "season_plan": "admin",
    # AI návrh nastavenia coach prefs z textu cieľa (Coach prefs → „Povedz, čo chceš dosiahnuť“)
    "prefs_suggest": "admin",
    # fotka (graf, screenshot) k hodnoteniu aktivity a k otázke na tréning
    "ai_photos": "admin",
}

# Ako dlho drží BE nastavenie a rolu v pamäti (s). Zmena z admin panelu
# cache na tom istom procese zahodí hneď.
FEATURES_CACHE_TTL_S = 60
