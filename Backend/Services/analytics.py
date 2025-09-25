# Services/analytics
# ČO: analytické helpery pre weekly agregáciu (bucketovanie športov, TRIMP, monotony/strain)
# POUŽITIE: importuj v Routes/analytics.py:
#   from Services.analytics import sport_bucket, compute_trimp, monotony_and_strain

from datetime import date, timedelta
import math, statistics
from typing import Optional


def sport_bucket(s: str, distance_m: Optional[float] = None) -> str:
    """
    Zaradenie aktivity do koša:
      - run, bike, strength, skate, mixed, other
    Pravidlá:
      - 'run' v názve → run
      - 'ride' | 'bike' | 'cycle' → bike
      - 'strength' | 'weight' | 'gym' → strength
      - 'skate' | 'skating' | 'inline' | 'roller' → skate
      - 'workout' | 'cross' | 'mixed' | 'brick' | 'duathlon' → mixed (ak distance_m > 0, inak other)
      - inak other
    """
    s = (s or "").lower()

    if "run" in s:  # run, trail_run (už sme na kanonike, ale pre istotu)
        return "run"

    if "ride" in s or "bike" in s or "cycle" in s or "cycling" in s:
        return "bike"

    if any(k in s for k in ("strength", "weight", "gym")):
        return "strength"

    if any(k in s for k in ("skate", "skating", "inline", "roller")):
        return "skate"

    if any(k in s for k in ("workout", "cross", "mixed", "brick", "duathlon", "triathlon")):
        # miešaná / workout session: ak má vzdialenosť, berieme ju ako MIXED (nech sa km nestratia)
        return "mixed" if (distance_m or 0) > 0 else "other"

    # fallback:
    # - ak je to „iné“, ale má nenulovú vzdialenosť (napr. 'workout' bez kľúčového slova),
    #   tiež to vieme zaradiť do mixed, nech km nezmiznú z prehľadu
    if (distance_m or 0) > 0:
        return "mixed"

    return "other"


def compute_trimp(avg_hr: Optional[float],
                  dur_min: float,
                  hr_max: Optional[float],
                  rhr: Optional[float],
                  sex: Optional[str]) -> float:
    """
    Banister TRIMP (sex-špecifické koeficienty).
    TRIMP = duration_min * HRr * k * exp(c * HRr)
    kde HRr = (HRavg - HRrest) / (HRmax - HRrest)
    """
    try:
        if not avg_hr or not hr_max or not rhr:
            return 0.0
        denom = (hr_max - rhr)
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
    except Exception:
        return 0.0


def monotony_and_strain(day_dict: dict[str, float],
                        week_start: date,
                        week_total: float) -> tuple[float, float]:
    """
    Foster:
      monotony = mean/SD zo 7 dní (vrátane nulových),
      strain   = total * monotony
    """
    vals = [float(day_dict.get((week_start + timedelta(days=i)).isoformat(), 0.0)) for i in range(7)]
    mean = statistics.fmean(vals) if vals else 0.0
    sd = statistics.pstdev(vals) if len(vals) > 1 else 0.0
    mono = (mean / sd) if sd > 0 else 0.0
    return mono, week_total * mono