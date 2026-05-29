import copy
from datetime import date, datetime, timezone, timedelta
from typing import Any, Dict, Optional, List


def _check_is_returning_beginner(analyze_input: Dict[str, Any]) -> bool:
    """
    Detekuje vracajúceho sa začiatočníka:
    - žiadne aktivity v posledných 42 dňoch
    - alebo vôbec žiadne aktivity
    """
    last_activities = analyze_input.get("last_activities") or []
    if not last_activities:
        return True

    latest_date_str: Optional[str] = None
    for act in last_activities:
        d = (
            act.get("start_date_local")
            or act.get("start_date")
            or act.get("date")
        )
        if d and (latest_date_str is None or d > latest_date_str):
            latest_date_str = d

    if not latest_date_str:
        return True

    try:
        latest_dt = date.fromisoformat(latest_date_str[:10])
        return (date.today() - latest_dt).days > 42
    except Exception:
        return False
