# Services/AI/advisor_review/main.py
"""
Hodnotenie týždňa v advisor režime.

KEDY SA SPÚŠŤA (a nikdy inokedy):
  - nedeľný cron o 23:00, len pre advisor userov s aktívnym plánom, ktorí
    za posledných 14 dní trénovali
  - tlačidlo "Skontroluj mi týždeň" (vždy, bez ohľadu na aktivitu)

Nikdy sa nespúšťa pri importe aktivity, hodnotení aktivity ani pri úprave
plánu. Athlete si inak menilo hodnotenie pod rukami bez toho, aby oň
požiadal.

ODDELENÉ OD athlete_state: advisor si trénovanosť NEPOČÍTA, len si prečíta
posledný uložený stav. Vďaka tomu je kontext aj prompt rádovo menší a jedno
volanie neprepisuje výsledok toho druhého.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from DB.coach_advisor_review import (
    db_get_latest_advisor_review,
    db_insert_advisor_review,
    db_list_advisor_reviews,
)
from DB.coach_plan_meta import db_get_active_plan_meta_for_user
from DB.users import db_list_users_for_athlete_state
from Modules.Supabase.auth import AuthCtx
from Services.AI.advisor_review.builders import build_advisor_review_input, review_window
from Services.AI.advisor_review.generate import generate_advisor_review_json
from Services.AI.utils.activity_gate import RECENT_TRAINING_DAYS, user_trained_recently
from Services.AI.utils.billing import (
    extract_usage_from_trace,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
    log_ai_usage_for_user,
    ai_output_has_text,
)
from Services.coach_mode import service_get_coach_mode

# Ako dlho je hodnotenie považované za čerstvé. Opakované kliknutie na
# tlačidlo v ten istý deň nemá prečo míňať tokeny, keď sa plán nezmenil -
# ale force=True to vždy prebije.
REVIEW_FRESH_HOURS = 6


def _week_start_iso(d: Optional[date] = None) -> str:
    """Pondelok aktuálneho (alebo zadaného) týždňa."""
    d = d or date.today()
    return (d - timedelta(days=d.weekday())).isoformat()


def _age_hours(created_at: Any) -> Optional[float]:
    """Vek záznamu v hodinách."""
    if not created_at:
        return None
    try:
        dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).total_seconds() / 3600.0
    except Exception:  # noqa: BLE001
        return None


def _has_active_plan(user_id: int, *, ctx: AuthCtx) -> bool:
    """
    Bez aktívneho plánu nie je čo hodnotiť - builder by vrátil
    has_active_plan=False a AI by písala o prázdnom týždni.
    Pri chybe True, aby výpadok DB nezhodil hodnotenie aktívnemu userovi.
    """
    try:
        return bool(db_get_active_plan_meta_for_user(user_id=user_id, ctx=ctx))
    except Exception as e:  # noqa: BLE001
        print(f"[ADVISOR-REVIEW] active plan check failed user={user_id}: {repr(e)}")
        return True


def _log_usage(
    user_id: int, trace: Dict[str, Any], model: str, *, ctx: AuthCtx
) -> None:
    """Billing - zlyhanie nikdy nesmie zhodiť hodnotenie."""
    usage = extract_usage_from_trace(trace, model_fallback=model)
    if not usage:
        return
    try:
        log_ai_usage_for_user(
            user_id=user_id,
            usage=usage,
            job_type="coach.advisor_review",
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
        print(f"[AI_BILLING] advisor_review billing error: {repr(e)}")


# ============================================================
# READ
# ============================================================

def _resolve_suggestion_templates(review: Dict[str, Any], id_map: Dict[str, str]) -> None:
    """
    Odporúčania na ďalší týždeň -> {text, template_id, duration_min}.
    AI vracia krátke id šablóny ("easy_run", "u2"); FE potrebuje id zo
    svojho zoznamu ("b:easy_run", "u:<uuid>"). Neznáme id sa zahodí -
    tlačidlo "Pridať" bez platnej šablóny by nič nevyplnilo.
    """
    guide = review.get("next_week_guidance")
    if not isinstance(guide, dict):
        return
    out: List[Dict[str, Any]] = []
    for it in guide.get("suggested_structure") or []:
        if isinstance(it, str):
            it = {"text": it}
        if not isinstance(it, dict) or not str(it.get("text") or "").strip():
            continue
        action = str(it.get("action") or "").strip().lower()
        if action not in ("add", "avoid", "info"):
            # staršie odpovede bez action: so šablónou = pridať, inak info
            action = "add" if it.get("template") else "info"
        # gombík "Pridať" len pri odporúčaní niečo pridať - pri zákaze
        # ("nepridávaj ďalší beh") vyzeral ako chyba appky
        tpl = id_map.get(str(it.get("template") or "").strip()) if action == "add" else None
        minutes = it.get("min")
        try:
            minutes = int(minutes) if minutes is not None else None
        except (TypeError, ValueError):
            minutes = None
        if minutes is not None and not (5 <= minutes <= 300):
            minutes = None
        out.append({
            "text": str(it["text"]).strip(),
            "action": action,
            "template_id": tpl,
            "duration_min": minutes if tpl else None,
        })
    guide["suggested_structure"] = out


def service_get_latest_advisor_review(
    user_id: int, *, ctx: AuthCtx
) -> Optional[Dict[str, Any]]:
    """Posledné uložené hodnotenie týždňa."""
    row = db_get_latest_advisor_review(user_id=user_id, version=1, ctx=ctx)
    if not row:
        return None
    return {
        "id": row.get("id"),
        "week_start": str(row.get("week_start") or "")[:10],
        "model": row.get("model"),
        "created_at": row.get("created_at"),
        "review": row.get("review") or {},
    }


def service_list_advisor_reviews(
    user_id: int, *, limit: int = 10, ctx: AuthCtx
) -> List[Dict[str, Any]]:
    """História hodnotení (bez obsahu)."""
    return db_list_advisor_reviews(user_id=user_id, limit=limit, ctx=ctx)


# ============================================================
# CORE
# ============================================================

def service_generate_advisor_review(
    user_id: int,
    *,
    ctx: AuthCtx,
    model: Optional[str] = None,
    force: bool = True,
) -> Dict[str, Any]:
    """
    Vygeneruje hodnotenie týždňa pre advisor usera.

    force=False: ak existuje hodnotenie z tohto týždňa mladšie než
    REVIEW_FRESH_HOURS, AI sa nevolá a vráti sa uložené.

    Táto funkcia NEKONTROLUJE, či user trénuje - tlačidlo musí fungovať
    vždy. Bránu má len nedeľný job.
    """
    if service_get_coach_mode(user_id, ctx=ctx) != "advisor":
        return {
            "ok": False,
            "code": "not_advisor_mode",
            "message": "Hodnotenie týždňa je dostupné len v režime Poradca.",
        }

    week_start = _week_start_iso()

    if not force:
        latest = db_get_latest_advisor_review(user_id=user_id, version=1, ctx=ctx)
        if latest and str(latest.get("week_start") or "")[:10] == week_start:
            age = _age_hours(latest.get("created_at"))
            if age is not None and age < REVIEW_FRESH_HOURS:
                print(
                    f"[ADVISOR-REVIEW] user={user_id} reusing review "
                    f"(age {age:.1f}h < {REVIEW_FRESH_HOURS}h), no AI call."
                )
                return {
                    "ok": True,
                    "review_id": latest.get("id"),
                    "week_start": week_start,
                    "review": latest.get("review") or {},
                    "from_cache": True,
                }

    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "message": "Mesačný limit AI analýz bol vyčerpaný.",
            "used_tokens_this_month": used,
        }

    try:
        context = build_advisor_review_input(user_id, ctx=ctx)
    except Exception as e:  # noqa: BLE001
        print(f"[ADVISOR-REVIEW] context build failed user={user_id}: {repr(e)}")
        return {"ok": False, "code": "context_build_failed", "message": str(e)}

    template_id_map = context.pop("_template_id_map", {}) or {}

    review, trace, err_msg = generate_advisor_review_json(
        context, user_id=user_id, model=model, ctx=ctx
    )

    if not review:
        return {"ok": False, "code": "ai_generation_failed", "message": err_msg}

    if not ai_output_has_text(review, "headline"):
        print(f"[ADVISOR-REVIEW] user={user_id} AI output invalid, not billed")
        return {"ok": False, "code": "ai_generation_failed", "message": "invalid_ai_output"}

    _resolve_suggestion_templates(review, template_id_map)

    # FE podľa toho píše "Minulý týždeň" / "Tento týždeň" a ponúka dni
    # na pridanie odporúčaní v správnom týždni
    w = review_window()
    review["review_mode"] = w["mode"]
    review["plan_week_start"] = w["plan_start"].isoformat()

    saved = db_insert_advisor_review(
        user_id=user_id,
        week_start=week_start,
        review=review,
        model=str(review.get("model") or ""),
        version=1,
        ctx=ctx,
    )

    # Billing až po uložení - neuložené hodnotenie user neuvidí a neplatí zaň.
    if saved:
        _log_usage(user_id, trace, str(review.get("model") or ""), ctx=ctx)

    return {
        "ok": True,
        "review_id": (saved or {}).get("id"),
        "week_start": week_start,
        "review": review,
        "from_cache": False,
    }


# ============================================================
# WEEKLY BATCH JOB
# ============================================================

def service_run_weekly_advisor_reviews(
    max_users: int = 0, *, ctx: AuthCtx
) -> Dict[str, Any]:
    """
    Nedeľný cron - hodnotenie týždňa pre advisor userov.

    Preskočí sa (v poradí od najlacnejšej kontroly):
      - coach user: plán skladá AI a opravuje si ho sama cez autoadjust
      - user bez aktívneho plánu: nie je čo hodnotiť
      - 🌟 user bez tréningu za posledných RECENT_TRAINING_DAYS dní:
        hodnotiť štruktúru týždňa, z ktorého nič neodcvičil, je zbytočné
    """
    users = db_list_users_for_athlete_state(ctx=ctx, limit=max_users or 1000)
    if not users:
        return {
            "success": True,
            "processed": 0,
            "skipped": {"not_advisor": 0, "no_plan": 0, "inactive": 0},
            "results": [],
        }

    results: List[Dict[str, Any]] = []
    processed = 0
    skipped = {"not_advisor": 0, "no_plan": 0, "inactive": 0}

    for row in users:
        uid = row.get("id")
        if not uid:
            continue
        try:
            user_id = int(uid)

            if service_get_coach_mode(user_id, ctx=ctx) != "advisor":
                skipped["not_advisor"] += 1
                continue

            if not _has_active_plan(user_id, ctx=ctx):
                skipped["no_plan"] += 1
                continue

            if not user_trained_recently(user_id, ctx=ctx):
                skipped["inactive"] += 1
                continue

            resp = service_generate_advisor_review(
                user_id=user_id, ctx=ctx, model=None, force=True
            )
            results.append(
                {
                    "user_id": uid,
                    "ok": bool(resp.get("ok")),
                    "code": resp.get("code"),
                }
            )
            processed += 1
        except Exception as e:  # noqa: BLE001
            results.append({"user_id": uid, "ok": False, "error": str(e)})

    print(
        f"[ADVISOR-REVIEW][weekly] processed={processed} skipped={skipped} "
        f"(inactive = no training in {RECENT_TRAINING_DAYS} days)"
    )

    return {
        "success": True,
        "processed": processed,
        "skipped": skipped,
        "results": results,
    }
