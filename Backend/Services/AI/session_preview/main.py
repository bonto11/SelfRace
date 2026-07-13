# Services/AI/session_preview/main.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from Modules.Supabase.auth import AuthCtx

from Services.AI.utils.billing import (
    extract_usage_from_trace,
    log_ai_usage_for_user,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
)

from Services.AI.session_preview.builders import build_context_for_session_preview
from Services.AI.session_preview.generate import generate_session_preview_json
from DB.coach_plan_daily import (
    db_get_daily_session_by_id_full,
    db_append_preview_thread_entry,
    db_apply_session_preview_update,
)
from DB.app_subscription import db_get_active_app_subscription_for_user


# ============================================================
# HELPERS
# ============================================================

def _now_iso() -> str:
    """Vráti aktuálny UTC čas ako ISO string."""
    return datetime.now(timezone.utc).isoformat()


def _norm_comment(comment: Optional[str]) -> Optional[str]:
    """Orezá a vráti komentár, None ak prázdny."""
    if not isinstance(comment, str):
        return None
    c = comment.strip()
    return c if c else None


def _get_tier_max_versions(tier_code: str) -> int:
    """Vráti maximálny počet otázok k session pre daný tier. Rovnaké hodnoty ako activity_review."""
    return {"pro": 3, "classic": 2, "family": 10}.get(tier_code, 1)


def _count_assistant_entries(thread: List[Dict[str, Any]]) -> int:
    """Počet AI odpovedí v threade = aktuálna 'verzia'."""
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

def service_get_session_preview_thread(
    *,
    user_id: int,
    session_id: int,
    ctx: AuthCtx,
) -> List[Dict[str, Any]]:
    """Načíta preview_thread pre jednu naplánovanú session."""
    row = db_get_daily_session_by_id_full(user_id, session_id, ctx=ctx)
    if not row:
        return []
    thread = row.get("preview_thread")
    return thread if isinstance(thread, list) else []


# ============================================================
# CORE SERVICE — priame (synchrónne) volanie, žiadny queue
# ============================================================

def service_session_preview_ask(
    *,
    user_id: int,
    session_id: int,
    comment: str,
    request_change: bool,
    model: Optional[str] = None,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Hlavný service pre konverzáciu/úpravu jednej naplánovanej session.
    Kontroluje kvótu tokenov, tier limity na počet otázok, zostaví kontext
    (vrátane preview_thread histórie), zavolá AI, pripojí výsledok do threadu,
    prípadne aplikuje zmenu structure/duration_min/notes na tú JEDNU session,
    a zaznamená billing. Beží synchrónne (bez queue) — krátka odpoveď.
    """
    safe_comment = _norm_comment(comment)
    if not safe_comment:
        return {"ok": False, "code": "empty_comment"}

    # Kvóta check
    if is_user_over_token_quota(user_id, ctx=ctx):
        used = get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id)
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "used_tokens_this_month": used,
        }

    # Overenie existencie session
    session = db_get_daily_session_by_id_full(user_id, session_id, ctx=ctx)
    if not session:
        return {"ok": False, "code": "session_not_found"}

    # Tier a max verzie — rovnaké limity ako activity_review
    app_subscription = db_get_active_app_subscription_for_user(int(user_id), ctx=ctx) or {}
    tier_code = (app_subscription.get("tier_code") or "free").strip().lower()
    max_versions = _get_tier_max_versions(tier_code)

    thread = session.get("preview_thread") or []
    cur_version = _count_assistant_entries(thread)

    if tier_code == "free" and cur_version >= 1:
        return {
            "ok": False,
            "code": "only_one_for_free_tier",
            "message": "Vo free verzii máte nárok len na jednu otázku k tréningu.",
            "tier": tier_code,
        }

    if cur_version >= max_versions:
        return {
            "ok": False,
            "code": "limit_reached",
            "message": f"Dosiahli ste limit otázok pre {tier_code.capitalize()} účet.",
            "tier": tier_code,
        }

    # Anti-spam: rovnaký komentár ako posledný raz
    if thread:
        last_comment = _last_user_comment(thread)
        if safe_comment == last_comment:
            return {
                "ok": False,
                "code": "duplicate_content",
                "message": "Túto správu ste už poslali naposledy.",
            }

    # Builder — zostaví kompletný kontext (session + recovery + zones + preview_thread)
    context_payload = build_context_for_session_preview(
        user_id=user_id,
        session_id=session_id,
        comment=safe_comment,
        request_change=request_change,
        ctx=ctx,
    )
    if context_payload is None:
        return {"ok": False, "code": "session_not_found"}

    reply, trace, err_msg = generate_session_preview_json(
        context_payload=context_payload,
        model=model,
        user_id=user_id,
        ctx=ctx,
    )

    if not reply:
        print(f"❌ [SP] AI Generation failed: {err_msg}")
        return {"ok": False, "code": "ai_generation_failed", "message": err_msg}

    # Billing
    usage = extract_usage_from_trace(trace, model_fallback=reply.get("model"))
    if usage:
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.session_preview",
                source="user",
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "session_id": session_id,
                    "request_change": request_change,
                    "provider": trace.get("ok_provider"),
                    "model": trace.get("ok_model"),
                },
                ctx=ctx,
            )
        except Exception as e:
            print(f"❌ [AI_BILLING] error: {repr(e)}")

    # Uloženie do threadu — db_append_preview_thread_entry berie JEDEN entry naraz,
    # takže voláme dvakrát (user, potom assistant), nie raz s listom.
    entries: List[Dict[str, Any]] = [
        {
            "role": "user",
            "comment": safe_comment,
            "request_change": bool(request_change),
        },
        {
            "role": "assistant",
            "reply_text": reply.get("reply_text"),
            "changed": bool(reply.get("changed")),
        },
    ]

    for entry in entries:
        try:
            db_append_preview_thread_entry(user_id, session_id, entry, ctx=ctx)
        except Exception as e:
            print(f"❌ [SP] db_append_preview_thread_entry error: {repr(e)}")

    # Ak AI navrhlo a povolilo zmenu, aplikuj na tú JEDNU session
    if reply.get("changed"):
        try:
            db_apply_session_preview_update(
                user_id,
                session_id,
                title=reply.get("updated_title"),
                duration_min=reply.get("updated_duration_min"),
                notes=reply.get("updated_notes"),
                structure=reply.get("updated_structure"),
                ctx=ctx,
            )
        except Exception as e:
            print(f"❌ [SP] db_apply_session_preview_update error: {repr(e)}")

    return {"ok": True, "data": reply}
