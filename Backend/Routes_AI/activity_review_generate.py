# Routes_AI/activity_review_generate.py
from __future__ import annotations

from zoneinfo import ZoneInfo
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from Services.user_prefs import service_load_user_settings
from Services.AI.provider import ai_call_json_model


def _safe_user_id_from_context(context_payload: dict) -> Optional[int]:
    """
    user_id ber radšej z context_payload.user_id (autorita).
    """
    try:
        v = context_payload.get("user_id")
        if v is None:
            return None
        return int(v)
    except Exception:
        return None


def _safe_activity_id_from_context(context_payload: dict) -> Optional[int]:
    try:
        a = context_payload.get("activity") or {}
        if isinstance(a, dict):
            v = a.get("activity_id") or a.get("id")
            if v is None:
                return None
            return int(v)
        return None
    except Exception:
        return None


def _tzinfo_from_settings(settings: Dict[str, Any]) -> timezone | ZoneInfo:
    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        return ZoneInfo(str(tz_name))
    except Exception:
        return timezone.utc


def _now_local_iso(tzinfo: timezone | ZoneInfo) -> str:
    return datetime.now(tzinfo).isoformat()


def _trace_base(
    *,
    provider: str,
    model: str,
    debug_raw: bool,
    ai_debug_trace: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    t: Dict[str, Any] = {
        "provider": provider,
        "models_tried": [],
        "attempts": [],
        "usage": {},
        "ok_model": model,
    }

    if isinstance(ai_debug_trace, dict):
        mt = ai_debug_trace.get("models_tried")
        at = ai_debug_trace.get("attempts")
        if isinstance(mt, list):
            t["models_tried"] = mt
        if isinstance(at, list):
            t["attempts"] = at

        u = ai_debug_trace.get("usage")
        if isinstance(u, dict):
            t["usage"] = u

        if debug_raw:
            if "raw" in ai_debug_trace:
                t["raw"] = ai_debug_trace.get("raw")
            if "cleaned" in ai_debug_trace:
                t["cleaned"] = ai_debug_trace.get("cleaned")

    return t


def _build_prompts_for_activity_review(
    context_payload: dict,
    *,
    settings: Dict[str, Any],
) -> Tuple[str, str]:
    """
    Prompty držím inline, aby si nemusel hneď robiť nový prompts modul.
    Keď to bude stabilné, vyhodíme to do Routes_AI/activity_review_prompts.py.
    """

    # NOTE: system prompt drží "policy" + striktne JSON
    system_txt = """
You are a precise endurance coach. Return STRICT JSON only.
No markdown, no prose outside JSON. Never add extra keys.

You will receive:
- athlete context (zones/thresholds/recovery/load/prefs)
- one activity (summary + zones minutes + optional streams-derived features)
Your job: produce a short but useful review of that ONE session.

Be data-driven. If a field is missing, use null and explain in notes fields.
""".strip()

    # User instructions: schema + pravidlá
    user_txt = """
TASK:
1) Identify session_kind (recovery/easy/long/tempo/threshold/intervals/race/strength/other).
2) Evaluate execution quality (intensity distribution, pacing/effort consistency, match vs context).
3) Provide concise takeaways and next steps.

OUTPUT: STRICT JSON with this schema:

{
  "schema_version": 1,
  "generated_at": "iso",
  "model": "string",
  "activity_id": number|null,

  "session_kind": "recovery|easy|long|tempo|threshold|intervals|race|strength|other",
  "effort_rating_1_to_10": number|null,
  "execution_score_0_to_100": number|null,

  "intensity": {
    "dominant_zone": "Z1|Z2|Z3|Z4|Z5|null",
    "z_minutes": { "z1": number|null, "z2": number|null, "z3": number|null, "z4": number|null, "z5": number|null },
    "notes": "string|null"
  },

  "summary": {
    "headline": "string",
    "bullets": ["string"]
  },

  "highlights": ["string"],
  "risks": ["string"],
  "what_went_well": ["string"],
  "what_to_improve": ["string"],

  "next_steps": [
    { "type": "recovery|training|nutrition|sleep|mobility", "text": "string" }
  ]
}

CONSTRAINTS:
- Do NOT invent numbers not present in context_payload.
- Keep bullets short.
- If this looks like a strength session with no zones, focus on load/notes and recovery.
""".strip()

    return system_txt, user_txt


def generate_activity_review_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    Provider-aware (OpenAI/Gemini) generate activity review JSON.
    Zachováva success path + fallback štruktúru.
    """
    user_id = _safe_user_id_from_context(context_payload)
    activity_id = _safe_activity_id_from_context(context_payload)

    settings: Dict[str, Any] = {}
    if user_id:
        try:
            settings = service_load_user_settings(user_id) or {}
        except Exception:
            settings = {}

    tzinfo = _tzinfo_from_settings(settings)
    now_local = _now_local_iso(tzinfo)

    system_txt, user_txt = _build_prompts_for_activity_review(
        context_payload,
        settings=settings,
    )

    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
        debug_raw=debug_raw,
    )

    # --- Success path ---
    if getattr(res, "ok", False) and isinstance(getattr(res, "data", None), dict):
        parsed: Dict[str, Any] = dict(res.data)

        parsed["schema_version"] = int(parsed.get("schema_version") or 1)
        parsed["generated_at"] = parsed.get("generated_at") or now_local
        parsed["model"] = str(parsed.get("model") or getattr(res, "model", None) or model)
        parsed["activity_id"] = parsed.get("activity_id") or activity_id

        trace = _trace_base(
            provider=str(getattr(res, "provider", None) or "unknown"),
            model=str(getattr(res, "model", None) or model),
            debug_raw=debug_raw,
            ai_debug_trace=(getattr(getattr(res, "error", None), "trace", None) if debug_raw else None),
        )
        return parsed, (trace if debug_raw else None)

    # --- Failure path ---
    provider_name = str(getattr(res, "provider", None) or "unknown")
    used_model = str(getattr(res, "model", None) or model)

    err_msg = None
    try:
        err = getattr(res, "error", None)
        err_msg = getattr(err, "message", None) if err else None
    except Exception:
        err_msg = None

    last_err = err_msg or "AI provider call failed"

    fallback = {
        "schema_version": 1,
        "generated_at": now_local,
        "model": "activity-review-fallback",
        "activity_id": activity_id,
        "session_kind": "other",
        "effort_rating_1_to_10": None,
        "execution_score_0_to_100": None,
        "intensity": {
            "dominant_zone": None,
            "z_minutes": {"z1": None, "z2": None, "z3": None, "z4": None, "z5": None},
            "notes": last_err,
        },
        "summary": {
            "headline": "Nepodarilo sa získať AI hodnotenie aktivity.",
            "bullets": ["Skús to znova neskôr."],
        },
        "highlights": [],
        "risks": [last_err],
        "what_went_well": [],
        "what_to_improve": [],
        "next_steps": [{"type": "training", "text": "Skús to znova neskôr."}],
        "error": last_err,
    }

    trace = _trace_base(
        provider=provider_name,
        model=used_model,
        debug_raw=debug_raw,
        ai_debug_trace=(getattr(getattr(res, "error", None), "trace", None) if debug_raw else None),
    )
    if debug_raw:
        trace["error"] = last_err

    return fallback, (trace if debug_raw else None)