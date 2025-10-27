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
SOCCER = {"Soccer", "Football"}  # Strava používa "Soccer"

_name_kw = {
    "soccer":  r"(futbal|soccer|football)",
    "strength":r"(posil|gym|weights?|drepy|drep|bench|mrtvy|mŕtvy|deadlift|činka|činky)",
    "skate":   r"(korču|brusl|skate)",
    "run":     r"(beh|run|behal|bežal|jog)",
    "ride":    r"(bike|ride|bicy|cykl|zwift|trainer)",
    "walk":    r"(walk|prechádz)",
    "hike":    r"(hike|tur)",
    "swim":    r"(swim|pláv|plav)",
}
_name_re = {k: re.compile(v, re.IGNORECASE) for k, v in _name_kw.items()}

def infer_sport_type_fe(
    sport_type: Optional[str],
    name: Optional[str] = None,
    distance_m: Optional[float] = None,
    moving_time_s: Optional[float] = None,
) -> str:
    """
    FE kategórie: run | ride | strength | soccer | skate | walk | hike | swim | mixed | other
    + špeciálna logika pre 'Workout': ak je tam aj zmysluplný pohyb (distance/speed), ide do 'mixed'.
    """
    st = (sport_type or "").strip()
    nm = (name or "").strip()

    # 0) pomocné metriky (bezpečne)
    dist = float(distance_m or 0.0)
    tsec = float(moving_time_s or 0.0)
    speed_mps = (dist / tsec) if tsec > 0 else 0.0

    # prahy – môžeš ľubovoľne doladiť:
    MIX_DIST_M = 1000.0      # 1 km stačí na "bolo tam behu/chôdze dosť"
    MIX_SPEED_MPS = 1.0      # ~3.6 km/h (chôdza/klus)

    # 1) priame mapovanie Strava sport_type
    if st in RUN:       return "run"
    if st in RIDE:      return "ride"
    if st in STRENGTH:  return "strength"
    if st in SOCCER:    return "soccer"
    if st in SKATE:     return "skate"
    if st in WALK:      return "walk"
    if st in HIKE:      return "hike"
    if st in SWIM:      return "swim"

    # 'Workout' je špeciálny prípad (často silový tréning)
    if st == "Workout":
        if dist >= MIX_DIST_M or speed_mps >= MIX_SPEED_MPS:
            return "mixed"     # sila + beh/chôdza → kombi
        # názov vie prehodiť na run/mixed ak chceš:
        if _name_re["run"].search(nm):
            return "mixed"
        return "strength"

    # ostatné, čo som dával do MIXED (Elliptical/Rowing/StairStepper/Yoga/Workout) -> mixed
    if st in MIXED:
        return "mixed"

    # 2) heuristika z názvu (ak ešte nič nepasovalo)
    if nm:
        if _name_re["soccer"].search(nm):  return "soccer"
        if _name_re["strength"].search(nm):return "strength"
        if _name_re["skate"].search(nm):   return "skate"
        if _name_re["run"].search(nm):     return "run"
        if _name_re["ride"].search(nm):    return "ride"
        if _name_re["walk"].search(nm):    return "walk"
        if _name_re["hike"].search(nm):    return "hike"
        if _name_re["swim"].search(nm):    return "swim"

    # 3) fallback
    return "other"