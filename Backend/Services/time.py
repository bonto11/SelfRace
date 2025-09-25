# Services/time.py
from datetime import datetime, timedelta, timezone, date

def hhmmss_to_seconds(s: str | None) -> int | None:
    if not s:
        return None
    try:
        parts = [int(x) for x in s.split(":")]
        if len(parts) == 3:
            h, m, sec = parts
        elif len(parts) == 2:
            h, m, sec = 0, parts[0], parts[1]
        else:
            return None
        return h * 3600 + m * 60 + sec
    except Exception:
        return None


def seconds_to_hhmmss(sec: int | None) -> str | None:
    if sec is None:
        return None
    h = sec // 3600
    m = (sec % 3600) // 60
    s = sec % 60
    return f"{h:02d}:{m:02d}:{s:02d}"

def iso_date(d: datetime | date | str) -> str:
    """Normalize to YYYY-MM-DD (string)."""
    if isinstance(d, str):
        return d[:10]
    if isinstance(d, datetime):
        return d.date().isoformat()
    return d.isoformat()

def week_key(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"

def week_bounds(iso_key: str) -> tuple[date, date]:
    y = int(iso_key.split("-W")[0])
    w = int(iso_key.split("-W")[1])
    start = date.fromisocalendar(y, w, 1)
    end = start + timedelta(days=6)
    return start, end
