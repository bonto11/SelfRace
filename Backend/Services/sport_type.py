from __future__ import annotations
import re
from typing import Optional

RUN = {"Run", "VirtualRun", "TrailRun"}
RIDE = {"Ride", "VirtualRide", "EBikeRide", "Velomobile", "GravelRide"}
STRENGTH = {"WeightTraining", "Crossfit"}
SKATE = {"InlineSkate", "IceSkate"}
# 🌟 "Workout" už nie je v MIXED - má vlastnú špeciálnu vetvu nižšie
# (rieši distance/speed heuristikou), takže by tu bol mŕtvy/nedosiahnuteľný
# kód. MIXED teraz obsahuje len skutočne "kombinované" cardio stroje.
MIXED = {"Elliptical", "Rowing", "StairStepper"}
WALK = {"Walk"}
HIKE = {"Hike"}
SWIM = {"Swim"}
SOCCER = {"Soccer", "Football"}  # Strava používa "Soccer"

# 🌟 NOVÉ kategórie - predtým padali do "other" (Padel, Pickleball,
# Badminton, HighIntensityIntervalTraining, Surfing, RockClimbing,
# AlpineSki) alebo do všeobecného "mixed" (Yoga - nedávalo zmysel spolu s
# Elliptical/Rowing). Pilates pridané ako vlastná kategória z rovnakého
# dôvodu ako Yoga - je dosť odlišná disciplína na samostatnú kartu.
HIIT = {"HighIntensityIntervalTraining"}
PADEL = {"Padel"}
PICKLEBALL = {"Pickleball"}
BADMINTON = {"Badminton"}
YOGA = {"Yoga"}
PILATES = {"Pilates"}
SURFING = {"Surfing", "Windsurf", "Kitesurf"}
ROCK_CLIMBING = {"RockClimbing"}
ALPINE_SKI = {"AlpineSki", "BackcountrySki", "NordicSki", "Snowboard"}

_name_kw = {
    "soccer": r"(futbal|soccer|football)",
    "strength": r"(posil|gym|weights?|drepy|drep|bench|mrtvy|mŕtvy|deadlift|činka|činky)",
    "skate": r"(korču|brusl|skate)",
    "run": r"(beh|run|behal|bežal|jog)",
    "ride": r"(bike|ride|bicy|cykl|zwift|trainer)",
    "walk": r"(walk|prechádz)",
    "hike": r"(hike|tur)",
    "swim": r"(swim|pláv|plav)",
    "hiit": r"(hiit|interval)",
    "padel": r"(padel)",
    "pickleball": r"(pickleball)",
    "badminton": r"(badminton)",
    "yoga": r"(yoga|joga)",
    "pilates": r"(pilates)",
    "surfing": r"(surf)",
    "rock_climbing": r"(climb|lezeni|boulder)",
}
_name_re = {k: re.compile(v, re.IGNORECASE) for k, v in _name_kw.items()}


def infer_sport_type_fe(
    sport_type: Optional[str],
    name: Optional[str] = None,
    distance_m: Optional[float] = None,
    moving_time_s: Optional[float] = None,
) -> str:
    """
    FE kategórie: run | ride | strength | soccer | skate | walk | hike |
    swim | hiit | padel | pickleball | badminton | yoga | pilates |
    surfing | rock_climbing | alpine_ski | mixed | other
    + špeciálna logika pre 'Workout': ak je tam aj zmysluplný pohyb
    (distance/speed), ide do 'mixed'.
    """
    st = (sport_type or "").strip()
    nm = (name or "").strip()

    # 0) pomocné metriky (bezpečne)
    dist = float(distance_m or 0.0)
    tsec = float(moving_time_s or 0.0)
    speed_mps = (dist / tsec) if tsec > 0 else 0.0

    # prahy – môžeš ľubovoľne doladiť:
    MIX_DIST_M = 500.0  # 1 km stačí na "bolo tam behu/chôdze dosť"
    MIX_SPEED_MPS = 1.0  # ~3.6 km/h (chôdza/klus)

    # 1) priame mapovanie Strava sport_type
    if st in RUN:
        return "run"
    if st in RIDE:
        return "ride"
    if st in STRENGTH:
        return "strength"
    if st in SOCCER:
        return "soccer"
    if st in SKATE:
        return "skate"
    if st in WALK:
        return "walk"
    if st in HIKE:
        return "hike"
    if st in SWIM:
        return "swim"
    if st in HIIT:
        return "hiit"
    if st in PADEL:
        return "padel"
    if st in PICKLEBALL:
        return "pickleball"
    if st in BADMINTON:
        return "badminton"
    if st in YOGA:
        return "yoga"
    if st in PILATES:
        return "pilates"
    if st in SURFING:
        return "surfing"
    if st in ROCK_CLIMBING:
        return "rock_climbing"
    if st in ALPINE_SKI:
        return "alpine_ski"

    # 'Workout' je špeciálny prípad (často silový tréning)
    if st == "Workout":
        if dist >= MIX_DIST_M or speed_mps >= MIX_SPEED_MPS:
            return "mixed"  # sila + beh/chôdza → kombi
        # názov vie prehodiť na run/mixed ak chceš:
        if _name_re["run"].search(nm):
            return "mixed"
        return "strength"

    # ostatné, čo som dával do MIXED (Elliptical/Rowing/StairStepper) -> mixed
    if st in MIXED:
        return "mixed"

    # 2) heuristika z názvu (ak ešte nič nepasovalo)
    if nm:
        if _name_re["soccer"].search(nm):
            return "soccer"
        if _name_re["strength"].search(nm):
            return "strength"
        if _name_re["skate"].search(nm):
            return "skate"
        if _name_re["run"].search(nm):
            return "run"
        if _name_re["ride"].search(nm):
            return "ride"
        if _name_re["walk"].search(nm):
            return "walk"
        if _name_re["hike"].search(nm):
            return "hike"
        if _name_re["swim"].search(nm):
            return "swim"
        if _name_re["hiit"].search(nm):
            return "hiit"
        if _name_re["padel"].search(nm):
            return "padel"
        if _name_re["pickleball"].search(nm):
            return "pickleball"
        if _name_re["badminton"].search(nm):
            return "badminton"
        if _name_re["yoga"].search(nm):
            return "yoga"
        if _name_re["pilates"].search(nm):
            return "pilates"
        if _name_re["surfing"].search(nm):
            return "surfing"
        if _name_re["rock_climbing"].search(nm):
            return "rock_climbing"

    # 3) fallback
    return "other"