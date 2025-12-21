# Services/time.py
from __future__ import annotations

from datetime import datetime, timedelta, timezone, date, time
from fastapi import HTTPException
from typing import Optional, Union

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

import re
from typing import Optional, Tuple

# mm:ss (napr. 5:32, 12:09)
_TIME_MMSS = re.compile(r"^(?P<m>\d{1,2}):(?P<s>[0-5]\d)$")

# hh:mm:ss (napr. 01:05:32, 2:03:07)
_TIME_HHMMSS = re.compile(r"^(?P<h>\d{1,2}):(?P<m>[0-5]\d):(?P<s>[0-5]\d)$")

def is_time(
    s: str,
    *,
    allow_mmss: bool = True,
    allow_hhmmss: bool = True,
    max_hours: int = 23
) -> bool:
    """
    Overí, či string `s` predstavuje čas vo formáte mm:ss alebo hh:mm:ss.

    - `allow_mmss`    : povoliť formát mm:ss (napr. 5:32)
    - `allow_hhmmss`  : povoliť formát hh:mm:ss (napr. 01:05:32)
    - `max_hours`     : horný limit hodín (vrátane) pre hh:mm:ss

    Príklady:
      is_time("5:32")            -> True
      is_time("00:59")           -> True
      is_time("1:02:03")         -> True
      is_time("25:00:00")        -> False (ak max_hours=23)
      is_time("7:70")            -> False
    """
    if not isinstance(s, str) or not s:
        return False

    if allow_mmss:
        m = _TIME_MMSS.match(s)
        if m:
            # minúty môžu byť aj >59 (bežecké časy – napr. 75:30)
            minutes = int(m.group("m"))
            seconds = int(m.group("s"))
            return 0 <= seconds <= 59 and minutes >= 0

    if allow_hhmmss:
        m = _TIME_HHMMSS.match(s)
        if m:
            hours = int(m.group("h"))
            minutes = int(m.group("m"))
            seconds = int(m.group("s"))
            return (0 <= hours <= max_hours) and (0 <= minutes <= 59) and (0 <= seconds <= 59)

    return False

def _day_floor_utc(d: date) -> datetime:
    return datetime.combine(d, time(0, 0, 0, tzinfo=timezone.utc))

def since_weeks_utc(weeks: int) -> datetime:
    # okno = (weeks + 1) kvôli zásahu do predchádzajúceho týždňa
    return _day_floor_utc((datetime.now(timezone.utc) - timedelta(weeks=weeks + 1)).date())

def parse_date_ymd(s: str) -> date:
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date '{s}', expected YYYY-MM-DD")

def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def birth_to_iso_date(val: Optional[Union[str, date, datetime]]) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, str):
        return val  # očakávame "YYYY-MM-DD"
    if isinstance(val, date) and not isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, datetime):
        return val.date().isoformat()
    return None
