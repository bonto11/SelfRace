from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

from Modules.Supabase.auth import AuthCtx
from Services.user_prefs import service_load_user_settings
from Services.AI.provider.provider import ai_call_json_model
from Services.AI.session_preview.prompts import (
    build_prompts_for_session_preview,
)
from Services.AI.utils.others import debug_log_ai_io


# ============================================================
# HELPERS
# ============================================================

def _tzinfo_from_settings(
    settings: Dict[str, Any],
) -> timezone | ZoneInfo:
    """
    Vráti timezone používateľa.

    Fallback:
      1. Europe/Bratislava
      2. UTC, ak je timezone neplatná
    """
    tz_name = settings.get("timezone") or "Europe/Bratislava"

    try:
        return ZoneInfo(str(tz_name))
    except Exception:
        return timezone.utc


def _now_local_iso(tzinfo: timezone | ZoneInfo) -> str:
    """Aktuálny čas v používateľovej timezone ako ISO string."""
    return datetime.now(tzinfo).isoformat()


def _get_trace_from_result(res: Any) -> Dict[str, Any]:
    """
    Vytiahne trace z výsledku AI providera.

    Trace sa používa pre:
      - debug,
      - billing,
      - identifikáciu skutočne použitého providera a modelu.
    """
    trace = getattr(res, "trace", None)

    if isinstance(trace, dict):
        return trace

    provider = str(getattr(res, "provider", None) or "unknown")
    model = str(getattr(res, "model", None) or "") or None

    return {
        "provider": provider,
        "ok_provider": provider,
        "ok_model": model,
    }


def _safe_session_id(
    context_payload: Dict[str, Any],
) -> Optional[int]:
    """
    Pokúsi sa vytiahnuť ID plánovanej session.

    Podporuje napríklad:
      context_payload.session.id
      context_payload.session.session_id
      context_payload.planned_session.id
      context_payload.plan_session.id
      context_payload.session_id
    """
    try:
        candidates: list[Any] = [
            context_payload.get("session_id"),
        ]

        for key in ("session", "planned_session", "plan_session"):
            block = context_payload.get(key)

            if isinstance(block, dict):
                candidates.extend(
                    [
                        block.get("id"),
                        block.get("session_id"),
                        block.get("plan_session_id"),
                    ]
                )

        for value in candidates:
            if value is None:
                continue

            try:
                return int(value)
            except (TypeError, ValueError):
                continue

        return None

    except Exception:
        return None


def _safe_plan_id(
    context_payload: Dict[str, Any],
) -> Optional[str]:
    """
    Vytiahne plan_id z rootu alebo zo session bloku.
    """
    try:
        root_value = context_payload.get("plan_id")

        if root_value is not None and str(root_value).strip():
            return str(root_value).strip()

        for key in ("session", "planned_session", "plan_session"):
            block = context_payload.get(key)

            if not isinstance(block, dict):
                continue

            value = block.get("plan_id")

            if value is not None and str(value).strip():
                return str(value).strip()

        return None

    except Exception:
        return None


def _safe_session_date(
    context_payload: Dict[str, Any],
) -> Optional[str]:
    """
    Vytiahne dátum plánovanej session.

    Vracia pôvodnú string hodnotu, pretože môže ísť o:
      YYYY-MM-DD
      ISO datetime
    """
    try:
        candidates: list[Any] = [
            context_payload.get("plan_date"),
            context_payload.get("session_date"),
            context_payload.get("date"),
        ]

        for key in ("session", "planned_session", "plan_session"):
            block = context_payload.get(key)

            if isinstance(block, dict):
                candidates.extend(
                    [
                        block.get("plan_date"),
                        block.get("session_date"),
                        block.get("date"),
                    ]
                )

        for value in candidates:
            if isinstance(value, str) and value.strip():
                return value.strip()

        return None

    except Exception:
        return None


