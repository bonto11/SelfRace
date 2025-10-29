# backend/config_sport.py
from __future__ import annotations
from typing import Dict, Optional, Set, Iterable

# Zapni/vypni debug logy pre Pareto/Weekly
DEBUG_PARETO = True

# Alias mapa FE -> DB (aj opačné normalizačné prípady)
SPORT_ALIAS: Dict[str, Optional[str]] = {
    # špeciálne
    "all": None,

    # hlavné
    "run": "run",
    "ride": "ride",
    "bike": "ride",   # FE "bike" mapujeme na DB "ride"
    "mixed": "mixed",
    "skate": "skate",

    # ďalšie (mimo default 80/20, ale môžeš ich povoliť)
    "swim": "swim",
    "strength": "strength",
    "walk": "walk",
    "hike": "hike",
    "soccer": "soccer",
    "other": "other",
}

def normalize_sport(value: Optional[str]) -> Optional[str]:
    """
    FE/DB string -> normalizovaný šport (lower, aliasy).
    None / "" -> None
    """
    if not value:
        return None
    v = str(value).strip().lower()
    return SPORT_ALIAS.get(v, v)

def normalize_sport_list(values: Optional[Iterable[str]]) -> Set[str]:
    """
    Normalizuje pole športov, vyhodí None a duplicitné.
    """
    out: Set[str] = set()
    if not values:
        return out
    for v in values:
        n = normalize_sport(v)
        if n:
            out.add(n)
    return out

# ——————————————————————————————————————————————————————————
# 80/20 DEFAULT WHITELIST (keď FE pošle sport="all")
# ——————————————————————————————————————————————————————————
# Toto je PRESNE to, čo sa ráta do 80/20 pri "all".
PARETO_DEFAULT_SET: Set[str] = {"run", "ride", "mixed", "skate"}

# Voliteľne – samostatné whitelisty ak by si chcel iné defaulty inde:
WEEKLY_DEFAULT_SET: Set[str] = {"run", "ride", "mixed", "skate"}  # napr. rovnaké

# ——————————————————————————————————————————————————————————
# Export pre FE (aby vedelo, čo sa ráta a ako sa mapuje)
# ——————————————————————————————————————————————————————————
def pareto_meta() -> dict:
    """
    Čisté meta pre FE – čo sa ráta do 80/20 default, dostupné športy, aliasy.
    """
    # reverzný prehľad aliasov (iba zaujímavé aliasy)
    aliases = [{"from": k, "to": v} for k, v in SPORT_ALIAS.items() if k != v and v is not None]
    return {
        "allowed_default": sorted(PARETO_DEFAULT_SET),
        "aliases": aliases,
        "all_known": sorted({v for v in SPORT_ALIAS.values() if v} | set(SPORT_ALIAS.keys())),
    }