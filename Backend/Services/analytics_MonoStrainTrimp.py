from __future__ import annotations
from datetime import date, timedelta
import math, statistics
from typing import Optional

# Services/analytics.py
# ČO: analytické helpery pre weekly agregáciu (bucketovanie športov, TRIMP, monotony/strain)
# POUŽITIE: importuj v Routes/analytics.py:
#   from Services.analytics import sport_bucket, compute_trimp, monotony_and_strain

# TRIMP – metodika:
# - Bannister TRIMP (presnejší): vyžaduje HR_max aj RHR (resting HR), používa HR reserve (HRr).
#   TRIMP = duration_min * HRr * k * exp(c * HRr), kde:
#     HRr = (HRavg - HRrest) / (HRmax - HRrest)
#     k, c – pohlavie-špecifické koeficienty (literatúra: muži ~0.64/1.92, ženy ~0.86/1.67).
# - Edwards TRIMP (fallback): nevyžaduje RHR, používa zónové váhy z %HRmax.
#   50–60%:1, 60–70%:2, 70–80%:3, 80–90%:4, 90–100%:5; TRIMP = čas_min * váha.
#
# Praktická poznámka:
# - Bannister je citlivý na RHR v daný deň. Ideál je použiť RHR nameraný najbližšie PRED tréningom.
# - Ak RHR pre daný deň/aktivitu nemáš, fallback na Edwards zabezpečí robustnosť a nízku chybovosť.
# - Tento modul NEROBÍ žiadne DB query (performance, čitateľnosť). RHR si do neho dodaj ako číslo.
#   V prípade potreby si vo vrstve routes/services pred-vyber "najbližší RHR" z tvojich “recovery” tabuliek.


def sport_bucket(s: str, distance_m: Optional[float] = None) -> str:
    """
    Koše: run, ride, strength, skate, mixed, other
    - 'trail_run' / 'trailrun' -> run
    - 'inline' / 'inlineskate' / 'roller' -> skate
    - 'workout' / 'mixed' / 'brick' / 'duathlon' / 'triathlon' -> mixed (ak je vzdialenosť > 0)
    - fallback: ak je neznáme a distance > 0, ber mixed, inak other
    """
    s = (s or "").lower()

    # beh (vrátane trailu)
    if s in ("trail_run", "trailrun", "trail-running", "trailrunning"):
        return "run"
    if "run" in s:
        return "run"

    # bicykel
    if any(
        k in s for k in ("ride", "bike", "cycle", "cycling", "virtual_ride", "ebike")
    ):
        return "ride"

    # sila
    if any(k in s for k in ("strength", "weight", "weighttraining", "gym", "crossfit")):
        return "strength"

    # korčule
    if any(
        k in s
        for k in (
            "skate",
            "inlineskate",
            "inline",
            "roller",
            "rollerskate",
            "rollerblade",
        )
    ):
        return "skate"

    # mixované tréningy
    if any(
        k in s for k in ("workout", "cross", "mixed", "brick", "duathlon", "triathlon")
    ):
        return "mixed" if (distance_m or 0) > 0 else "other"

    # fallback – nech sa km nestratia
    if (distance_m or 0) > 0:
        return "mixed"

    return "other"


def _trimp_banister(
    avg_hr: float, dur_min: float, hr_max: float, rhr: float, sex: Optional[str]
) -> float:
    """
    Banister TRIMP (sex-špecifické koeficienty).
    TRIMP = duration_min * HRr * k * exp(c * HRr)
    kde HRr = (HRavg - HRrest) / (HRmax - HRrest)
    """
    denom = hr_max - rhr
    if denom <= 0:
        return 0.0
    hrr = (avg_hr - rhr) / denom
    if hrr <= 0:
        return 0.0

    if (sex or "").upper() == "F":
        k, c = 0.86, 1.67
    else:
        k, c = 0.64, 1.92

    return float(dur_min * hrr * k * math.exp(c * hrr))


def _trimp_edwards(avg_hr: float, dur_min: float, hr_max: float) -> float:
    """
    Edwards TRIMP – nepotrebuje RHR.
    Zóny podľa %HRmax: <60:1, 60–69:2, 70–79:3, 80–89:4, >=90:5 (body/min).
    """
    if hr_max <= 0:
        return 0.0
    pct = avg_hr / hr_max
    if pct < 0.60:
        w = 1
    elif pct < 0.70:
        w = 2
    elif pct < 0.80:
        w = 3
    elif pct < 0.90:
        w = 4
    else:
        w = 5
    return float(w * dur_min)


def compute_trimp(
    avg_hr: Optional[float],
    dur_min: float,
    hr_max: Optional[float],
    rhr: Optional[float],
    sex: Optional[str],
) -> float:
    """
    Hybrid TRIMP:
      - Ak máme avg_hr, hr_max a rhr -> Banister (presnejší).
      - Ak chýba rhr (alebo je nezmysel), padáme na Edwards (robustné, lacné).
      - Ak chýba avg_hr alebo hr_max -> 0.
    """
    try:
        if not avg_hr or not hr_max:
            return 0.0
        if rhr is None or rhr <= 0 or rhr >= hr_max:
            return _trimp_edwards(float(avg_hr), float(dur_min), float(hr_max))
        return _trimp_banister(
            float(avg_hr), float(dur_min), float(hr_max), float(rhr), sex
        )
    except Exception:
        return 0.0


def monotony_and_strain(
    day_dict: dict[str, float], week_start: date, week_total: float
) -> tuple[float, float]:
    """
    Foster:
      monotony = mean/SD zo 7 dní (vrátane nulových),
      strain   = total * monotony
    """
    vals = [
        float(day_dict.get((week_start + timedelta(days=i)).isoformat(), 0.0))
        for i in range(7)
    ]
    mean = statistics.fmean(vals) if vals else 0.0
    sd = statistics.pstdev(vals) if len(vals) > 1 else 0.0
    mono = (mean / sd) if sd > 0 else 0.0
    return mono, week_total * mono