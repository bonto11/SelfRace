# Routes_AI/daily_plan_generate.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple, List

from fastapi import HTTPException
from openai import OpenAI
from zoneinfo import ZoneInfo
import json
import os
import time

from Configs.config import OPENAI_API_KEY, LLM_TIMEOUT_S

from Routes_AI.daily_plan_llm import llm_models_priority, sanitize_json_guess
from Routes_AI.daily_plan_prompts import _build_prompts_for_daily


def _call_openai_raw(
    client: OpenAI,
    model: str,
    system_txt: str,
    user_txt: str,
    max_tokens: int,
) -> Tuple[str, Dict[str, int]]:
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_txt},
            {"role": "user", "content": user_txt},
        ],
        temperature=0.2,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )

    content = (resp.choices[0].message.content or "").strip()
    usage_raw = getattr(resp, "usage", None) or {}

    def _get(u: Any, *names: str) -> int:
        for name in names:
            if hasattr(u, name):
                try:
                    v = getattr(u, name)
                    if v is not None:
                        return int(v)
                except Exception:
                    pass
            if isinstance(u, dict) and name in u:
                try:
                    v = u[name]
                    if v is not None:
                        return int(v)
                except Exception:
                    pass
        return 0

    usage = {
        "prompt_tokens": _get(usage_raw, "prompt_tokens", "input_tokens"),
        "completion_tokens": _get(usage_raw, "completion_tokens", "output_tokens"),
        "total_tokens": _get(usage_raw, "total_tokens"),
    }
    return content, usage


def _parse_ai_json(raw: str) -> Tuple[Optional[dict], str, str]:
    """
    Return (parsed_dict or None, cleaned_text, raw_text).
    Nikdy nehádže výnimku – pri chybe je parsed None.
    """
    if not raw:
        return None, "", ""

    txt = raw.strip()
    try:
        return json.loads(txt), txt, txt
    except Exception:
        cleaned = sanitize_json_guess(txt)
        try:
            return json.loads(cleaned), cleaned, txt
        except Exception:
            return None, cleaned, txt


def _safe_list(x: Any) -> List[Any]:
    return x if isinstance(x, list) else []


def _is_weekly_template_lock(lock: Dict[str, Any]) -> bool:
    return (lock.get("source") or "") == "weekly_template"


def _is_external_lock(lock: Dict[str, Any]) -> bool:
    return (lock.get("source") or "") == "external_events"


def _match_fixed_slot_session(session: Dict[str, Any], lock: Dict[str, Any]) -> bool:
    payload = session.get("payload") or {}
    fs = payload.get("fixed_slot") or {}
    if not isinstance(fs, dict):
        return False
    # strict match weekday + sport; kind/policy optional but prefer if present
    if (fs.get("weekday") != lock.get("weekday")) or (fs.get("sport") != lock.get("sport")):
        return False
    lk_kind = lock.get("kind")
    if lk_kind and fs.get("kind") and fs.get("kind") != lk_kind:
        return False
    lk_policy = lock.get("policy")
    if lk_policy and fs.get("policy") and fs.get("policy") != lk_policy:
        return False
    return True


def _match_external_session(session: Dict[str, Any], lock: Dict[str, Any], date_str: str) -> bool:
    payload = session.get("payload") or {}
    ex = payload.get("external_event") or {}
    if isinstance(ex, dict):
        # strongest: date match + title/sport
        if ex.get("date") == date_str and (ex.get("title") or "") == (lock.get("title") or ""):
            return True
        if ex.get("date") == date_str and (ex.get("sport") or "") == (lock.get("sport") or "") and (lock.get("title") or ""):
            # same date+sport and lock has title
            if (session.get("title") or "") == (lock.get("title") or ""):
                return True

    # fallback: title+sport match
    if (session.get("sport") or "") == (lock.get("sport") or ""):
        if (lock.get("title") or "") and (session.get("title") or "") == (lock.get("title") or ""):
            return True

    return False


def _make_session_from_lock(lock: Dict[str, Any], date_str: str) -> Dict[str, Any]:
    sport = lock.get("sport") or "other"
    title = lock.get("title") or ("Externá aktivita" if _is_external_lock(lock) else "Fixný tréning")
    duration_min = lock.get("duration_min")
    if not isinstance(duration_min, (int, float)) or duration_min <= 0:
        # sensible defaults
        if sport == "football":
            duration_min = 60
        elif sport == "strength":
            duration_min = 75 if (lock.get("kind") == "full") else 50
        elif sport == "run" and lock.get("kind") == "long":
            duration_min = 90
        else:
            duration_min = 45

    sess: Dict[str, Any] = {
        "sport": sport,
        "title": title,
        "duration_min": int(duration_min),
        "intensity": lock.get("intensity"),
        "session_type": lock.get("session_type"),
        "zone_text": lock.get("zone_text"),
        "notes": lock.get("notes"),
        "structure": lock.get("structure") or {},
        "payload": {},
    }

    if _is_weekly_template_lock(lock):
        sess["payload"]["fixed_slot"] = {
            "weekday": lock.get("weekday"),
            "sport": lock.get("sport"),
            "kind": lock.get("kind"),
            "policy": lock.get("policy") or "hard",
        }
        # keď je to lock, radšej nech je vždy jasné že je to fix
        if not sess.get("session_type"):
            sess["session_type"] = "coach_override"
        if not sess.get("notes"):
            sess["notes"] = "Fixný tréning podľa weekly template (server-side doplnené kvôli pravidlám dňa)."

    if _is_external_lock(lock):
        sess["payload"]["external_event"] = {
            "date": date_str,
            "weekday": lock.get("weekday"),
            "sport": lock.get("sport"),
            "title": lock.get("title"),
            "duration_min": int(duration_min),
            "start_time_local": lock.get("start_time_local"),
            "priority": lock.get("priority"),
        }
        if not sess.get("notes"):
            sess["notes"] = "Externá aktivita (server-side doplnené kvôli pravidlám dňa)."

    return sess


