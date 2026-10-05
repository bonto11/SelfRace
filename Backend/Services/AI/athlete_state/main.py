# Services/AI/athlete_state/main.py
"""
Analýza stavu športovca.

ČO RIEŠI: aký je athlete športovec - trénovanosť, únava, riziko zranenia,
tolerancia objemu a intenzity, odhadované tempá a časy. Mení sa pomaly,
v horizonte týždňov.

ČO NERIEŠI: či je jeho tréningový plán dobre poskladaný. To je práca
Services/AI/advisor_review - samostatné AI volanie s vlastným promptom aj
tabuľkou. Spoločné volanie znamenalo, že kontrola plánu zbytočne
prepočítavala aj VO2max a tempá, a naopak nedeľný prepočet stavu prepísal
hodnotenie plánu bez toho, aby oň athlete požiadal.

Rovnaké pre coach aj advisor režim - stav športovca je stav športovca.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from DB.coach_athlete_state import (
    db_get_latest_athlete_progress,
    db_get_latest_state_for_user,
    db_get_latest_states_for_user,
    db_get_state_by_id,
    db_insert_athlete_state,
    db_list_states_for_user,
    db_update_state_compare_previous,
)
from DB.user_metrics import db_insert_metrics
from DB.user_pace_history import db_insert_pace_row
from DB.users import db_list_users_for_athlete_state
from Modules.Supabase.auth import AuthCtx
from Services.AI.athlete_state.builders import build_input_from_db
from Services.AI.athlete_state.generate import (
    generate_athlete_progress_report,
    generate_athlete_state_json,
)
from Services.AI.utils.activity_gate import RECENT_TRAINING_DAYS, user_trained_recently
from Services.AI.utils.athlete_state_signals import compute_plan_adjustment_signals
from Services.AI.utils.billing import (
    extract_usage_from_trace,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
    log_ai_usage_for_user,
    ai_output_has_text,
)

# Ako dlho je uložený athlete state považovaný za čerstvý. Interné volania
# (autoadjust) ho vtedy len prečítajú namiesto novej AI analýzy. Nedeľný
# job, generovanie plánu a manuálne volanie majú force=True.
STATE_FRESH_HOURS = 12


# ============================================================
# HELPERS
# ============================================================

def _now_iso() -> str:
    """Aktuálny UTC čas ako ISO string."""
    return datetime.now(timezone.utc).isoformat()


def _get_optional_int(v: Any) -> Optional[int]:
    """Bezpečná konverzia na int."""
    try:
        return int(v) if v is not None else None
    except Exception:  # noqa: BLE001
        return None


def _minify_context_for_ai(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Deep copy s konverziou neserializovateľných hodnôt na string."""
    return json.loads(json.dumps(payload, default=str))


# Level 1-5 -> label. PREČO V KÓDE: model dal "Hobby" k 2,5 a deň predtým
# "Intermediate" k 3 pri rovnakých dátach - label musí sedieť s číslom.
_LEVEL_LABELS = [(1.5, "Beginner"), (2.5, "Hobby"), (3.5, "Intermediate"), (4.5, "Performance")]
# Max zmena levelu medzi dvoma analýzami - level sa nemá hýbať zo dňa na deň.
MAX_LEVEL_STEP = 0.5


def _label_for_level(level: float) -> str:
    for limit, label in _LEVEL_LABELS:
        if level < limit:
            return label
    return "Elite"


