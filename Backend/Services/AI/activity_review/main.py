# Services/AI/activity_review/main.py
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx

from Services.AI.utils.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
)

from Services.AI.activity_review.builders import build_input_from_db as build_review_input
from Services.AI.activity_review.generate import generate_activity_review_json
from DB.activities_enrichment import (
    db_get_enrichment_for_activity,
    db_get_review_thread,
    db_append_review_thread_entries,
)
from DB.activities_summary import db_get_summary_for_activities
from DB.user_thresholds import db_upsert_user_threshold
from DB.user_prefs import db_get_pref_single
from DB.user_zones import db_user_zones_fetch_latest, db_user_zones_insert_row
from DB.app_subscription import db_get_active_app_subscription_for_user


# ============================================================
# HELPERS
# ============================================================

def _calculate_zones_from_lthr(lthr: int, hr_max: int) -> Dict[str, int]:
    """Vypočíta zónové hranice z LTHR — zhodná logika s FE."""
    return {
        "z1_max": round(lthr * 0.81),
        "z2_min": round(lthr * 0.81) + 1,
        "z2_max": round(lthr * 0.89),
        "z3_min": round(lthr * 0.89) + 1,
        "z3_max": round(lthr * 0.93),
        "z4_min": round(lthr * 0.93) + 1,
        "z4_max": round(lthr * 0.99),
        "z5_min": round(lthr * 0.99) + 1,
        "z5_max": hr_max,
    }


def _now_iso() -> str:
    """Vráti aktuálny UTC čas ako ISO string."""
    return datetime.now(timezone.utc).isoformat()


