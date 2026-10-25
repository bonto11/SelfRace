# Services/AI/season_plan/generate.py
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from Configs.config import ai_model_for
from Services.AI.provider.provider import ai_call_json_model
from Services.AI.season_plan.prompts import build_prompts_for_season_plan
from Services.AI.utils.others import debug_log_ai_io


def generate_season_plan_json(
    payload: Dict[str, Any], *, model: Optional[str] = None
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    """(data, trace, chyba). data je None, keď AI zlyhalo aj po fallbackoch."""
    system_txt, user_txt = build_prompts_for_season_plan(payload)
    res = ai_call_json_model(
        context_payload=payload.get("context") or {},
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model or ai_model_for("season_plan"),
        # 16 týždňov po ~8 poliach – rezerva, nech sa JSON neodsekne
        max_tokens=6000,
    )
    trace = res.trace if isinstance(res.trace, dict) else {
        "ok_provider": res.provider,
        "ok_model": res.model,
    }
    debug_log_ai_io(system_txt, user_txt, res.data if res.ok else None, trace)
    if res.ok and isinstance(res.data, dict):
        data = dict(res.data)
        data.setdefault("model", str(res.model or model or "unknown"))
        return data, trace, None
    return None, trace, (res.error.message if res.error else "ai_failed")