def _previous_ai_state(user_id: int, *, ctx: AuthCtx) -> Optional[Dict[str, Any]]:
    """Levely a fáza z poslednej analýzy - pre stabilitu (prompt aj clamp)."""
    try:
        row = db_get_latest_state_for_user(user_id=user_id, version=1, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[AI-STATE] previous state load failed: {repr(e)}")
        return None
    ai_state = (((row or {}).get("state_json") or {}).get("ai_state")) or {}
    caps = ai_state.get("capabilities") or {}
    levels = {
        k: v.get("level_1_to_5")
        for k, v in caps.items()
        if isinstance(v, dict) and isinstance(v.get("level_1_to_5"), (int, float))
    }
    if not levels:
        return None
    return {
        "created_at": str((row or {}).get("created_at") or "")[:10],
        "levels": levels,
        "suggested_block_kind": ai_state.get("suggested_block_kind"),
    }


def _stabilize_capabilities(analysis: Dict[str, Any], previous: Optional[Dict[str, Any]]) -> None:
    """Level max ±0,5 oproti minulej analýze; label vždy podľa levelu."""
    caps = (analysis.get("ai_state") or {}).get("capabilities") or {}
    prev_levels = (previous or {}).get("levels") or {}
    for sport, cap in caps.items():
        if not isinstance(cap, dict):
            continue
        lvl = cap.get("level_1_to_5")
        if not isinstance(lvl, (int, float)):
            continue
        prev = prev_levels.get(sport)
        if isinstance(prev, (int, float)):
            lvl = max(prev - MAX_LEVEL_STEP, min(prev + MAX_LEVEL_STEP, float(lvl)))
        lvl = round(max(1.0, min(5.0, float(lvl))) * 2) / 2
        cap["level_1_to_5"] = lvl
        cap["label"] = _label_for_level(lvl)


def _clamp_volume_tolerance(analysis: Dict[str, Any], facts: Optional[Dict[str, Any]]) -> None:
    """
    weekly_minutes_min/max do rozsahu reálne zvládnutých týždňov (max +10 %).
    Text poznámky cituje observed_range_text z kódu, takže čísla sedia.
    """
    if not facts:
        return
    vol = (analysis.get("ai_state") or {}).get("volume_tolerance")
    if not isinstance(vol, dict):
        return
    hi = facts["observed_max"]
    cap = int(round(hi * 1.1 / 5) * 5)
    vmax = vol.get("weekly_minutes_max")
    vmin = vol.get("weekly_minutes_min")
    if isinstance(vmax, (int, float)):
        vol["weekly_minutes_max"] = int(min(vmax, cap))
    if isinstance(vmin, (int, float)):
        vol["weekly_minutes_min"] = int(min(vmin, vol.get("weekly_minutes_max") or vmin))


def _latest_state_age_hours(user_id: int, *, ctx: AuthCtx) -> Optional[float]:
    """Vek posledného uloženého stavu v hodinách, None ak žiadny nie je."""
    try:
        row = db_get_latest_state_for_user(user_id=user_id, version=1, ctx=ctx)
        created = (row or {}).get("created_at")
        if not created:
            return None
        dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).total_seconds() / 3600.0
    except Exception as e:  # noqa: BLE001
        print(f"[AI-STATE] latest state age check failed: {repr(e)}")
        return None


# ============================================================
# UKLADANIE VEDĽAJŠÍCH VÝSTUPOV Z AI
# ============================================================

def _maybe_save_estimated_vo2max(
    user_id: int, analysis: Dict[str, Any], ctx: AuthCtx
) -> None:
    """Uloží VO2max odhad z AI analýzy do user metrics ak existuje."""
    try:
        ai_state = analysis.get("ai_state") or {}
        metrics = ai_state.get("metrics") or {}
        vo2_val = metrics.get("estimated_vo2max")
        if vo2_val and isinstance(vo2_val, (int, float)):
            db_insert_metrics(
                [
                    {
                        "user_id": user_id,
                        "metric": "vo2max_estimated",
                        "value_num": float(vo2_val),
                        "unit": "ml/kg/min",
                        "measured_at": analysis.get("generated_at") or _now_iso(),
                        "source": "system",
                        "note": f"AI Estimate (model: {analysis.get('model')})",
                    }
                ],
                ctx=ctx,
            )
    except Exception as e:  # noqa: BLE001
        print(f"[AI-STATE] Error saving VO2Max metric: {repr(e)}")


