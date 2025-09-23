# services/aggregation.py
from datetime import date, timedelta
import math, statistics
from typing import Dict, Tuple

def week_key(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"

def week_bounds(iso_key: str) -> Tuple[date, date]:
    y = int(iso_key.split("-W")[0]); w = int(iso_key.split("-W")[1])
    start = date.fromisocalendar(y, w, 1)
    return start, start + timedelta(days=6)

def compute_trimp(avg_hr, dur_min, hr_max, rhr, sex) -> float:
    try:
        if not avg_hr or not hr_max or not rhr: return 0.0
        denom = hr_max - rhr
        if denom <= 0: return 0.0
        hrr = (avg_hr - rhr) / denom
        if hrr <= 0: return 0.0
        k, c = (0.86, 1.67) if (sex or "").upper()=="F" else (0.64, 1.92)
        return float(dur_min * hrr * k * math.exp(c * hrr))
    except Exception:
        return 0.0

def monotony_and_strain(day_dict: Dict[str, float], week_start: date, week_total: float) -> Tuple[float,float]:
    vals = [float(day_dict.get((week_start + timedelta(days=i)).isoformat(), 0.0)) for i in range(7)]
    mean = statistics.fmean(vals) if vals else 0.0
    sd = statistics.pstdev(vals) if len(vals)>1 else 0.0
    mono = (mean / sd) if sd>0 else 0.0
    return mono, week_total * mono