def _minify_context_for_ai(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Deep copy contextu s konverziou neserializovateľných hodnôt na string."""
    return json.loads(json.dumps(payload, default=str))


def _norm_comment(comment: Optional[str]) -> Optional[str]:
    """Orezá a vráti komentár, None ak prázdny."""
    if not isinstance(comment, str):
        return None
    c = comment.strip()
    return c if c else None


def _get_activity_days_ago(date_str: Optional[str]) -> int:
    """Vráti počet dní od dátumu aktivity, 9999 ak chýba."""
    if not date_str:
        return 9999
    try:
        clean_date = str(date_str)[:10]
        dt = datetime.strptime(clean_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).days
    except Exception:
        return 9999


def _get_tier_max_versions(tier_code: str) -> int:
    """Vráti maximálny počet verzií review pre daný tier."""
    return {"pro": 3, "classic": 2, "family": 10}.get(tier_code, 1)


def _count_assistant_entries(thread: List[Dict[str, Any]]) -> int:
    """Počet AI odpovedí v threade = aktuálna 'verzia' review."""
    return len([e for e in thread if isinstance(e, dict) and e.get("role") == "assistant"])


def _last_user_comment(thread: List[Dict[str, Any]]) -> Optional[str]:
    """Posledný komentár usera v threade — pre anti-spam duplicitu."""
    for entry in reversed(thread):
        if isinstance(entry, dict) and entry.get("role") == "user":
            c = entry.get("comment")
            return c if isinstance(c, str) else None
    return None


# ============================================================
# READ SERVICE
# ============================================================

def service_get_activity_enrichment(
    *,
    user_id: int,
    activity_id: int,
    ctx: AuthCtx,
) -> Optional[Dict[str, Any]]:
    """Načíta enrichment (vrátane ai_review_thread) pre jednu aktivitu."""
    return db_get_enrichment_for_activity(
        user_id=user_id, activity_id=activity_id, ctx=ctx
    )


# ============================================================
# WRITE / RERUN SERVICE
# ============================================================

def service_request_activity_review_rerun(
    *,
    user_id: int,
    activity_id: int,
    comment: Optional[str],
    model: Optional[str] = None,
    has_new_injury: Optional[bool] = False,
    is_race_effort: Optional[bool] = False,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Zaradí požiadavku na (pre)generovanie AI review do async fronty.
    Kontroluje: vek aktivity, tier limity, anti-spam duplicitu, absolútny hard limit.
    Verzia sa počíta z review threadu (počet assistant entries), nie zo samostatnej kolóny.
    """
    # Overenie existencie a veku aktivity
    summaries = db_get_summary_for_activities(
        ctx=ctx, user_id=user_id, activity_ids=[activity_id]
    )
    if not summaries or not summaries[0]:
        return {
            "ok": False,
            "code": "activity_not_found",
            "message": "Aktivita nebola nájdená.",
        }

    days_old = _get_activity_days_ago(summaries[0].get("date"))
    if days_old > 7:
        return {
            "ok": False,
            "code": "activity_too_old",
            "message": "Analýzu je možné vyžiadať len pre aktivity do 7 dní.",
        }

    # Aktuálny review thread a verzia
    thread = db_get_review_thread(user_id=int(user_id), activity_id=int(activity_id), ctx=ctx)
    cur_version = _count_assistant_entries(thread)

    # Absolútny hard limit — ochrana pred zneužitím
    if cur_version >= 10:
        return {
            "ok": False,
            "code": "hard_limit_reached",
            "message": "Bol dosiahnutý absolútny systémový limit pregenerovaní.",
        }

    # Tier a max verzie
    app_subscription = (
        db_get_active_app_subscription_for_user(int(user_id), ctx=ctx) or {}
    )
    tier_code = (app_subscription.get("tier_code") or "free").strip().lower()
    max_versions = _get_tier_max_versions(tier_code)
    comment_from_user = _norm_comment(comment)

    # Kontrola limitu — zranenie vždy prejde cez limit
    if cur_version >= max_versions and not has_new_injury:
        if tier_code == "free":
            return {
                "ok": False,
                "code": "only_one_for_free_tier",
                "message": "Vo free verzii máte nárok len na jedno hodnotenie.",
                "tier": tier_code,
            }
        return {
            "ok": False,
            "code": "limit_reached",
            "message": f"Dosiahli ste limit pregenerovaní pre {tier_code.capitalize()} účet.",
            "tier": tier_code,
        }

    # Free tier nemá komentáre (len pri zranení)
    if tier_code == "free" and not has_new_injury:
        comment_from_user = None

    # Anti-spam: rovnaký komentár ako posledný raz (race effort je vždy výnimka)
    if tier_code != "free" and thread and not has_new_injury and not is_race_effort:
        last_comment = _last_user_comment(thread)
        if comment_from_user and comment_from_user == last_comment:
            return {
                "ok": False,
                "code": "duplicate_content",
                "message": "Tento komentár ste už použili pri poslednom generovaní.",
            }

    next_version = cur_version + 1
    dedupe_key = f"activity_review_user:{user_id}:{activity_id}:{next_version}"

    from Services.async_jobs import service_enqueue_job

    out = service_enqueue_job(
        user_id=int(user_id),
        job_type="activity_review",
        payload={
            "activity_id": int(activity_id),
            "model": model,
            "source": "user",
            "comment": comment_from_user,
            "has_new_injury": has_new_injury,
            "is_race_effort": is_race_effort,
            "target_version": next_version,
        },
        priority=140,
        max_attempts=1,
        dedupe_key=dedupe_key,
        ctx=ctx,
    )

    if not out.get("job"):
        return {"ok": False, "code": "enqueue_failed", "message": "Nepodarilo sa zaradiť požiadavku."}

    return {
        "ok": True,
        "job_id": out["job"].get("id"),
        "tier": tier_code,
        "next_version": next_version,
        "comment_used": bool(comment_from_user),
    }


# ============================================================
# CORE REVIEW SERVICE
# ============================================================

def service_activity_review(
    user_id: int,
    activity_id: int,
    *,
    ctx: AuthCtx,
    model: Optional[str] = None,
    source: Optional[str] = None,
    comment: Optional[str] = None,
    is_race_effort: Optional[bool] = False,
) -> Dict[str, Any]:
    """
    Hlavný service pre generovanie AI review jednej aktivity.
    Kontroluje kvótu, zostaví kontext (vrátane review_thread), zavolá AI,
    pripojí výsledok do threadu a zaznamená billing.
    model=None znamená že provider použije default z ENV (odporúčané).
    """
    src = (source or "").strip().lower() or "auto"
    safe_comment = _norm_comment(comment)

    # Kvóta check — len pre user-initiated volania
    if src == "user" and is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "used_tokens_this_month": used,
        }

    # Builder — zostaví kompletný kontext z DB (vrátane predošlého review_thread)
    input_data = build_review_input(
        user_id=user_id,
        activity_id=activity_id,
        ctx=ctx,
        source=src,
        user_comment=safe_comment,
        is_race_effort=is_race_effort,
    )
    context_for_ai = _minify_context_for_ai(input_data)

    # Ochrana: ak aktivita nemá metriky, nema zmysel volať AI
    act = context_for_ai.get("activity") if isinstance(context_for_ai, dict) else None
    metrics = act.get("metrics") if isinstance(act, dict) else None
    if not isinstance(metrics, dict) or not metrics:
        return {"ok": False, "code": "missing_activity_data"}

    # Generovanie — provider vyberie model podľa ENV (haiku default, sonnet fallback)
    review, trace, err_msg = generate_activity_review_json(
        context_payload=context_for_ai,
        model=model,  # None = použije ENV default
        user_id=user_id,
        ctx=ctx,
    )

    # AI zlyhalo — žiadny zápis do DB
    if not review:
        print(f"❌ [AR] AI Generation failed: {err_msg}")
        return {
            "ok": False,
            "code": "ai_generation_failed",
            "message": err_msg,
        }

    # Threshold uloženie (len pre race/test session kde AI navrhlo nový LTHR/FTP)
    if isinstance(review, dict) and review.get("suggested_thresholds"):
        sug = review["suggested_thresholds"]
        new_lthr = sug.get("hr_bpm")
        sport = sug.get("sport") or "running"

        if new_lthr:
            threshold_row = {
                "sport": sport,
                "threshold_type": sug.get("threshold_type") or "LT2",
                "hr_bpm": new_lthr,
                "pace_sec_km": sug.get("pace_sec_km"),
                "power_watt": sug.get("power_watt"),
                "measurement_type": "ai_estimate",
                "updated_at": _now_iso(),
            }
            db_upsert_user_threshold(user_id=user_id, row=threshold_row, ctx=ctx)

            # Ak má user percent_lthr mode, prepočítame zóny automaticky
            try:
                prefs_row = db_get_pref_single(user_id=user_id, key="coach.prefs", ctx=ctx)
                prefs_val = (prefs_row.get("value") or {}) if prefs_row else {}
                calc_mode = (
                    prefs_val.get("preferences", {}).get("hr_zone_calc_mode", "manual")
                )

                if calc_mode == "percent_lthr":
                    latest_zones = db_user_zones_fetch_latest(
                        user_id=user_id, sport_raw=sport, ctx=ctx
                    )
                    if latest_zones:
                        hr_max = int(latest_zones.get("hr_max_bpm") or 206)
                    else:
                        act_metrics = context_for_ai.get("activity", {}).get("metrics", {})
                        hr_max = int(act_metrics.get("max_hr_bpm") or 200)

                    z_vals = _calculate_zones_from_lthr(int(new_lthr), hr_max)
                    new_zone_row = {
                        "user_id": user_id,
                        "sport": sport,
                        "hr_max_bpm": hr_max,
                        "z1_max_bpm": z_vals["z1_max"],
                        "z2_min_bpm": z_vals["z2_min"],
                        "z2_max_bpm": z_vals["z2_max"],
                        "z3_min_bpm": z_vals["z3_min"],
                        "z3_max_bpm": z_vals["z3_max"],
                        "z4_min_bpm": z_vals["z4_min"],
                        "z4_max_bpm": z_vals["z4_max"],
                        "z5_min_bpm": z_vals["z5_min"],
                    }
                    db_user_zones_insert_row(new_zone_row, ctx=ctx)
            except Exception as e:
                print(f"❌ [AR] Zone recalculation error: {repr(e)}")

    # Billing — zaznamenáme reálny model a providera (nie len fallback meno)
    usage = extract_usage_from_trace(trace, model_fallback=review.get("model"))
    if usage:
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.activity_review",
                source=src,
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "activity_id": activity_id,
                    "source": src,
                    "provider": trace.get("ok_provider"),   # kto reálne odpovedal
                    "model": trace.get("ok_model"),          # haiku alebo sonnet fallback
                },
                ctx=ctx,
            )
        except Exception as e:
            print(f"❌ [AI_BILLING] error: {repr(e)}")

    # --- ULOŽENIE DO THREADU (namiesto jedného prepisovaného ai_review) ---
    now_iso = _now_iso()
    entries: List[Dict[str, Any]] = []

    if safe_comment or is_race_effort:
        entries.append({
            "role": "user",
            "created_at": now_iso,
            "comment": safe_comment,
            "is_race_effort": bool(is_race_effort),
        })

    entries.append({
        "role": "assistant",
        "created_at": now_iso,
        "source": src,
        "review": review,
    })

    try:
        db_append_review_thread_entries(
            user_id=user_id, activity_id=activity_id, entries=entries, ctx=ctx
        )
    except Exception as e:
        print(f"❌ [AR] db_append_review_thread_entries error: {repr(e)}")

    return {"ok": True, "data": review}