def _maybe_save_estimated_paces(
    user_id: int, analysis: Dict[str, Any], ctx: AuthCtx
) -> None:
    """Uloží odhadované tempo zóny a race časy z AI analýzy do pace history."""
    try:
        ai_state = analysis.get("ai_state") or {}
        paces = ai_state.get("estimated_paces") or {}
        metrics = ai_state.get("metrics") or {}
        if not paces and not metrics:
            return

        def _get_int(d: dict, key: str) -> Optional[int]:
            val = d.get(key)
            if val is not None and isinstance(val, (int, float)):
                return int(val)
            return None

        row = {
            "user_id": user_id,
            "measured_at": analysis.get("generated_at") or _now_iso(),
            "z1_pace_s": _get_int(paces, "z1_pace_s"),
            "z2_pace_s": _get_int(paces, "z2_pace_s"),
            "z3_pace_s": _get_int(paces, "z3_pace_s"),
            "z4_pace_s": _get_int(paces, "z4_pace_s"),
            "z5_pace_s": _get_int(paces, "z5_pace_s"),
            "best_1k_s": _get_int(paces, "best_1k_s"),
            "est_5k_time_s": _get_int(metrics, "estimated_5k_time_s"),
            "est_10k_time_s": _get_int(metrics, "estimated_10k_time_s"),
            "est_half_marathon_time_s": _get_int(metrics, "estimated_half_marathon_time_s"),
            "est_marathon_time_s": _get_int(metrics, "estimated_marathon_time_s"),
        }
        has_data = any(
            v is not None for k, v in row.items() if k not in ("user_id", "measured_at")
        )
        if has_data:
            db_insert_pace_row(row, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[AI-STATE] Error saving estimated paces: {repr(e)}")


def _log_ai_usage(
    user_id: int,
    trace: Dict[str, Any],
    model: str,
    job_type: str,
    ctx: AuthCtx,
) -> None:
    """Zaloguje AI usage s provider a model z trace — pre billing a debug."""
    usage = extract_usage_from_trace(trace, model_fallback=model)
    if not usage:
        return
    try:
        log_ai_usage_for_user(
            user_id=user_id,
            usage=usage,
            job_type=job_type,
            source="user",
            billed_via="internal",
            charge_wallet=False,
            meta={
                "provider": trace.get("ok_provider"),
                "model": trace.get("ok_model"),
            },
            ctx=ctx,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[AI_BILLING] {job_type} billing error: {repr(e)}")


# ============================================================
# READ SERVICES
# ============================================================

def service_save_state_to_db(
    user_id: int, analysis: Dict[str, Any], *, ctx: AuthCtx
) -> Optional[int]:
    """Uloží AI state analýzu do DB a vráti state_id."""
    return db_insert_athlete_state(
        user_id=user_id,
        model=str(analysis.get("model")),
        state_json=analysis,
        version=int(analysis.get("schema_version") or 1),
        ctx=ctx,
    )


def service_get_athlete_state_by_id(
    state_id: int, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """Načíta konkrétny athlete state podľa ID."""
    row = db_get_state_by_id(state_id, ctx=ctx)
    if not row:
        return None
    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": row.get("state_json") or {},
        "compare_previous": row.get("compare_previous"),
    }


def service_get_latest_athlete_state(
    user_id: int, version: Optional[int] = 1, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """Načíta posledný athlete state pre usera — bez interných debug polí."""
    row = db_get_latest_state_for_user(user_id=user_id, version=version, ctx=ctx)
    if not row:
        return None

    full_state = row.get("state_json") or {}
    clean_state = full_state.get("analysis", full_state)
    clean_state.pop("input", None)
    clean_state.pop("debug_trace", None)

    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "state": clean_state,
        "compare_previous": row.get("compare_previous"),
    }


def service_list_athlete_states_meta(
    user_id: int, limit: int = 20, *, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """Zoznam athlete state metadát (bez state_json) pre daného usera."""
    rows = db_list_states_for_user(user_id=user_id, limit=limit, ctx=ctx)
    return [
        {
            "id": r.get("id"),
            "user_id": r.get("user_id"),
            "model": r.get("model"),
            "version": r.get("version"),
            "created_at": r.get("created_at"),
        }
        for r in (rows or [])
    ]


def service_get_latest_athlete_progress(
    user_id: int, *, version: Optional[int] = 1, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """Načíta posledný progress report pre usera."""
    row = db_get_latest_athlete_progress(user_id=user_id, version=version, ctx=ctx)
    if not row:
        return None
    return {
        "id": row.get("id"),
        "user_id": row.get("user_id"),
        "model": row.get("model"),
        "version": row.get("version"),
        "created_at": row.get("created_at"),
        "report": row.get("compare_previous") or None,
    }


# ============================================================
# CORE: ANALYZE ATHLETE
# ============================================================

def service_analyze_athlete(
    user_id: int,
    *,
    ctx: AuthCtx,
    model: Optional[str] = None,
    force: bool = True,
) -> Dict[str, Any]:
    """
    Hlavný service pre AI analýzu stavu športovca.
    Zostaví kontext z DB, zavolá AI, uloží výsledky, spustí progress
    porovnanie. Rovnaký pre coach aj advisor režim.

    force: False = ak je posledný stav mladší než STATE_FRESH_HOURS, AI sa
        vôbec nevolá a vráti sa uložený stav. Používa to autoadjust -
        soften/replan stojí hlavne na recent load, ktoré sa počíta vždy
        nanovo, takže deň starý stav mu stačí.

    Táto funkcia NEKONTROLUJE, či user trénuje - ručné spustenie musí
    fungovať vždy. Bránu má len nedeľný job.
    """
    if not force:
        age = _latest_state_age_hours(user_id, ctx=ctx)
        if age is not None and age < STATE_FRESH_HOURS:
            cached = service_get_latest_athlete_state(user_id, version=1, ctx=ctx)
            if cached:
                print(
                    f"[AI-STATE] user={user_id} reusing state "
                    f"(age {age:.1f}h < {STATE_FRESH_HOURS}h), no AI call."
                )
                return {
                    "ok": True,
                    "state_id": cached.get("id"),
                    "model": cached.get("model"),
                    "analysis": cached.get("state") or {},
                    "from_cache": True,
                    "error": None,
                }

    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "message": "Mesačný limit AI analýz bol vyčerpaný.",
            "used_tokens_this_month": used,
        }

    input_data = build_input_from_db(user_id=user_id, ctx=ctx)
    context_for_ai = _minify_context_for_ai(input_data)

    u = context_for_ai.get("user")
    if isinstance(u, dict):
        u.pop("id", None)

    prefs_block = context_for_ai.get("prefs") or {}
    if isinstance(prefs_block, dict):
        pv = prefs_block.get("value")
        if isinstance(pv, dict):
            pv.pop("external_activities", None)
        prefs_block.pop("external_activities", None)

    previous_ai_state = _previous_ai_state(user_id, ctx=ctx)
    if previous_ai_state:
        context_for_ai["previous_assessment"] = previous_ai_state

    analysis, trace, err_msg = generate_athlete_state_json(
        context_payload=context_for_ai,
        model=model,
        ctx=ctx,
    )

    if not analysis:
        return {"ok": False, "code": "ai_generation_failed", "message": err_msg}

    # Výstup bez zhrnutia user nevidí ako analýzu - neukladá sa ani neúčtuje.
    if not ai_output_has_text(analysis, "user_summary.headline") or not isinstance(
        analysis.get("ai_state"), dict
    ):
        print(f"[service_analyze_athlete] user={user_id} AI output invalid, not billed")
        return {"ok": False, "code": "ai_generation_failed", "message": "invalid_ai_output"}

    analysis.setdefault("schema_version", 1)
    analysis.setdefault("generated_at", _now_iso())

    _stabilize_capabilities(analysis, previous_ai_state)
    _clamp_volume_tolerance(analysis, input_data.get("volume_facts"))

    try:
        signals = compute_plan_adjustment_signals(
            analyze_input=input_data, analysis=analysis
        )
    except Exception as e:  # noqa: BLE001
        print(f"[service_analyze_athlete] plan_adjustment error: {repr(e)}")
        signals = {
            "soften_next_days": {"should_soften": False, "days": None, "reason": None},
            "should_replan_weekly": False,
            "weekly_replan_reason": None,
        }

    ai_state = analysis.setdefault("ai_state", {})
    soften = signals.get("soften_next_days") or {}
    ai_state["plan_adjustment"] = {
        "soften_next_days": {
            "should_soften": bool(soften.get("should_soften")),
            "days": soften.get("days"),
            "reason": soften.get("reason"),
        },
        "should_replan_weekly": bool(signals.get("should_replan_weekly")),
        "weekly_replan_reason": signals.get("weekly_replan_reason"),
    }

    state_id = service_save_state_to_db(user_id=user_id, analysis=analysis, ctx=ctx)

    # Billing až po uložení - keď sa analýza neuloží, user ju neuvidí a neplatí za ňu.
    if state_id is not None:
        _log_ai_usage(
            user_id, trace, str(analysis.get("model") or ""), "coach.analyze_state", ctx
        )

    _maybe_save_estimated_vo2max(user_id, analysis, ctx)
    _maybe_save_estimated_paces(user_id, analysis, ctx)

    compare_previous: Optional[Dict[str, Any]] = None
    try:
        progress_result = service_compare_latest_athlete_states(
            user_id=user_id,
            version=int(analysis.get("schema_version") or 1),
            model=model,
            ctx=ctx,
        )
        if progress_result.get("ok") and progress_result.get("report"):
            compare_previous = progress_result.get("report")
    except Exception as e:  # noqa: BLE001
        print(f"[service_analyze_athlete] compare_previous error: {repr(e)}")

    resp: Dict[str, Any] = {
        "ok": True,
        "state_id": state_id,
        "model": str(analysis.get("model") or ""),
        "analysis": analysis,
        "error": None,
    }
    if compare_previous is not None:
        resp["compare_previous"] = compare_previous

    return resp


# ============================================================
# CORE: COMPARE STATES
# ============================================================

def service_compare_latest_athlete_states(
    user_id: int,
    *,
    version: Optional[int] = 1,
    ctx: AuthCtx,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Porovná dva posledné athlete states a vygeneruje progress report.
    model=None = provider použije default z ENV.
    """
    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "message": "Mesačný limit AI analýz bol vyčerpaný.",
            "used_tokens_this_month": used,
        }

    rows = db_get_latest_states_for_user(
        user_id=user_id, limit=2, version=version, ctx=ctx
    )
    if len(rows or []) < 2:
        return {
            "ok": False,
            "code": "not_enough_states",
            "message": "Na porovnanie sú potrebné aspoň dve AI analýzy.",
        }

    current = rows[0]
    previous = rows[1]

    report, trace, err_msg = generate_athlete_progress_report(
        previous_state=previous.get("state_json") or {},
        current_state=current.get("state_json") or {},
        model=model,
        user_id=user_id,
        ctx=ctx,
    )

    if not report:
        return {"ok": False, "code": "ai_generation_failed", "message": err_msg}

    if not ai_output_has_text(report, "summary.headline"):
        print(f"[service_compare] user={user_id} AI output invalid, not billed")
        return {"ok": False, "code": "ai_generation_failed", "message": "invalid_ai_output"}

    report.setdefault("schema_version", 1)
    report.setdefault("generated_at", _now_iso())

    # Report sa vracia priamo do FE, takže sa účtuje aj keď uloženie k state zlyhá.
    _log_ai_usage(
        user_id, trace, str(report.get("model") or ""), "coach.progress_report", ctx
    )

    try:
        sid = _get_optional_int(current.get("id"))
        if sid is not None:
            db_update_state_compare_previous(
                state_id=sid, compare_previous=report, ctx=ctx
            )
    except Exception as e:  # noqa: BLE001
        print(f"[service_compare] db_update error: {repr(e)}")

    return {
        "ok": True,
        "user_id": user_id,
        "version": version,
        "current_state_id": current.get("id"),
        "previous_state_id": previous.get("id"),
        "current_created_at": current.get("created_at"),
        "previous_created_at": previous.get("created_at"),
        "report": report,
        "source": "generated",
    }


# ============================================================
# WEEKLY BATCH JOB
# ============================================================

def service_run_weekly_athlete_state(
    max_users: int, ctx: AuthCtx
) -> Dict[str, Any]:
    """
    Weekly athlete state analýza, volaná schedulerom v nedeľu o 23:00.
    Hodnotenie týždňa (advisor) beží samostatne hneď za týmto jobom -
    viď service_run_weekly_advisor_reviews.

    🌟 ZMENA: beží len pre userov, ktorí za posledných
    RECENT_TRAINING_DAYS dní niečo odtrénovali (Services/AI/utils/
    activity_gate.py). Bez aktivít AI nemá čo analyzovať - kto nemá
    pripojenú Stravu alebo appku nepoužíva, len pálil tokeny. Ručné
    spustenie z appky funguje vždy.
    """
    users = db_list_users_for_athlete_state(ctx=ctx, limit=max_users or 1000)
    if not users:
        return {
            "success": True,
            "processed": 0,
            "skipped_inactive": 0,
            "results": [],
            "message": "no users found",
        }

    results: List[Dict[str, Any]] = []
    processed = 0
    skipped_inactive = 0

    for row in users:
        uid = row.get("id")
        if not uid:
            continue
        try:
            if not user_trained_recently(int(uid), ctx=ctx):
                skipped_inactive += 1
                continue

            resp = service_analyze_athlete(
                ctx=ctx, user_id=int(uid), model=None, force=True
            )
            state_id = resp.get("state_id")
            results.append(
                {"user_id": uid, "state_id": state_id, "ok": bool(state_id is not None)}
            )
            processed += 1
        except Exception as e:  # noqa: BLE001
            results.append(
                {"user_id": uid, "state_id": None, "ok": False, "error": str(e)}
            )

    print(
        f"[AI-STATE][weekly] processed={processed} "
        f"skipped_inactive={skipped_inactive} (no training in {RECENT_TRAINING_DAYS} days)"
    )

    return {
        "success": True,
        "processed": processed,
        "skipped_inactive": skipped_inactive,
        "results": results,
    }
