from __future__ import annotations

from typing import Optional, Union
from datetime import datetime, date, timezone


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
