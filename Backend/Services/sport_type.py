# Modules/Services/sport_type.py
from __future__ import annotations
import re
from typing import Optional

RUN = {"Run", "VirtualRun", "TrailRun"}
RIDE = {"Ride", "VirtualRide", "EBikeRide", "Velomobile", "GravelRide"}
STRENGTH = {"WeightTraining", "Crossfit"}
SKATE = {"InlineSkate", "IceSkate"}
MIXED = {"Elliptical", "Rowing", "StairStepper", "Workout", "Yoga"}
WALK = {"Walk"}
HIKE = {"Hike"}
SWIM = {"Swim"}
SOCCER = {"Soccer", "Football"}  # Strava používa "Soccer", ale pre istotu

_name_kw = {
    "soccer":  r"(futbal|soccer|football)",
    "strength":r"(posil|gym|weights?|drepy|drep|bench|mrtvy|mŕtvy|deadlift|činka|činky)",
    "skate":   r"(korču|brusl|skate)",
    "run":     r"(beh|run|behal|bežal|jog)",
    "ride":    r"(bike|ride|bicy|cykl|velod|zwift|trainer)",
    "walk":    r"(walk|prechádz)",
    "hike":    r"(hike|tur)",
    "swim":    r"(swim|pláv|plav)",
}

_name_re = {k: re.compile(v, re.IGNORECASE) for k, v in _name_kw.items()}


def infer_sport_type_fe(
    sport_type: Optional[str],
    name: Optional[str] = None,
) -> str:
    """
    Z hrubého Strava sport_type + názvu aktivity vráti kategóriu pre FE:
    run | ride | strength | soccer | skate | walk | hike | swim | mixed | other
    """
    st = (sport_type or "").strip()
    nm = (name or "").strip()

    # 1) priamy map podľa Strava sport_type
    if st in RUN:       return "run"
    if st in RIDE:      return "ride"
    if st in STRENGTH:  return "strength"
    if st in SOCCER:    return "soccer"
    if st in SKATE:     return "skate"
    if st in WALK:      return "walk"
    if st in HIKE:      return "hike"
    if st in SWIM:      return "swim"
    if st in MIXED:     return "mixed"

    # 2) heuristiky z názvu
    if nm:
        for label, rx in _name_re.items():
            if rx.search(nm):
                return label

    # 3) fallback
    return "other"