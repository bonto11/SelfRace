# Services/AI/prefs_suggest/main.py
"""
AI návrh nastavenia coach prefs z textu cieľa („povedz, čo chceš dosiahnuť“).

Nič sa neukladá: návrh = zoznam zmien povolených polí (fields.py) s
vysvetlením prečo a ako sa prejavia v pláne. User na FE odškrtne, čo
nechce, a vybrané zmeny sa uložia bežnou cestou coach prefs (rovnaké
poistky ako pri ručnej zmene). Konverzácia (návrh + 2 úpravy) žije na FE.

Neplatné zmeny (neznáme pole, hodnota mimo rozsahu, bez zmeny) sa zahodia.
Bez textu odpovede = ai_generation_failed a neúčtuje sa.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx
from Services.AI.prefs_suggest.builders import build_prefs_suggest_input
from Services.AI.prefs_suggest.fields import get_path, validate_change
from Services.AI.prefs_suggest.generate import generate_prefs_suggest_json
from Services.AI.utils.billing import (
    ai_output_has_text,
    extract_usage_from_trace,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
    log_ai_usage_for_user,
)

MAX_ROUNDS = 3
MAX_TODO = 3


def _txt(v: Any, limit: int) -> Optional[str]:
    s = str(v or "").strip()
    return s[:limit] if s else None


def _same(a: Any, b: Any) -> bool:
    return json.dumps(a, sort_keys=True, default=str) == json.dumps(b, sort_keys=True, default=str)


def normalize_changes(raw: Any, prefs: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    seen = set()
    for c in raw if isinstance(raw, list) else []:
        if not isinstance(c, dict):
            continue
        field = str(c.get("field") or "")
        ok, value = validate_change(field, c.get("value"))
        if not ok or field in seen:
            continue
        if _same(value, get_path(prefs, field)):
            continue
        value_text = _txt(c.get("value_text"), 120)
        if not value_text:
            continue
        seen.add(field)
        out.append({
            "field": field,
            "value": value,
            "value_text": value_text,
            "from_text": _txt(c.get("from_text"), 120),
            "why": _txt(c.get("why"), 400),
            "effect": _txt(c.get("effect"), 400),
        })
    # hlavný šport nesmie ostať aj v doplnkových
    main = next((c["value"] for c in out if c["field"] == "main_sport"), prefs.get("main_sport"))
    for c in out:
        if c["field"] == "add_on_sports" and main in c["value"]:
            c["value"] = [s for s in c["value"] if s != main]
    return out


def _rounds_used(thread: Any) -> int:
    if not isinstance(thread, list):
        return 0
    return sum(1 for e in thread if isinstance(e, dict) and e.get("role") == "assistant")


def service_prefs_suggest(*, user_id: int, request: Optional[str], thread: Any, ctx: AuthCtx) -> Dict[str, Any]:
    used = _rounds_used(thread)
    if used >= MAX_ROUNDS:
        return {"ok": False, "code": "limit_reached"}
    text = str(request or "").strip()
    if not text:
        return {"ok": False, "code": "empty_comment" if used else "empty_request"}

    if is_user_over_token_quota(user_id, ctx=ctx):
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "used_tokens_this_month": get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id),
        }

    payload = build_prefs_suggest_input(user_id, request=text, thread=thread, ctx=ctx)
    prefs = payload.pop("_prefs", {}) or {}
    data, trace, err = generate_prefs_suggest_json(payload)
    if not data:
        print(f"❌ [PREFS-SUGGEST] AI failed user={user_id}: {err}")
        return {"ok": False, "code": "ai_generation_failed"}
    if not ai_output_has_text(data, "reply_text"):
        print(f"❌ [PREFS-SUGGEST] empty AI output user={user_id}, not billed")
        return {"ok": False, "code": "ai_generation_failed"}

    changes = normalize_changes(data.get("changes"), prefs)
    todo = [t for t in (_txt(x, 200) for x in (data.get("todo") or [])) if t][:MAX_TODO] if isinstance(
        data.get("todo"), list
    ) else []

    usage = extract_usage_from_trace(trace, model_fallback=data.get("model"))
    if usage:
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.prefs_suggest",
                source="user",
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "round": used + 1,
                    "changes": len(changes),
                    "provider": trace.get("ok_provider"),
                    "model": trace.get("ok_model"),
                },
                ctx=ctx,
            )
        except Exception as e:  # noqa: BLE001
            print(f"❌ [AI_BILLING] prefs_suggest error: {repr(e)}")

    return {
        "ok": True,
        "reply_text": str(data.get("reply_text") or "").strip(),
        "changes": changes,
        "todo": todo,
        "rounds_left": max(0, MAX_ROUNDS - used - 1),
    }
