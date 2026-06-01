import copy
import json
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

        
def debug_log_ai_io(
    system_prompt: str,
    user_prompt: str,
    result: Optional[dict],
    trace: dict,
) -> None:
    """Loguje input/output do AI — kompaktne pre Railway."""
    
    input_tokens_est = (len(system_prompt) + len(user_prompt)) // 4
    output_tokens_est = len(json.dumps(result or {})) // 4
    
    # Jeden riadok — provider, model, tokeny
    print(f"[AI DEBUG] {trace.get('ok_provider')}:{trace.get('ok_model')} | in:~{input_tokens_est}t out:~{output_tokens_est}t")
    
    # Context JSON — posledných 500 znakov user promptu (tam je schéma a rules)
    print(f"[AI DEBUG] PROMPT_TAIL: {user_prompt[-500:]!r}")
    
    # Celý výstup na jeden riadok
    print(f"[AI DEBUG] RESULT: {json.dumps(result, ensure_ascii=False)[:2000] if result else 'None'}")
    
    # Trace — attempts ak zlyhalo
    attempts = trace.get('attempts') or []
    if attempts:
        print(f"[AI DEBUG] ATTEMPTS: {json.dumps(attempts, ensure_ascii=False)}")