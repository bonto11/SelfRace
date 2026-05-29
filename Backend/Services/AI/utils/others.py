import copy
import os
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

def _debug_log_ai_io(
    system_prompt: str,
    user_prompt: str,
    result: Optional[dict],
    trace: dict,
) -> None:
    """Loguje input/output do AI"""
    
    input_tokens_est = (len(system_prompt) + len(user_prompt)) // 4
    output_tokens_est = len(json.dumps(result or {})) // 4
    
    print(f"\n{'='*60}")
    print(f"[AI DEBUG] Provider: {trace.get('ok_provider')} | Model: {trace.get('ok_model')}")
    print(f"[AI DEBUG] Input est: ~{input_tokens_est} tokens | Output est: ~{output_tokens_est} tokens")
    print(f"[AI DEBUG] SYSTEM PROMPT:\n{system_prompt[:500]}...")
    print(f"[AI DEBUG] USER PROMPT (last 1000 chars):\n...{user_prompt[-1000:]}")
    print(f"[AI DEBUG] RESULT KEYS: {list(result.keys()) if result else 'None'}")
    print(f"{'='*60}\n")

