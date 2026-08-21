# Services/AI/plan_completion/generate.py
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

from Services.AI.provider.provider import ai_call_json_model
from Services.user_prefs import service_load_user_settings
from Services.AI.utils.billing import extract_usage_from_trace, log_ai_usage_for_user
from Modules.Supabase.auth import AuthCtx


# ============================================================
# HELPERS
# ============================================================

def _get_user_lang(user_id: int, ctx: AuthCtx) -> str:
    try:
        s = service_load_user_settings(user_id=user_id, ctx=ctx) or {}
        return str(s.get("language") or "sk")[:2].lower()
    except Exception:
        return "sk"


def _format_time_s(seconds: Optional[int]) -> Optional[str]:
    if not seconds or seconds <= 0:
        return None
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def _build_prompts(
    *,
    lang: str,
    race: Optional[Dict[str, Any]],
    goal_kind: Optional[str],
    plan_start_date: Optional[str],
    plan_end_date: Optional[str],
    weeks_total: Optional[int],
    aggregated: Dict[str, Any],
    weeks: List[Dict[str, Any]],
    future_weeks_count: int,
    today_iso: str,
    actual_time_s: Optional[int],
    target_km: Optional[float],
    actual_km: Optional[float],
    is_plan_completed: bool,
) -> Tuple[str, str]:
    lang_rule = {
        "sk": "Slovak. Tykanie. Priamy, oslavný, ale úprimný štýl.",
        "en": "English. Second person. Celebratory but honest.",
        "cs": "Czech. Tykání. Přímý, oslavný, ale upřímný styl.",
    }.get(lang, "Slovak. Tykanie.")

    has_race = race is not None

    if is_plan_completed:
        completion_note = "The athlete just finished their training cycle."
    else:
        completion_note = (
            "The athlete requested a mid-cycle progress checkpoint. The plan is "
            "STILL ONGOING - do not talk about it as finished, frame this as "
            "progress-so-far and what's still ahead."
        )

    system = (
        "You are an elite endurance coach writing a training summary for an athlete. "
        f"{completion_note} Look at the training cycle so far: consistency, volume "
        "trends, sport balance, and "
        + (
            "how progress compares to the target race (if it already happened, its "
            "result vs target; if it's still upcoming, readiness for it). "
            if has_race
            else "overall progress toward the athlete's stated goal (no specific race - "
            "this is a general fitness/speed/endurance improvement cycle). "
        )
        + "Be specific, honest, and encouraging. "
        "Return ONE valid JSON object only. No markdown. No extra text."
    )

    week_trend = [
        {
            "week_index": w.get("week_index"),
            "load_phase": w.get("load_phase"),
            "planned_stats": w.get("planned_stats"),
            "actual_stats": w.get("actual_stats"),
        }
        for w in weeks
    ]

    data: Dict[str, Any] = {
        "today": today_iso,
        "plan": {
            "start_date": plan_start_date,
            "end_date": plan_end_date,
            "weeks_total": weeks_total,
            "is_completed": is_plan_completed,
        },
        "cycle_totals": {
            "weeks_tracked": len(weeks),
            "planned_stats": aggregated["planned"],
            "actual_stats": aggregated["actual"],
        },
        # 🌟 weekly_trend obsahuje LEN týždne, ktoré už prebehli alebo
        # prebiehajú (week_end <= today). Zvyšné týždne plánu (future_weeks_count)
        # ešte len prídu - nie sú tu zámerne, NIE preto, že by sa v nich
        # netrénovalo.
        "weekly_trend_elapsed_only": week_trend,
        "future_weeks_not_yet_happened": future_weeks_count,
    }

    if has_race:
        data["race"] = {
            "name": race.get("name"),
            "date": race.get("date"),
            "priority": race.get("priority"),
            "race_type": race.get("race_type"),
            "target_time": race.get("target_time"),
            "already_happened": race.get("already_happened"),
            "actual_time_s": actual_time_s,
            "actual_time_formatted": _format_time_s(actual_time_s),
            "target_distance_km": target_km,
            "actual_distance_km": round(actual_km, 2) if actual_km else None,
            "terrain": race.get("terrain"),
            "elevation_profile": race.get("elevation_profile"),
            "elevation_gain_m": race.get("elevation_gain_m"),
        }
    else:
        data["goal"] = {
            "goal_kind": goal_kind,
            "note": "No specific target race - this cycle is a general fitness/speed/endurance goal.",
        }

    schema = """{
  "schema_version": 1,
  "headline": "1 punchy sentence, 2nd person.",
  "summary_text": "4-6 sentences. Full narrative — consistency, sport balance, how volume evolved, and overall progress. NO raw number recitation — data is already visible on screen.",
  "achieved_target": true | false | null,
  "highlights": ["2-3 things the athlete should be proud of"],
  "areas_to_improve": ["1-3 concrete things to work on"],
  "next_cycle_advice": "2-3 sentences of concrete advice for what comes next."
}"""

    if has_race:
        race_rule = (
            "- If race.already_happened is true, compare actual_time_s to target_time "
            "honestly and set achieved_target accordingly. If race.already_happened is "
            "false (race is still upcoming), do NOT invent a result - talk about "
            "readiness/preparation instead and set achieved_target to null.\n"
        )
    else:
        race_rule = (
            "- There is no specific race/target_time here - base achieved_target on "
            "whether actual_stats roughly met or exceeded planned_stats, or set it to "
            "null if that's not a meaningful signal.\n"
        )

    future_rule = (
        "- CRITICAL: 'weekly_trend_elapsed_only' contains ONLY weeks up to 'today' "
        f"({today_iso}). There are {future_weeks_count} additional week(s) in this plan "
        "that have NOT happened yet - they are simply not included because they are in "
        "the future, NOT because the athlete stopped training. NEVER claim the athlete "
        "'stopped training for N weeks' or similar based on weeks missing from this "
        "list - those weeks don't exist yet. Only comment on gaps or inconsistency "
        "WITHIN the weeks actually present in weekly_trend_elapsed_only.\n"
    )

    user = (
        "Write a training summary for the cycle below.\n\n"
        f"DATA:\n{json.dumps(data, ensure_ascii=False, default=str)}\n\n"
        f"OUTPUT SCHEMA:\n{schema}\n\n"
        f"RULES:\n"
        f"- Language: {lang_rule}\n"
        + race_rule
        + future_rule
        + "- Use weekly_trend_elapsed_only to spot consistency patterns (e.g. dropped "
        "volume mid-cycle, strong taper, missed sessions) rather than just reciting totals.\n"
        "- DO NOT list numbers already visible in cycle_totals - provide INSIGHTS.\n"
        "- Return ONLY valid raw JSON."
    )

    return system, user