def _enforce_day_constraints_server_side(
    daily_plan: Dict[str, Any],
    context_payload: Dict[str, Any],
    *,
    trace: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Server-side poistka:
    - dodrží day_constraints.max_sessions,
    - garantuje prítomnosť day_constraints.locks,
    - zachová locked sessions pri trimovaní.

    Ak locks > max_sessions, automaticky zdvihne max_sessions na len(locks)
    a dá warning do trace (lebo inak by si musel dropnúť lock).
    """
    day_constraints = context_payload.get("day_constraints") or []
    if not isinstance(day_constraints, list) or not day_constraints:
        return daily_plan

    days = daily_plan.get("days")
    if not isinstance(days, list):
        return daily_plan

    # map date -> constraint
    dc_by_date: Dict[str, Dict[str, Any]] = {}
    for dc in day_constraints:
        if not isinstance(dc, dict):
            continue
        d = dc.get("date")
        if isinstance(d, str) and d:
            dc_by_date[d[:10]] = dc

    warnings: List[str] = []
    changed = False

    for day in days:
        if not isinstance(day, dict):
            continue
        date_str = (day.get("date") or "")[:10]
        if not date_str:
            continue

        dc = dc_by_date.get(date_str)
        if not dc:
            continue

        sessions = day.get("sessions")
        if not isinstance(sessions, list):
            sessions = []
            day["sessions"] = sessions

        locks = dc.get("locks") or []
        if not isinstance(locks, list):
            locks = []

        max_sessions = dc.get("max_sessions")
        if not isinstance(max_sessions, int) or max_sessions <= 0:
            max_sessions = 99  # no constraint

        # ---- ensure locks exist ----
        locked_sessions: List[Dict[str, Any]] = []
        used_idx = set()

        # pre-scan: match existing sessions to locks
        for li, lock in enumerate(locks):
            if not isinstance(lock, dict):
                continue

            found = None
            for si, s in enumerate(sessions):
                if si in used_idx or not isinstance(s, dict):
                    continue
                if _is_weekly_template_lock(lock) and _match_fixed_slot_session(s, lock):
                    found = s
                    used_idx.add(si)
                    break
                if _is_external_lock(lock) and _match_external_session(s, lock, date_str):
                    found = s
                    used_idx.add(si)
                    break

            if found is None:
                # create missing lock session
                sessions.append(_make_session_from_lock(lock, date_str))
                found = sessions[-1]
                changed = True

            locked_sessions.append(found)

        # recompute max_sessions if impossible
        if len(locked_sessions) > max_sessions:
            warnings.append(
                f"day_constraints conflict on {date_str}: locks={len(locked_sessions)} > max_sessions={max_sessions}. Auto-bumping max_sessions to locks."
            )
            max_sessions = len(locked_sessions)
            changed = True

        # ---- trim to max_sessions keeping locks ----
        if len(sessions) > max_sessions:
            # keep all locked first, then fill with non-locked until max
            locked_ids = {id(s) for s in locked_sessions}
            kept: List[Dict[str, Any]] = []
            for s in sessions:
                if isinstance(s, dict) and id(s) in locked_ids:
                    kept.append(s)
            # add non-locked
            for s in sessions:
                if not isinstance(s, dict):
                    continue
                if id(s) in locked_ids:
                    continue
                if len(kept) >= max_sessions:
                    break
                kept.append(s)

            if len(kept) != len(sessions):
                day["sessions"] = kept
                changed = True

        # ---- if max_sessions==1, make it brutally strict: keep only the first lock if any ----
        # (ale v praxi to vyrieši lock+trim vyššie)
        # nothing else needed

    if trace is not None:
        trace.setdefault("postprocess", {})
        trace["postprocess"]["day_constraints_applied"] = True
        trace["postprocess"]["day_constraints_changed"] = bool(changed)
        if warnings:
            trace["postprocess"]["warnings"] = warnings

    return daily_plan


def generate_daily_week_json(
    context_payload: dict,
    model: str,
    *,
    debug_raw: bool = False,
) -> Tuple[dict, Optional[dict]]:
    """
    AI client pre DAILY PLAN jedného týždňa.
    Vždy vracia (daily_dict, debug_trace_or_None).
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")

    raw_settings = context_payload.get("user_settings") or {}
    settings: Dict[str, Any] = raw_settings if isinstance(raw_settings, dict) else {}

    system_txt, user_txt, fixed_slots_from_template, strength_target = _build_prompts_for_daily(
        context_payload,
        settings=settings,
    )

    retries = int(os.getenv("OPENAI_RETRIES", "2") or "2")

    timeout_env = os.getenv("OPENAI_TIMEOUT_S")
    if timeout_env:
        try:
            timeout_s = int(timeout_env)
        except Exception:
            timeout_s = int(LLM_TIMEOUT_S or 45)
    else:
        timeout_s = int(LLM_TIMEOUT_S or 45)

    if timeout_s < 10:
        timeout_s = 10
    if timeout_s > 120:
        timeout_s = 120

    client = OpenAI(api_key=OPENAI_API_KEY).with_options(timeout=timeout_s)
    models = llm_models_priority(model)
    token_budgets = [2500, 2200, 2000]

    trace: Dict[str, Any] = {"models_tried": models, "attempts": []}
    if debug_raw:
        trace["system_prompt"] = system_txt
        trace["user_prompt"] = user_txt
        trace["fixed_slots_from_template"] = fixed_slots_from_template
        trace["strength_target"] = strength_target
        trace["timeout_s"] = timeout_s

    last_raw: Optional[str] = None
    last_cleaned: Optional[str] = None
    last_err: Optional[str] = None

    week = context_payload.get("week") or {}
    week_index = int(week.get("week_index") or 1)
    week_start = week.get("week_start") or None
    week_end = week.get("week_end") or None

    tz_name = settings.get("timezone") or "Europe/Bratislava"
    try:
        tzinfo = ZoneInfo(str(tz_name))
    except Exception:
        tzinfo = timezone.utc

    for m in models:
        for attempt in range(1, retries + 1):
            started = time.time()
            budget = token_budgets[min(attempt - 1, len(token_budgets) - 1)]
            try:
                raw, usage = _call_openai_raw(client, m, system_txt, user_txt, budget)
                dur_ms = int((time.time() - started) * 1000)

                parsed, cleaned, raw_keep = _parse_ai_json(raw)
                last_raw, last_cleaned = raw_keep, cleaned

                attempt_row: Dict[str, Any] = {
                    "model": m,
                    "attempt": attempt,
                    "ok": parsed is not None,
                    "duration_ms": dur_ms,
                }
                if debug_raw:
                    attempt_row["raw_preview"] = raw[:600] + ("…[truncated]" if len(raw) > 600 else "")
                trace["attempts"].append(attempt_row)

                if not parsed:
                    last_err = "AI returned invalid JSON"
                    continue

                now_local = datetime.now(tzinfo)

                parsed["schema_version"] = int(parsed.get("schema_version") or 1)
                parsed["generated_at"] = now_local.isoformat()
                parsed["model"] = m

                if "week_index" not in parsed:
                    parsed["week_index"] = week_index
                if "week_start" not in parsed and week_start:
                    parsed["week_start"] = week_start
                if "week_end" not in parsed and week_end:
                    parsed["week_end"] = week_end
                if "days" not in parsed or not isinstance(parsed["days"], list):
                    parsed["days"] = []

                # --- SERVER-SIDE POISTKA: day_constraints (max_sessions + locks) ---
                parsed = _enforce_day_constraints_server_side(
                    parsed,
                    context_payload,
                    trace=trace if debug_raw else None,
                )

                trace["usage"] = {
                    "model": m,
                    "prompt_tokens": int(usage.get("prompt_tokens", 0)),
                    "completion_tokens": int(usage.get("completion_tokens", 0)),
                    "total_tokens": int(usage.get("total_tokens", 0)),
                }

                if debug_raw:
                    trace["raw"] = raw_keep
                    trace["cleaned"] = cleaned
                    trace["ok_model"] = m

                return parsed, trace

            except Exception as e:  # noqa: BLE001
                dur_ms = int((time.time() - started) * 1000)
                last_err = f"{e.__class__.__name__}: {e}"
                trace["attempts"].append(
                    {
                        "model": m,
                        "attempt": attempt,
                        "ok": False,
                        "duration_ms": dur_ms,
                        "error": last_err,
                    }
                )
                time.sleep(0.5 * attempt)
                continue

    now_fallback = datetime.now(tzinfo).isoformat()
    fallback = {
        "schema_version": 1,
        "generated_at": now_fallback,
        "model": "daily-fallback",
        "week_index": week_index,
        "week_start": week_start,
        "week_end": week_end,
        "days": [],
        "error": last_err,
    }

    if debug_raw:
        trace["raw"] = last_raw
        trace["cleaned"] = last_cleaned
        trace["error"] = last_err or "unknown"

    return fallback, trace if debug_raw else None