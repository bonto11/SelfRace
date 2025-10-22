# Services/analytics.py
# ČO: analytické helpery pre weekly agregáciu (bucketovanie športov, TRIMP, monotony/strain)
# POUŽITIE: importuj v Routes/analytics.py:
#   from Services.analytics import sport_bucket, compute_trimp, monotony_and_strain

from datetime import date, timedelta
import math, statistics
from typing import Optional

def sport_bucket(s: str, distance_m: Optional[float] = None) -> str:
    """
    Koše: run, bike, strength, skate, mixed, other
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
    if any(k in s for k in ("ride", "bike", "cycle", "cycling", "virtual_ride", "ebike")):
        return "bike"

    # sila
    if any(k in s for k in ("strength", "weight", "weighttraining", "gym", "crossfit")):
        return "strength"

    # korčule
    if any(k in s for k in ("skate", "inlineskate", "inline", "roller", "rollerskate", "rollerblade")):
        return "skate"

    # mixované tréningy
    if any(k in s for k in ("workout", "cross", "mixed", "brick", "duathlon", "triathlon")):
        return "mixed" if (distance_m or 0) > 0 else "other"

    # fallback – nech sa km nestratia
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