# ============================================================
# HLAVNÁ FUNKCIA — volaná z Services/coach_plan_completion.py
# ============================================================

def service_generate_plan_completion_summary(
    *,
    user_id: int,
    race: Optional[Dict[str, Any]],
    goal_kind: Optional[str] = None,
    plan_start_date: Optional[str] = None,
    plan_end_date: Optional[str] = None,
    weeks_total: Optional[int] = None,
    aggregated: Dict[str, Any],
    weeks: List[Dict[str, Any]],
    future_weeks_count: int = 0,
    today_iso: Optional[str] = None,
    actual_time_s: Optional[int],
    target_km: Optional[float],
    actual_km: Optional[float],
    is_plan_completed: bool = True,
    ctx: AuthCtx,
) -> Dict[str, Any]:
    """
    Generuje AI sumár tréningového cyklu (analogicky k
    service_generate_monthly_review). 'weeks' by mali obsahovať LEN
    prebehnuté/prebiehajúce týždne (filtrovanie robí volajúci v
    coach_plan_completion.py), 'future_weeks_count' hovorí AI koľko
    ďalších týždňov ešte príde - aby nesprávne neinterpretovala chýbajúce
    budúce týždne ako prerušenie tréningu.
    """
    TAG = f"[PLAN-COMPLETION][user={user_id}]"

    from datetime import date as _date
    resolved_today = today_iso or _date.today().isoformat()

    race_for_prompt = dict(race) if race else None
    if race_for_prompt is not None:
        race_for_prompt["already_happened"] = actual_time_s is not None

    lang = _get_user_lang(user_id, ctx)
    system_txt, user_txt = _build_prompts(
        lang=lang,
        race=race_for_prompt,
        goal_kind=goal_kind,
        plan_start_date=plan_start_date,
        plan_end_date=plan_end_date,
        weeks_total=weeks_total,
        aggregated=aggregated,
        weeks=weeks,
        future_weeks_count=future_weeks_count,
        today_iso=resolved_today,
        actual_time_s=actual_time_s,
        target_km=target_km,
        actual_km=actual_km,
        is_plan_completed=is_plan_completed,
    )

    res = ai_call_json_model(
        context_payload={"user": {"id": user_id}, "type": "plan_completion_summary"},
        system_prompt=system_txt,
        user_instructions=user_txt,
        model=None,
    )

    if not res.ok or not isinstance(res.data, dict):
        err = str(getattr(res.error, "message", res.error) if res.error else "unknown")
        print(f"{TAG} ❌ AI failed: {err}")
        return {"ok": False, "reason": "ai_failed", "error": err}

    result = dict(res.data)
    result.setdefault("schema_version", 1)
    result["model"] = str(res.model or "unknown")

    try:
        trace = {"ok_model": res.model, "ok_provider": getattr(res, "provider", "unknown")}
        usage = extract_usage_from_trace(trace, model_fallback=res.model)
        if usage:
            log_ai_usage_for_user(
                user_id=user_id, usage=usage,
                job_type="plan_completion_summary", source="import_hook" if is_plan_completed else "manual",
                billed_via="internal", charge_wallet=False,
                meta={"race_name": race.get("name") if race else None, "goal_kind": goal_kind},
                ctx=ctx,
            )
    except Exception as e:  # noqa: BLE001
        print(f"{TAG} ❌ billing failed: {e}")

    return {"ok": True, "data": result}
