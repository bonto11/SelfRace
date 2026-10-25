# Services/AI/session_suggest/main.py
"""
AI návrh jedného tréningu pre advisor režim (formulár „Pridať tréning“).

Nič sa neukladá: návrh ide na FE ako stav formulára (rovnaký tvar ako
šablóna, `SessionTemplateData` vo `features/coach/constants/sessionTemplates.ts`),
user ho skontroluje a uloží bežnou cestou (advisor-daily). Konverzácia
(návrh + najviac 2 úpravy) žije na FE a posiela sa pri každej úprave.

PREČO kontrola výstupu v kóde: AI vie vymyslieť id cviku, ktorý nie je
v katalógu, alebo nezmyselné čísla – formulár by sa potom nedal uložiť.
Neplatný návrh = ai_generation_failed a neúčtuje sa.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from Configs.strength_catalog import get_exercise
from Modules.Supabase.auth import AuthCtx
from Services.AI.session_suggest.builders import build_session_suggest_input
from Services.AI.session_suggest.generate import generate_session_suggest_json
from Services.AI.utils.billing import (
    ai_output_has_text,
    extract_usage_from_trace,
    get_user_monthly_usage_tokens,
    is_user_over_token_quota,
    log_ai_usage_for_user,
)

# 1 návrh + 2 úpravy komentárom
MAX_ROUNDS = 3

_SPORTS = {"run", "ride", "swim", "strength", "other"}
_SESSION_TYPES = {"easy", "recovery", "long", "tempo", "interval"}
_LOADS = {"easy", "moderate", "hard"}
_EVENT_KINDS = {"sport", "work", "social", "chore", "travel", "other"}
MAX_BLOCKS = 10
MAX_EXERCISES = 12


def _int(v: Any, lo: int, hi: int) -> Optional[int]:
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        return None
    return n if lo <= n <= hi else None


def _txt(v: Any, limit: int) -> Optional[str]:
    s = str(v or "").strip()
    return s[:limit] if s else None


def _mmss(sec: int) -> str:
    sec = min(sec, 59 * 60 + 59)
    return f"{sec // 60:02d}:{sec % 60:02d}"


def _block(raw: Any) -> Optional[Dict[str, Any]]:
    """Jedna séria intervalov v tvare TemplateIntervalBlock (FE)."""
    if not isinstance(raw, dict):
        return None
    rounds = _int(raw.get("rounds"), 1, 50)
    if not rounds:
        return None
    out: Dict[str, Any] = {"rounds": rounds}

    work_unit = "distance" if raw.get("work_unit") == "distance" else "time"
    if work_unit == "distance":
        m = _int(raw.get("work_m"), 50, 50000)
        if not m:
            return None
        out.update(workUnit="distance", workDistance=m)
    else:
        s = _int(raw.get("work_s"), 5, 3599)
        if not s:
            return None
        out.update(workUnit="time", workTime=_mmss(s))
    out["workNotes"] = _txt(raw.get("work_notes"), 300)

    rest_unit = "distance" if raw.get("rest_unit") == "distance" else "time"
    if rest_unit == "distance":
        out.update(restUnit="distance", restDistance=_int(raw.get("rest_m"), 0, 10000))
    else:
        s = _int(raw.get("rest_s"), 0, 3599)
        out.update(restUnit="time", restTime=_mmss(s) if s else "")
    out["restNotes"] = _txt(raw.get("rest_notes"), 300)
    return out


def normalize_suggested_session(raw: Any) -> Optional[Dict[str, Any]]:
    """
    AI návrh → stav formulára (SessionTemplateData). None = nepoužiteľný
    (chýba šport, názov alebo štruktúra, ktorú formulár potrebuje).
    """
    if not isinstance(raw, dict):
        return None
    sport = str(raw.get("sport") or "").strip().lower()
    if sport not in _SPORTS:
        return None
    title = _txt(raw.get("title"), 200)
    if not title:
        return None

    d: Dict[str, Any] = {"v": 1, "sport": sport, "title": title}
    notes = _txt(raw.get("notes"), 1000)
    if notes:
        d["notes"] = notes

    if sport in ("run", "ride", "swim"):
        mode = "intervals" if raw.get("structure_mode") == "intervals" else "simple"
        st = raw.get("session_type")
        d["sessionType"] = st if st in _SESSION_TYPES else ("interval" if mode == "intervals" else "easy")
        d["structureMode"] = mode
        d["warmupMin"] = _int(raw.get("warmup_min"), 1, 120)
        d["cooldownMin"] = _int(raw.get("cooldown_min"), 1, 120)
        if mode == "simple":
            main = _int(raw.get("main_minutes"), 1, 600)
            if not main:
                return None
            d["mainMinutes"] = main
            mn = _txt(raw.get("main_notes"), 300)
            if mn:
                d["mainNotes"] = mn
        else:
            blocks = [b for b in (_block(x) for x in (raw.get("blocks") or [])[:MAX_BLOCKS]) if b]
            if not blocks:
                return None
            d["blocks"] = blocks
        return d

    if sport == "strength":
        exercises: List[Dict[str, Any]] = []
        for e in (raw.get("exercises") or [])[:MAX_EXERCISES]:
            if not isinstance(e, dict):
                continue
            ex_id = str(e.get("exercise_id") or "").strip()
            # len cviky z katalógu – iný by FE ani BE neuložili
            if not ex_id or not get_exercise(ex_id):
                continue
            sets = _int(e.get("sets"), 1, 20)
            reps = _txt(e.get("reps"), 20)
            if not sets or not reps:
                continue
            exercises.append({"exercise_id": ex_id, "sets": sets, "reps": reps})
        if not exercises:
            return None
        d["exercises"] = exercises
        return d

    # sport == "other": chôdza, turistika, jóga, mobilita
    minutes = _int(raw.get("duration_min"), 5, 600)
    if not minutes:
        return None
    kind = raw.get("event_kind") if raw.get("event_kind") in _EVENT_KINDS else "sport"
    load = raw.get("event_load") if raw.get("event_load") in _LOADS else "easy"
    d.update(durationMin=minutes, eventKind=kind, eventLoad=load, countsAsTraining=kind == "sport")
    return d


def _rounds_used(thread: Any) -> int:
    if not isinstance(thread, list):
        return 0
    return sum(1 for e in thread if isinstance(e, dict) and e.get("role") == "assistant")


def service_session_suggest(
    *,
    user_id: int,
    plan_date: str,
    request: Optional[str],
    thread: Any,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    used = _rounds_used(thread)
    if used >= MAX_ROUNDS:
        return {"ok": False, "code": "limit_reached"}
    # úprava bez textu nedáva zmysel – prvý návrh môže byť aj bez zadania
    if used > 0 and not str(request or "").strip():
        return {"ok": False, "code": "empty_comment"}

    if is_user_over_token_quota(user_id, ctx=ctx):
        return {
            "ok": False,
            "code": "ai_quota_exceeded",
            "used_tokens_this_month": get_user_monthly_usage_tokens(ctx=ctx, user_id=user_id),
        }

    payload = build_session_suggest_input(
        user_id, plan_date=plan_date, request=request, thread=thread, ctx=ctx
    )
    data, trace, err = generate_session_suggest_json(payload)
    if not data:
        print(f"❌ [SUGGEST] AI failed user={user_id}: {err}")
        return {"ok": False, "code": "ai_generation_failed"}

    session = normalize_suggested_session(data.get("session"))
    # bez textu alebo použiteľného tréningu user nič nedostane – neúčtuje sa
    if not session or not ai_output_has_text(data, "reply_text"):
        print(f"❌ [SUGGEST] invalid AI output user={user_id}, not billed")
        return {"ok": False, "code": "ai_generation_failed"}

    usage = extract_usage_from_trace(trace, model_fallback=data.get("model"))
    if usage:
        try:
            log_ai_usage_for_user(
                user_id=user_id,
                usage=usage,
                job_type="coach.session_suggest",
                source="user",
                billed_via="internal",
                charge_wallet=False,
                meta={
                    "plan_date": str(plan_date)[:10],
                    "round": used + 1,
                    "provider": trace.get("ok_provider"),
                    "model": trace.get("ok_model"),
                },
                ctx=ctx,
            )
        except Exception as e:  # noqa: BLE001
            print(f"❌ [AI_BILLING] session_suggest error: {repr(e)}")

    return {
        "ok": True,
        "reply_text": str(data.get("reply_text") or "").strip(),
        "warning": _txt(data.get("warning"), 400),
        "session": session,
        "rounds_left": max(0, MAX_ROUNDS - used - 1),
    }