def _safe_sport(
    context_payload: Dict[str, Any],
) -> str:
    """
    Vytiahne šport z rootu alebo zo session bloku.
    """
    try:
        root_sport = context_payload.get("sport")

        if isinstance(root_sport, str) and root_sport.strip():
            return root_sport.strip().lower()

        for key in ("session", "planned_session", "plan_session"):
            block = context_payload.get(key)

            if not isinstance(block, dict):
                continue

            sport = block.get("sport")

            if isinstance(sport, str) and sport.strip():
                return sport.strip().lower()

        return "other"

    except Exception:
        return "other"


# ============================================================
# HLAVNÁ FUNKCIA
# ============================================================

def generate_session_preview_json(
    *,
    context_payload: Dict[str, Any],
    ctx: AuthCtx,
    model: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any], Optional[str]]:
    """
    Vygeneruje AI preview plánovanej tréningovej session.

    Používa rovnakú AI infraštruktúru ako activity review:
      - používateľské nastavenia,
      - timezone,
      - centrálny AI provider,
      - modelové/provider fallbacky,
      - debug logging,
      - jednotný trace.

    Vracia:
      (
        data alebo None,
        trace,
        error_message alebo None,
      )

    Pri úspechu:
      data je validný preview JSON.

    Pri zlyhaní:
      data = None
      trace stále obsahuje informácie o pokusoch
      error_message obsahuje dôvod zlyhania
    """

    # --------------------------------------------------------
    # 1. Používateľské nastavenia
    # --------------------------------------------------------

    settings: Dict[str, Any] = {}

    if user_id is not None:
        try:
            settings = (
                service_load_user_settings(
                    user_id=int(user_id),
                    ctx=ctx,
                )
                or {}
            )
        except Exception as e:
            print(
                "[SESSION-PREVIEW][generate] settings load error:",
                repr(e),
            )

    tzinfo = _tzinfo_from_settings(settings)

    # --------------------------------------------------------
    # 2. Prompt
    # --------------------------------------------------------

    system_txt, user_txt = build_prompts_for_session_preview(
        context_payload=context_payload,
        settings=settings,
    )

    # --------------------------------------------------------
    # 3. AI provider
    # --------------------------------------------------------

    res = ai_call_json_model(
        context_payload=context_payload,
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=model,
    )

    trace = _get_trace_from_result(res)

    # Centrálne zaznamenanie promptu, odpovede a trace.
    debug_log_ai_io(
        system_txt,
        user_txt,
        res.data if res.ok else None,
        trace,
    )

    # --------------------------------------------------------
    # 4. Úspešná odpoveď
    # --------------------------------------------------------

    if res.ok and isinstance(res.data, dict):
        parsed: Dict[str, Any] = dict(res.data)

        parsed.setdefault("schema_version", 1)
        parsed.setdefault(
            "generated_at",
            _now_local_iso(tzinfo),
        )

        # Reálny model, ktorý nakoniec odpovedal.
        ok_model = str(
            res.model
            or model
            or trace.get("ok_model")
            or "unknown"
        )

        parsed["model"] = str(
            parsed.get("model")
            or ok_model
        )

        # Bezpečné meta fallbacky.
        parsed.setdefault(
            "session_id",
            _safe_session_id(context_payload),
        )
        parsed.setdefault(
            "plan_id",
            _safe_plan_id(context_payload),
        )
        parsed.setdefault(
            "session_date",
            _safe_session_date(context_payload),
        )
        parsed.setdefault(
            "sport",
            _safe_sport(context_payload),
        )

        parsed.setdefault("meta", {})

        if isinstance(parsed["meta"], dict):
            parsed["meta"].setdefault(
                "timezone",
                settings.get("timezone")
                or "Europe/Bratislava",
            )
            parsed["meta"].setdefault(
                "language",
                settings.get("language")
                or settings.get("locale")
                or "sk",
            )

        return parsed, trace, None

    # --------------------------------------------------------
    # 5. AI zlyhalo aj po fallbackoch
    # --------------------------------------------------------

    error_obj = getattr(res, "error", None)
    error_msg = (
        getattr(error_obj, "message", None)
        if error_obj is not None
        else None
    )

    if not error_msg:
        error_msg = "AI fallback system failed"

    return None, trace, str(error_msg)